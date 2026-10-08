//! Запасной адаптер для VPS и локальный стенд: то же ядро поверх файлов `<data>/dem3/<градус>`
//! (раскладка как в R2). Основной путь — `worker`.

use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;
use axum::body::{Body, to_bytes};
use axum::extract::{Request, State};
use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::Response;
use elevation_core::request::MAX_BODY_BYTES;
use elevation_core::{Error, Source, http};

pub struct FileSource {
    pub root: PathBuf,
}

impl Source for FileSource {
    async fn read(&self, key: &str, offset: u64, length: u64) -> Result<Option<Vec<u8>>, Error> {
        let source_error = |error: std::io::Error| Error::Source(format!("{key}: {error}"));
        let mut file = match std::fs::File::open(self.root.join(key)) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(source_error(error)),
        };
        file.seek(SeekFrom::Start(offset)).map_err(source_error)?;
        let mut bytes = vec![0; length as usize];
        file.read_exact(&mut bytes).map_err(source_error)?;
        Ok(Some(bytes))
    }
}

pub struct AppState {
    pub source: FileSource,
    pub allowed_origins: String,
}

pub fn app(state: AppState) -> Router {
    Router::new().fallback(handle).with_state(Arc::new(state))
}

async fn handle(State(state): State<Arc<AppState>>, request: Request) -> Response {
    let (parts, body) = request.into_parts();
    let header = |name: &str| {
        parts
            .headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .map(str::to_string)
    };
    let origin = header("origin");
    let request_headers = header("access-control-request-headers");
    let content_length = header("content-length").and_then(|value| value.parse().ok());
    // Тело читается не больше лимита + 1 байт: переполнение ядро само превратит в `413`.
    let body = match to_bytes(body, MAX_BODY_BYTES + 1).await {
        Ok(bytes) => bytes.to_vec(),
        Err(_) => vec![0; MAX_BODY_BYTES + 1],
    };
    let path = parts.uri.path().to_string();
    let method = parts.method.as_str().to_string();
    // Источник читает файлы синхронно, а future ядра не `Send` (трейт без `Send`-границ, ради wasm),
    // поэтому ядро крутится на отдельном потоке своим исполнителем.
    let response = tokio::task::spawn_blocking(move || {
        let request = http::Request {
            method: &method,
            path: &path,
            origin: origin.as_deref(),
            content_length,
            request_headers: request_headers.as_deref(),
            body: &body,
        };
        let allowed = http::parse_origins(&state.allowed_origins);
        futures::executor::block_on(http::handle(
            &request,
            &allowed,
            &state.source,
            &http::Unlimited,
        ))
    })
    .await
    .expect("handler thread");
    if let Some(error) = &response.error {
        eprintln!("elevation error: {error}");
    }
    let mut result = Response::new(Body::from(response.body));
    *result.status_mut() = StatusCode::from_u16(response.status).expect("status");
    for (name, value) in response.headers {
        result.headers_mut().insert(
            HeaderName::from_bytes(name.as_bytes()).expect("header name"),
            HeaderValue::from_str(&value).expect("header value"),
        );
    }
    result
}
