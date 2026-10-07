//! Основной адаптер: Cloudflare Worker (`workers-rs`) поверх R2-бакета `DEM` (`nakarte-elevation`).
//!
//! Cache API здесь бесполезен: на `*.workers.dev` он не работает, а своего домена у клона нет.
//! Поэтому заголовки и сжатые куски кешируются в памяти изолята (`ByteCache`), изолят живёт
//! между запросами и отдаёт горячие районы без походов в R2.

use std::cell::RefCell;
use std::collections::HashMap;

use elevation_core::request::MAX_BODY_BYTES;
use elevation_core::{Error as CoreError, Source, http};
use worker::{Bucket, Context, EncodeBody, Env, Request, Response, Result, console_error, event};

// Изолят ограничен 128 МБ вместе с wasm; 32 МБ — сотни сжатых кусков (≈ 40–100 КБ каждый).
const CACHE_BYTES: usize = 32 * 1024 * 1024;

#[derive(Default)]
struct ByteCache {
    entries: HashMap<String, (Vec<u8>, u64)>,
    total: usize,
    clock: u64,
}

impl ByteCache {
    fn get(&mut self, key: &str) -> Option<Vec<u8>> {
        self.clock += 1;
        let clock = self.clock;
        let (bytes, used) = self.entries.get_mut(key)?;
        *used = clock;
        Some(bytes.clone())
    }

    fn put(&mut self, key: String, bytes: Vec<u8>) {
        self.clock += 1;
        self.total += bytes.len();
        if let Some((old, _)) = self.entries.insert(key, (bytes, self.clock)) {
            self.total -= old.len();
        }
        while self.total > CACHE_BYTES {
            let Some(oldest) = self
                .entries
                .iter()
                .min_by_key(|(_, (_, used))| *used)
                .map(|(key, _)| key.clone())
            else {
                break;
            };
            if let Some((bytes, _)) = self.entries.remove(&oldest) {
                self.total -= bytes.len();
            }
        }
    }
}

thread_local! {
    static CACHE: RefCell<ByteCache> = RefCell::new(ByteCache::default());
}

struct R2Source {
    bucket: Bucket,
}

impl Source for R2Source {
    async fn read(
        &self,
        key: &str,
        offset: u64,
        length: u64,
    ) -> std::result::Result<Option<Vec<u8>>, CoreError> {
        let cache_key = format!("{key}@{offset}+{length}");
        if let Some(bytes) = CACHE.with_borrow_mut(|cache| cache.get(&cache_key)) {
            return Ok(Some(bytes));
        }
        let source_error = |error: worker::Error| CoreError::Source(format!("{key}: {error}"));
        let object = self
            .bucket
            .get(key)
            .range(worker::Range::OffsetWithLength { offset, length })
            .execute()
            .await
            .map_err(source_error)?;
        let Some(object) = object else {
            return Ok(None);
        };
        let body = object
            .body()
            .ok_or_else(|| CoreError::Source(format!("{key}: no body")))?;
        let bytes = body.bytes().await.map_err(source_error)?;
        CACHE.with_borrow_mut(|cache| cache.put(cache_key, bytes.clone()));
        Ok(Some(bytes))
    }
}

#[event(fetch)]
async fn fetch(mut request: Request, env: Env, _ctx: Context) -> Result<Response> {
    let header = |request: &Request, name: &str| request.headers().get(name).ok().flatten();
    let origin = header(&request, "Origin");
    let request_headers = header(&request, "Access-Control-Request-Headers");
    let content_length: Option<u64> =
        header(&request, "Content-Length").and_then(|value| value.parse().ok());
    let method = request.method().to_string();
    let path = request.path();
    // Заведомо большое тело не читаем: ядро ответит `413` по `Content-Length`.
    let body = match (method.as_str(), content_length) {
        ("POST", Some(length)) if length > MAX_BODY_BYTES as u64 => Vec::new(),
        ("POST", _) => request.bytes().await?,
        _ => Vec::new(),
    };
    let allowed_origins = env
        .var("ALLOWED_ORIGINS")
        .map(|value| value.to_string())
        .unwrap_or_default();
    let core_request = http::Request {
        method: &method,
        path: &path,
        origin: origin.as_deref(),
        content_length,
        request_headers: request_headers.as_deref(),
        body: &body,
    };
    let source = R2Source {
        bucket: env.bucket("DEM")?,
    };
    let response = http::handle(
        &core_request,
        &http::parse_origins(&allowed_origins),
        &source,
    )
    .await;
    if let Some(error) = &response.error {
        console_error!("elevation error: {error}");
    }
    let precompressed = response.header("Content-Encoding").is_some();
    // Ответ с пустым телом создаётся без тела: `new Response("", {status: 204})` в JS бросает.
    let mut result = if response.body.is_empty() {
        Response::empty()?
    } else {
        Response::from_bytes(response.body)?
    }
    .with_status(response.status);
    // Тело тайла уже в gzip: с `encodeBody: "automatic"` рантайм сжал бы его ещё раз.
    if precompressed {
        result = result.with_encode_body(EncodeBody::Manual);
    }
    for (name, value) in &response.headers {
        result.headers_mut().set(name, value)?;
    }
    Ok(result)
}
