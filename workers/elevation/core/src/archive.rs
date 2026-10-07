//! Архив тайлов z0–9 одним объектом R2 (`KEY`).
//!
//! Раскладка: заголовок `HEADER_LEN` байт — magic `NKT1`, `u8` максимальный зум, 3 байта нулей;
//! затем плотный индекс по всем позициям `z ≤ max` в порядке `tile_index` — `u64` смещение и `u32`
//! длина тела, LE; затем тела (уже в gzip). Длина 0 — тайла нет (над океаном). Для z0–9 индекс —
//! 349 525 записей, ≈ 4.2 МБ, поэтому вместо директорий PMTiles — арифметика и два range-чтения:
//! страница индекса (`PAGE_ENTRIES` соседних записей, хорошо ложится в кеш изолята) и тело.

use std::io::{Seek, SeekFrom, Write};

use crate::{Error, Source};

pub const KEY: &str = "tiles/elevation-z0-9";
pub const MAGIC: &[u8; 4] = b"NKT1";
pub const HEADER_LEN: u64 = 8;
pub const ENTRY_LEN: u64 = 12;
pub const PAGE_ENTRIES: u64 = 256;

/// Номер тайла в индексе: все тайлы меньших зумов, затем строки зума `z`.
pub fn tile_index(z: u8, x: u32, y: u32) -> u64 {
    ((1u64 << (2 * u32::from(z))) - 1) / 3 + (u64::from(y) << z) + u64::from(x)
}

pub fn entry_count(max_zoom: u8) -> u64 {
    tile_index(max_zoom + 1, 0, 0)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Lookup {
    /// Архива нет или зум выше его максимума.
    NotCovered,
    /// Позиция в архиве есть, тайла нет.
    Missing,
    Tile(Vec<u8>),
}

pub async fn read<S: Source>(source: &S, z: u8, x: u32, y: u32) -> Result<Lookup, Error> {
    let Some(header) = source.read(KEY, 0, HEADER_LEN).await? else {
        return Ok(Lookup::NotCovered);
    };
    if header.len() != HEADER_LEN as usize || &header[..4] != MAGIC {
        return Err(Error::Format("bad tile archive header"));
    }
    let max_zoom = header[4];
    if z > max_zoom {
        return Ok(Lookup::NotCovered);
    }
    let index = tile_index(z, x, y);
    let page = index / PAGE_ENTRIES;
    let first = page * PAGE_ENTRIES;
    let entries = PAGE_ENTRIES.min(entry_count(max_zoom) - first);
    let bytes = source
        .read(KEY, HEADER_LEN + first * ENTRY_LEN, entries * ENTRY_LEN)
        .await?
        .ok_or_else(|| Error::Source(format!("{KEY} disappeared")))?;
    let at = ((index - first) * ENTRY_LEN) as usize;
    let entry = bytes
        .get(at..at + ENTRY_LEN as usize)
        .ok_or(Error::Format("short tile archive index"))?;
    let offset = u64::from_le_bytes(entry[..8].try_into().unwrap());
    let length = u32::from_le_bytes(entry[8..].try_into().unwrap());
    if length == 0 {
        return Ok(Lookup::Missing);
    }
    let body = source
        .read(KEY, offset, u64::from(length))
        .await?
        .ok_or_else(|| Error::Source(format!("{KEY} disappeared")))?;
    Ok(Lookup::Tile(body))
}

/// Пишет архив потоком: заголовок и пустой индекс сразу, тела — по мере готовности в любом порядке,
/// индекс — в `finish`.
pub struct Writer<W: Write + Seek> {
    out: W,
    max_zoom: u8,
    entries: Vec<(u64, u32)>,
    offset: u64,
}

impl<W: Write + Seek> Writer<W> {
    pub fn new(mut out: W, max_zoom: u8) -> std::io::Result<Writer<W>> {
        let count = entry_count(max_zoom);
        let mut header = MAGIC.to_vec();
        header.extend_from_slice(&[max_zoom, 0, 0, 0]);
        out.write_all(&header)?;
        out.write_all(&vec![0; (count * ENTRY_LEN) as usize])?;
        Ok(Writer {
            out,
            max_zoom,
            entries: vec![(0, 0); count as usize],
            offset: HEADER_LEN + count * ENTRY_LEN,
        })
    }

    pub fn add(&mut self, z: u8, x: u32, y: u32, body: &[u8]) -> std::io::Result<()> {
        assert!(z <= self.max_zoom, "zoom {z} above archive max");
        self.out.write_all(body)?;
        self.entries[tile_index(z, x, y) as usize] = (self.offset, body.len() as u32);
        self.offset += body.len() as u64;
        Ok(())
    }

    pub fn tiles(&self) -> usize {
        self.entries
            .iter()
            .filter(|(_, length)| *length > 0)
            .count()
    }

    pub fn finish(mut self) -> std::io::Result<W> {
        let mut index = Vec::with_capacity(self.entries.len() * ENTRY_LEN as usize);
        for (offset, length) in &self.entries {
            index.extend_from_slice(&offset.to_le_bytes());
            index.extend_from_slice(&length.to_le_bytes());
        }
        self.out.seek(SeekFrom::Start(HEADER_LEN))?;
        self.out.write_all(&index)?;
        self.out.flush()?;
        Ok(self.out)
    }
}
