//! HGT 3″ (viewfinderpanoramas, 1201×1201 `i16` big-endian, строки с севера, nodata `-32768`)
//! → объект градуса из `elevation_core::format`. Нарезка на куски повторяет `splitDem` из
//! `cmd/make_data` Go-сервера автора.

use elevation_core::format::{CHUNKS, SPLIT, TILE_SIZE, encode_degree};

pub const HGT_SIZE: usize = 1201;
pub const HGT_BYTES: usize = HGT_SIZE * HGT_SIZE * 2;

#[derive(Debug, PartialEq, Eq)]
pub enum RepackError {
    BadName(String),
    BadSize(usize),
}

impl std::fmt::Display for RepackError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RepackError::BadName(name) => write!(f, "not an HGT name: {name}"),
            RepackError::BadSize(size) => write!(f, "HGT must be {HGT_BYTES} bytes, got {size}"),
        }
    }
}

impl std::error::Error for RepackError {}

// `N43E042.hgt` (регистр любой, с путём) → `N43E042`. Имя файла — единственный источник
// координат градуса: в HGT нет заголовка.
pub fn degree_name(file_name: &str) -> Result<String, RepackError> {
    let bad = || RepackError::BadName(file_name.to_string());
    let base = file_name
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(file_name)
        .to_ascii_uppercase();
    let stem = base.strip_suffix(".HGT").ok_or_else(bad)?;
    let bytes = stem.as_bytes();
    let well_formed = bytes.len() == 7
        && matches!(bytes[0], b'N' | b'S')
        && matches!(bytes[3], b'E' | b'W')
        && bytes[1..3]
            .iter()
            .chain(&bytes[4..7])
            .all(u8::is_ascii_digit);
    if !well_formed {
        return Err(bad());
    }
    Ok(stem.to_string())
}

pub fn split_hgt(hgt: &[u8]) -> Result<Vec<Vec<i16>>, RepackError> {
    if hgt.len() != HGT_BYTES {
        return Err(RepackError::BadSize(hgt.len()));
    }
    let node = |row: usize, col: usize| {
        let at = (row * HGT_SIZE + col) * 2;
        i16::from_be_bytes([hgt[at], hgt[at + 1]])
    };
    let step = TILE_SIZE - 1;
    let chunks = (0..CHUNKS)
        .map(|chunk| {
            let (dy, dx) = (chunk / SPLIT, chunk % SPLIT);
            let mut values = Vec::with_capacity(TILE_SIZE * TILE_SIZE);
            for row in 0..TILE_SIZE {
                let hgt_row = HGT_SIZE - 1 - dy * step - row;
                for col in 0..TILE_SIZE {
                    values.push(node(hgt_row, dx * step + col));
                }
            }
            values
        })
        .collect();
    Ok(chunks)
}

// `only` — номера кусков, которые попадут в объект; остальные пишутся нулевой длины.
// Нужен для прореженных фикстур контрактного теста.
pub fn repack_hgt(hgt: &[u8], only: Option<&[usize]>, level: i32) -> Result<Vec<u8>, RepackError> {
    let chunks: Vec<Option<Vec<i16>>> = split_hgt(hgt)?
        .into_iter()
        .enumerate()
        .map(|(index, values)| match only {
            Some(only) if !only.contains(&index) => None,
            _ => Some(values),
        })
        .collect();
    Ok(encode_degree(&chunks, level))
}
