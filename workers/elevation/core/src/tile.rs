//! Тайл высот в формате клиента nakarte (`src/lib/leaflet.layer.elevation-display`): 256×256
//! `i16` LE построчно сверху вниз, дельта-кодирование (клиент делает префиксную сумму), `NODATA`
//! — нет данных; тело отдаётся в gzip, как у автора (`geotiff2mbtiles.py`: `gzip -6`).
//!
//! Значения повторяют генератор автора `wladich/elevation_tiles_for_nakarte` (GDAL): z11 — см.
//! `render`, z0–10 — `downsample` (каскадные обзоры `gdaladdo -r gauss`).

use std::io::{Read, Write};

use crate::Error;

pub const SIZE: usize = 256;
pub const MAX_ZOOM: u8 = 11;
pub const NODATA: i16 = -512;
// Ниже этого зума тайлы берутся только из архива: на лету z9 — уже ~1 млн пикселей z11 на запрос.
pub const LIVE_MIN_ZOOM: u8 = 10;
// Уровень gzip автора; на размер ответа клиенту влияет мало, на CPU Worker — заметно.
pub const GZIP_LEVEL: u32 = 6;

/// Прямоугольник пикселей одного зума; `values` построчно сверху вниз.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Raster {
    pub width: usize,
    pub height: usize,
    pub values: Vec<i16>,
}

impl Raster {
    pub fn empty(width: usize, height: usize) -> Raster {
        Raster {
            width,
            height,
            values: vec![NODATA; width * height],
        }
    }

    pub fn get(&self, x: usize, y: usize) -> i16 {
        self.values[y * self.width + x]
    }

    pub fn crop(&self, x0: usize, y0: usize, width: usize, height: usize) -> Raster {
        let mut values = Vec::with_capacity(width * height);
        for y in y0..y0 + height {
            let row = y * self.width;
            values.extend_from_slice(&self.values[row + x0..row + x0 + width]);
        }
        Raster {
            width,
            height,
            values,
        }
    }

    pub fn has_data(&self) -> bool {
        self.values.iter().any(|&value| value != NODATA)
    }
}

/// Уровень выше по каскаду, как `GDALResampleChunk32R_Gauss` при коэффициенте 2: пиксель `(i, j)`
/// — среднее пикселей `2i..=2i+2` × `2j..=2j+2` источника с весами 1-2-1 по осям. Окно смещено
/// на полпикселя (не центрировано на `2i + 0.5`) — так у GDAL, и тайлы автора это подтверждают.
/// Пиксели без данных и за краем источника (край мира или растра) пропускаются, вес нормируется.
pub fn downsample(source: &Raster, width: usize, height: usize) -> Raster {
    const WEIGHTS: [u32; 3] = [1, 2, 1];
    let mut values = Vec::with_capacity(width * height);
    for j in 0..height {
        for i in 0..width {
            let mut total = 0.0f64;
            let mut count = 0u32;
            for (b, weight_y) in WEIGHTS.iter().enumerate() {
                let y = 2 * j + b;
                if y >= source.height {
                    continue;
                }
                for (a, weight_x) in WEIGHTS.iter().enumerate() {
                    let x = 2 * i + a;
                    if x >= source.width {
                        continue;
                    }
                    let value = source.values[y * source.width + x];
                    if value == NODATA {
                        continue;
                    }
                    let weight = weight_x * weight_y;
                    total += f64::from(value) * f64::from(weight);
                    count += weight;
                }
            }
            if count == 0 {
                values.push(NODATA);
                continue;
            }
            values.push(round_overview((total / f64::from(count)) as f32));
        }
    }
    Raster {
        width,
        height,
        values,
    }
}

// `GDALCopyWord<float, short>`: `v ± 0.5f` в float32 и отбрасывание дробной части.
fn round_overview(value: f32) -> i16 {
    let shifted = if value >= 0.0 {
        value + 0.5
    } else {
        value - 0.5
    };
    shifted as i16
}

/// Тело тайла до сжатия: дельты `wrapping_sub`, первое значение — дельта от нуля.
pub fn encode(values: &[i16]) -> Vec<u8> {
    let mut raw = Vec::with_capacity(values.len() * 2);
    let mut previous = 0i16;
    for &value in values {
        raw.extend_from_slice(&value.wrapping_sub(previous).to_le_bytes());
        previous = value;
    }
    raw
}

/// Обратное `encode`, как `decodeElevations` клиента (префиксная сумма в `Int16Array`).
pub fn decode(raw: &[u8]) -> Vec<i16> {
    let mut previous = 0i16;
    let (pairs, _) = raw.as_chunks::<2>();
    pairs
        .iter()
        .map(|&pair| {
            previous = previous.wrapping_add(i16::from_le_bytes(pair));
            previous
        })
        .collect()
}

pub fn gzip(raw: &[u8]) -> Vec<u8> {
    let mut encoder =
        flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::new(GZIP_LEVEL));
    encoder.write_all(raw).expect("write to Vec");
    encoder.finish().expect("write to Vec")
}

pub fn gunzip(compressed: &[u8]) -> Result<Vec<u8>, Error> {
    let mut raw = Vec::new();
    flate2::read::GzDecoder::new(compressed)
        .read_to_end(&mut raw)
        .map_err(|_| Error::Format("bad gzip"))?;
    Ok(raw)
}

/// Готовое тело ответа для тайла 256×256.
pub fn encode_tile(tile: &Raster) -> Vec<u8> {
    assert_eq!((tile.width, tile.height), (SIZE, SIZE));
    gzip(&encode(&tile.values))
}

/// Разбор `{z}/{x}/{y}`; `None` — путь не тайла или координаты вне сетки зума.
pub fn parse_path(path: &str) -> Option<(u8, u32, u32)> {
    let mut parts = path.split('/');
    let mut number = || -> Option<u32> {
        let part = parts.next()?;
        // `u32::from_str` пускает `+1`; клиент такого не шлёт, а лишний путь к тому же тайлу не нужен
        if part.is_empty() || !part.bytes().all(|byte| byte.is_ascii_digit()) {
            return None;
        }
        part.parse().ok()
    };
    let z = number()?;
    let x = number()?;
    let y = number()?;
    if parts.next().is_some() || z > u32::from(MAX_ZOOM) {
        return None;
    }
    let z = z as u8;
    let side = 1u32 << z;
    if x >= side || y >= side {
        return None;
    }
    Some((z, x, y))
}
