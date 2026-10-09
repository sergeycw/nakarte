use crate::request::{self, MAX_BODY_BYTES, MAX_READS, ParseError};
use crate::{Source, elevations, read_count, response};

const ALLOWED_METHODS: &str = "POST, OPTIONS";
const TEXT: &str = "text/plain; charset=utf-8";
// Длина окна `[[ratelimits]]` в wrangler.toml.
const RETRY_AFTER_SECONDS: &str = "60";
/// Единица бюджета чтений: привязка rate limiting считает вызовы `limit()` без веса, поэтому запрос
/// тратит `ceil(чтения / 64)` вызовов; бюджет в единицах — `API_READS_RATE_LIMITER` в wrangler.toml.
pub const READS_PER_UNIT: usize = 64;

/// Бюджет чтений хранилища на клиента. `spend` получает число единиц (`READS_PER_UNIT`) и отвечает,
/// уложился ли запрос; `false` — `429`. Адаптер `worker` тратит привязку `[[ratelimits]]` по IP,
/// `server` и тесты — `Unlimited`.
#[allow(async_fn_in_trait)]
pub trait ReadBudget {
    async fn spend(&self, units: usize) -> bool;
}

pub struct Unlimited;

impl ReadBudget for Unlimited {
    async fn spend(&self, _units: usize) -> bool {
        true
    }
}

pub struct Request<'a> {
    pub method: &'a str,
    pub path: &'a str,
    pub origin: Option<&'a str>,
    pub content_length: Option<u64>,
    pub request_headers: Option<&'a str>,
    pub body: &'a [u8],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Response {
    pub status: u16,
    pub headers: Vec<(&'static str, String)>,
    pub body: Vec<u8>,
    pub error: Option<String>,
}

impl Response {
    fn new(status: u16, body: impl Into<Vec<u8>>) -> Response {
        Response {
            status,
            headers: Vec::new(),
            body: body.into(),
            error: None,
        }
    }

    fn text(mut self) -> Response {
        self.headers.push(("Content-Type", TEXT.to_string()));
        self
    }

    fn with_cors(mut self, origin: &str) -> Response {
        self.headers
            .push(("Access-Control-Allow-Origin", origin.to_string()));
        self.headers
            .push(("Access-Control-Allow-Credentials", "true".to_string()));
        self.headers.push(("Vary", "Origin".to_string()));
        self
    }

    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    }
}

pub fn parse_origins(list: &str) -> Vec<&str> {
    list.split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .collect()
}

/// Тратит ли запрос счётчик частоты с одного IP (`API_RATE_LIMITER` в wrangler.toml). Запрос с
/// неразрешённым `Origin` или без него и так получит `403`, счётчик на него не тратится. Тайлов высот
/// со своим счётчиком больше нет (change retire-old-client-services).
pub fn counts_toward_limit(request: &Request<'_>, allowed_origins: &[&str]) -> bool {
    request
        .origin
        .is_some_and(|origin| allowed_origins.contains(&origin))
}

/// Ответ сверх лимита — с теми же CORS-заголовками, что обычный ответ API, чтобы клиент увидел `429`,
/// а не сбой CORS. Счётчик тратят только запросы с разрешённым `Origin` (`counts_toward_limit`).
pub fn too_many_requests(origin: &str) -> Response {
    rate_limited().with_cors(origin)
}

// `429` без CORS: заголовки добавляет тот, кто отвечает на путь.
fn rate_limited() -> Response {
    let mut response = Response::new(429, "Too many requests\n").text();
    response
        .headers
        .push(("Retry-After", RETRY_AFTER_SECONDS.to_string()));
    response
}

// HTTP без привязки к рантайму: адаптер собирает `Request` и переводит `Response` обратно.
// API высот: CORS как у `workers/tracks` — только origin из `ALLOWED_ORIGINS`, иначе (и без
// `Origin`) — 403; коды и тексты ошибок — как у Go-сервера автора (`http.Error` дописывает `\n`).
// Бывший маршрут тайлов `/tiles/` отдельной ветки не имеет: такой запрос — обычный запрос API.
pub async fn handle<S: Source, B: ReadBudget>(
    request: &Request<'_>,
    allowed_origins: &[&str],
    source: &S,
    budget: &B,
) -> Response {
    let Some(origin) = request
        .origin
        .filter(|origin| allowed_origins.contains(origin))
    else {
        return Response::new(403, "Origin not allowed\n").text();
    };
    respond(request, source, budget).await.with_cors(origin)
}

async fn respond<S: Source, B: ReadBudget>(
    request: &Request<'_>,
    source: &S,
    budget: &B,
) -> Response {
    if request.method == "OPTIONS" {
        let mut response = Response::new(204, "");
        response
            .headers
            .push(("Access-Control-Allow-Methods", ALLOWED_METHODS.to_string()));
        if let Some(headers) = request.request_headers {
            response
                .headers
                .push(("Access-Control-Allow-Headers", headers.to_string()));
        }
        return response;
    }
    if request.method != "POST" {
        let mut response = Response::new(405, "Method not allowed\n").text();
        response
            .headers
            .push(("Allow", ALLOWED_METHODS.to_string()));
        return response;
    }
    if request.path != "/" {
        return Response::new(404, "404 page not found\n").text();
    }
    if request
        .content_length
        .is_some_and(|length| length > MAX_BODY_BYTES as u64)
    {
        return Response::new(413, "Request too big\n").text();
    }
    let points = match request::parse_points(request.body) {
        Ok(points) => points,
        Err(ParseError::TooBig) => return Response::new(413, "Request too big\n").text(),
        Err(ParseError::Invalid) => return Response::new(400, "Invalid request\n").text(),
    };
    // Цена запроса — чтения R2: сначала потолок на запрос, потом бюджет клиента, и только потом чтение.
    let reads = read_count(&points);
    if reads > MAX_READS {
        return Response::new(413, "Request too big\n").text();
    }
    if reads > 0 && !budget.spend(reads.div_ceil(READS_PER_UNIT)).await {
        return rate_limited();
    }
    match elevations(source, &points).await {
        Ok(values) => Response::new(200, response::format_elevations(&values)).text(),
        Err(error) => Response {
            error: Some(error.to_string()),
            ..Response::new(500, "Server error\n").text()
        },
    }
}
