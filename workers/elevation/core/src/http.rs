use crate::request::{self, MAX_BODY_BYTES, ParseError};
use crate::{Source, elevations, response};

const ALLOWED_METHODS: &str = "POST, OPTIONS";
const TEXT: &str = "text/plain; charset=utf-8";

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
    pub body: String,
    pub error: Option<String>,
}

impl Response {
    fn new(status: u16, body: impl Into<String>) -> Response {
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

// HTTP без привязки к рантайму: адаптер собирает `Request` и переводит `Response` обратно.
// CORS как у `workers/tracks`: только origin из `ALLOWED_ORIGINS`, иначе (и без `Origin`) — 403.
// Коды и тексты ошибок — как у Go-сервера автора (`http.Error` дописывает `\n`).
pub async fn handle<S: Source>(
    request: &Request<'_>,
    allowed_origins: &[&str],
    source: &S,
) -> Response {
    let Some(origin) = request
        .origin
        .filter(|origin| allowed_origins.contains(origin))
    else {
        return Response::new(403, "Origin not allowed\n").text();
    };
    respond(request, source).await.with_cors(origin)
}

async fn respond<S: Source>(request: &Request<'_>, source: &S) -> Response {
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
    match elevations(source, &points).await {
        Ok(values) => Response::new(200, response::format_elevations(&values)).text(),
        Err(error) => Response {
            error: Some(error.to_string()),
            ..Response::new(500, "Server error\n").text()
        },
    }
}
