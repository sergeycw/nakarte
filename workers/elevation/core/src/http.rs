use crate::archive::{self, Lookup};
use crate::request::{self, MAX_BODY_BYTES, MAX_READS, ParseError};
use crate::tile::{self, LIVE_MIN_ZOOM};
use crate::{Error, Source, elevations, read_count, render, response};

const ALLOWED_METHODS: &str = "POST, OPTIONS";
const TEXT: &str = "text/plain; charset=utf-8";
const TILES_PREFIX: &str = "/tiles/";
// Тайлы автора кешируются на сутки (`tiles.nakarte.me`, проверено 2026-10-07).
const TILE_CACHE: &str = "max-age=86400";
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

/// Счётчик частоты запросов с одного IP: у тайлов и API свои лимиты (`[[ratelimits]]` в wrangler.toml).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RateGroup {
    Tiles,
    Api,
}

/// Какой счётчик тратит запрос. `None` — запрос API с неразрешённым `Origin`: он и так получит
/// `403`, счётчик на него не тратится.
pub fn rate_group(request: &Request<'_>, allowed_origins: &[&str]) -> Option<RateGroup> {
    if request.path.starts_with(TILES_PREFIX) {
        return Some(RateGroup::Tiles);
    }
    request
        .origin
        .filter(|origin| allowed_origins.contains(origin))
        .map(|_| RateGroup::Api)
}

/// Ответ сверх лимита — с теми же CORS-заголовками, что обычный ответ на этот путь, чтобы клиент
/// увидел `429`, а не сбой CORS. Вызывать только для запросов, у которых `rate_group` не `None`.
pub fn too_many_requests(request: &Request<'_>) -> Response {
    let response = rate_limited();
    match request.origin {
        Some(origin) if !request.path.starts_with(TILES_PREFIX) => response.with_cors(origin),
        _ => {
            let mut response = response;
            response
                .headers
                .push(("Access-Control-Allow-Origin", "*".to_string()));
            response
        }
    }
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
// Тайлы (`/tiles/`): CORS `*` без проверки `Origin`, как у `tiles.nakarte.me`.
pub async fn handle<S: Source, B: ReadBudget>(
    request: &Request<'_>,
    allowed_origins: &[&str],
    source: &S,
    budget: &B,
) -> Response {
    if let Some(path) = request.path.strip_prefix(TILES_PREFIX) {
        return respond_tile(request.method, path, source).await;
    }
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

// `Access-Control-Allow-Origin: *` и на `404`: клиент считает `404` ответом «нет данных», а без
// заголовка браузер отдал бы ему ошибку CORS.
async fn respond_tile<S: Source>(method: &str, path: &str, source: &S) -> Response {
    let mut response = tile_status(method, path, source).await;
    response
        .headers
        .push(("Access-Control-Allow-Origin", "*".to_string()));
    response
}

async fn tile_status<S: Source>(method: &str, path: &str, source: &S) -> Response {
    if method != "GET" && method != "HEAD" {
        let mut response = Response::new(405, "Method not allowed\n").text();
        response.headers.push(("Allow", "GET, HEAD".to_string()));
        return response;
    }
    let Some((z, x, y)) = tile::parse_path(path) else {
        return Response::new(404, "404 page not found\n").text();
    };
    match tile_body(source, z, x, y).await {
        Ok(Some(body)) => {
            let mut response = Response::new(200, body);
            response.headers.extend([
                ("Content-Type", "application/octet-stream".to_string()),
                ("Content-Encoding", "gzip".to_string()),
                ("Cache-Control", TILE_CACHE.to_string()),
            ]);
            response
        }
        Ok(None) => {
            let mut response = Response::new(404, "No data\n").text();
            response
                .headers
                .push(("Cache-Control", TILE_CACHE.to_string()));
            response
        }
        Err(error) => Response {
            error: Some(error.to_string()),
            ..Response::new(500, "Server error\n").text()
        },
    }
}

/// Тело тайла в gzip: z10–11 — на лету из `dem3`, меньшие зумы — из архива; `None` — данных нет.
pub async fn tile_body<S: Source>(
    source: &S,
    z: u8,
    x: u32,
    y: u32,
) -> Result<Option<Vec<u8>>, Error> {
    if z < LIVE_MIN_ZOOM {
        return match archive::read(source, z, x, y).await? {
            Lookup::Tile(body) => Ok(Some(body)),
            Lookup::Missing | Lookup::NotCovered => Ok(None),
        };
    }
    let raster = render::tile(source, z, x, y).await?;
    if !raster.has_data() {
        return Ok(None);
    }
    Ok(Some(tile::encode_tile(&raster)))
}
