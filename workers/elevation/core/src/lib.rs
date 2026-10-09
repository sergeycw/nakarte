use std::collections::BTreeMap;

use futures::stream::{self, StreamExt, TryStreamExt};

pub mod format;
pub mod grid;
pub mod http;
pub mod request;
pub mod response;

use format::{HEADER_LEN, Header};
use grid::Cell;

// Чтения R2 идут пачками: на один вызов Worker не больше 10 000 подзапросов и ограничено
// число одновременных соединений.
pub(crate) const PARALLEL_READS: usize = 16;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    Format(&'static str),
    Source(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Format(message) => write!(f, "format error: {message}"),
            Error::Source(message) => write!(f, "source error: {message}"),
        }
    }
}

impl std::error::Error for Error {}

// Единственная точка ввода-вывода ядра: прочитать диапазон байт объекта, `None` — объекта нет.
// Адаптеры: R2 (`worker`), файлы (`server`), память (тесты).
#[allow(async_fn_in_trait)]
pub trait Source {
    async fn read(&self, key: &str, offset: u64, length: u64) -> Result<Option<Vec<u8>>, Error>;
}

type ChunkPoints = BTreeMap<usize, Vec<(usize, Cell)>>;

fn group(points: &[(f64, f64)]) -> BTreeMap<String, ChunkPoints> {
    let mut degrees: BTreeMap<String, ChunkPoints> = BTreeMap::new();
    for (index, &(lat, lon)) in points.iter().enumerate() {
        let Some(cell) = grid::locate(lat, lon) else {
            continue;
        };
        degrees
            .entry(grid::object_key(cell.lat0, cell.lon0))
            .or_default()
            .entry(cell.chunk)
            .or_default()
            .push((index, cell));
    }
    degrees
}

/// Сколько чтений хранилища сделает `elevations`: заголовок каждого задетого градуса и каждый задетый
/// кусок. Считается до чтения и без учёта кеша адаптера — по нему ограничивается цена запроса
/// (класс B R2 на чтение, `http::MAX_READS` и бюджет чтений).
pub fn read_count(points: &[(f64, f64)]) -> usize {
    let degrees = group(points);
    degrees.len() + degrees.values().map(BTreeMap::len).sum::<usize>()
}

// Точки группируются по градусам и кускам: заголовок и каждый кусок читаются один раз на запрос,
// куски распаковываются по одному, чтобы не держать в памяти wasm все сразу.
pub async fn elevations<S: Source>(
    source: &S,
    points: &[(f64, f64)],
) -> Result<Vec<Option<f64>>, Error> {
    let mut result = vec![None; points.len()];
    let degrees = group(points);

    let headers: Vec<(String, Option<Header>)> = stream::iter(degrees.keys().cloned())
        .map(|key| async move {
            let header = match source.read(&key, 0, HEADER_LEN as u64).await? {
                Some(bytes) => Some(Header::parse(&bytes)?),
                None => None,
            };
            Ok::<_, Error>((key, header))
        })
        .buffered(PARALLEL_READS)
        .try_collect()
        .await?;

    let mut reads = Vec::new();
    for (key, header) in &headers {
        let Some(header) = header else {
            continue;
        };
        for &chunk in degrees[key].keys() {
            if let Some(range) = header.chunk_range(chunk) {
                reads.push((key.as_str(), chunk, range));
            }
        }
    }

    let mut chunks = stream::iter(reads)
        .map(|(key, chunk, (offset, length))| async move {
            let bytes = source
                .read(key, offset, length)
                .await?
                .ok_or_else(|| Error::Source(format!("{key} disappeared")))?;
            Ok::<_, Error>((key, chunk, bytes))
        })
        .buffered(PARALLEL_READS);
    while let Some((key, chunk, bytes)) = chunks.try_next().await? {
        let values = format::decode_chunk(&bytes)?;
        for (index, cell) in &degrees[key][&chunk] {
            result[*index] = grid::interpolate(&values, cell);
        }
    }
    Ok(result)
}
