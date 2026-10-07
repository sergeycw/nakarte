//! Пиксели z11 по кускам `dem3` — как `gdalwarp -t_srs EPSG:3857 -r bilinear` в генераторе автора
//! (растр 524 288², то есть z11, по HGT 3″, где центры пикселей HGT — узлы сетки):
//!
//! - высота в центре пикселя Web Mercator билинейно по четырём узлам (`GWKBilinearResample4Sample`);
//! - узлы без данных — войды HGT и значения ниже −430 (`prepare_raster.sh` превращает их в nodata) —
//!   выпадают, веса остальных нормируются на их сумму;
//! - если без данных ближайший узел, пиксель пуст: `GWKGeneralCaseThread` смотрит валидность только
//!   исходного пикселя, в который попала точка;
//! - округление `floor(v + 0.5)` (`GWKRoundValueT`).
//!
//! Узлы собираются в окно со всех кусков, которые его задевают, поэтому точки у края градуса и у
//! края покрытия считаются так же, как у автора по склеенному растру мира.

use std::collections::BTreeMap;
use std::f64::consts::PI;

use futures::stream::{self, StreamExt, TryStreamExt};

use crate::format::{self, HEADER_LEN, Header, NO_VALUE, SPLIT, TILE_SIZE};
use crate::tile::{NODATA, Raster, SIZE, downsample};
use crate::{Error, PARALLEL_READS, Source, grid};

pub const ZOOM: u8 = 11;
pub const WORLD_PIXELS: u64 = 256 << ZOOM;
// Узлов сетки 3″ на градус и на кусок (четверть градуса).
const NODES_PER_DEGREE: i64 = 1200;
const CHUNK_STEP: i64 = (TILE_SIZE - 1) as i64;
// `prepare_raster.sh`: `(A+512) * (A >= -430) - 512`.
const MIN_VALID: i16 = -430;
const EARTH_RADIUS: f64 = 6378137.0;

// Формулы — как в сверке с тайлами автора (через метры EPSG:3857), не упрощать: от порядка
// операций зависят последние биты, а с ними округление на границе.
pub fn pixel_lon(x: u64) -> f64 {
    let extent = PI * EARTH_RADIUS;
    let meters = -extent + (x as f64 + 0.5) / WORLD_PIXELS as f64 * 2.0 * extent;
    meters / EARTH_RADIUS * 180.0 / PI
}

pub fn pixel_lat(y: u64) -> f64 {
    let extent = PI * EARTH_RADIUS;
    let meters = extent - (y as f64 + 0.5) / WORLD_PIXELS as f64 * 2.0 * extent;
    (meters / EARTH_RADIUS).sinh().atan().to_degrees()
}

fn valid(value: i16) -> bool {
    value != NO_VALUE && value >= MIN_VALID
}

/// Положение пикселя между узлами: индекс узла слева (снизу) от начала окна и доля до следующего.
fn split(coordinate: f64, first_node: i64) -> (usize, f64) {
    let nodes = coordinate * NODES_PER_DEGREE as f64;
    let node = nodes.floor();
    ((node as i64 - first_node) as usize, nodes - node)
}

struct Window {
    lon_node: i64,
    lat_node: i64,
    width: usize,
    height: usize,
    // строки с юга, как в кусках
    values: Vec<i16>,
}

impl Window {
    fn at(&self, x: usize, y: usize) -> i16 {
        self.values[y * self.width + x]
    }

    // Узел на стыке кусков или градусов есть в обоих. Внутри градуса значения одинаковы, а у
    // соседних HGT общая строка или столбец расходится (N42E044/N43E044 — в 812 узлах из 1204).
    // Автор склеивал HGT в один растр, и на стыке остался файл, последний по алфавиту имени
    // (N43 поверх N42, E045 поверх E044, S34 поверх S33, W071 поверх W070), — сверено с его
    // тайлами 2026-10-07. Куски приходят в порядке ключей, поэтому последнее значение с данными побеждает.
    fn fill(&mut self, quarter_lon: i64, quarter_lat: i64, chunk: &[i16]) {
        for row in 0..TILE_SIZE {
            let y = quarter_lat * CHUNK_STEP + row as i64 - self.lat_node;
            if y < 0 || y >= self.height as i64 {
                continue;
            }
            for column in 0..TILE_SIZE {
                let x = quarter_lon * CHUNK_STEP + column as i64 - self.lon_node;
                if x < 0 || x >= self.width as i64 {
                    continue;
                }
                let value = chunk[row * TILE_SIZE + column];
                if value != NO_VALUE {
                    self.values[y as usize * self.width + x as usize] = value;
                }
            }
        }
    }

    fn sample(&self, (x, dx): (usize, f64), (y, dy): (usize, f64)) -> i16 {
        let nodes = [
            self.at(x, y),
            self.at(x + 1, y),
            self.at(x, y + 1),
            self.at(x + 1, y + 1),
        ];
        let nearest = usize::from(dx >= 0.5) + 2 * usize::from(dy >= 0.5);
        if !valid(nodes[nearest]) {
            return NODATA;
        }
        let weights = [
            (1.0 - dx) * (1.0 - dy),
            dx * (1.0 - dy),
            (1.0 - dx) * dy,
            dx * dy,
        ];
        let mut total = 0.0;
        let mut weight = 0.0;
        for (node, node_weight) in nodes.iter().zip(weights) {
            if valid(*node) {
                total += f64::from(*node) * node_weight;
                weight += node_weight;
            }
        }
        (total / weight + 0.5).floor() as i16
    }
}

/// Пиксели z11 `[x0, x0 + width) × [y0, y0 + height)` в координатах всего мира; за краем мира — `NODATA`.
pub async fn render<S: Source>(
    source: &S,
    x0: u64,
    y0: u64,
    width: usize,
    height: usize,
) -> Result<Raster, Error> {
    let mut raster = Raster::empty(width, height);
    let columns = (x0..x0 + width as u64).take_while(|&x| x < WORLD_PIXELS);
    let rows = (y0..y0 + height as u64).take_while(|&y| y < WORLD_PIXELS);
    let lons: Vec<f64> = columns.map(pixel_lon).collect();
    let lats: Vec<f64> = rows.map(pixel_lat).collect();
    let (Some(&west), Some(&east), Some(&north), Some(&south)) =
        (lons.first(), lons.last(), lats.first(), lats.last())
    else {
        return Ok(raster);
    };

    let node = |degrees: f64| (degrees * NODES_PER_DEGREE as f64).floor() as i64;
    let mut window = Window {
        lon_node: node(west),
        lat_node: node(south),
        width: (node(east) + 2 - node(west)) as usize,
        height: (node(north) + 2 - node(south)) as usize,
        values: Vec::new(),
    };
    window.values = vec![NO_VALUE; window.width * window.height];

    // Куски (четверти градуса), чьи узлы [q·300, q·300 + 300] задевают окно.
    let quarters = |first: i64, count: usize, limit: i64| {
        let last = first + count as i64 - 1;
        // нижняя граница — ceil((first − 300) / 300): узел на стыке берётся и из куска, где он последний
        ((first - 1).div_euclid(CHUNK_STEP)..=last.div_euclid(CHUNK_STEP))
            .filter(move |quarter| (-limit..limit).contains(quarter))
    };
    let split_degrees = SPLIT as i64;
    let mut degrees: BTreeMap<String, Vec<(usize, i64, i64)>> = BTreeMap::new();
    for quarter_lat in quarters(window.lat_node, window.height, 90 * split_degrees) {
        for quarter_lon in quarters(window.lon_node, window.width, 180 * split_degrees) {
            let key = grid::object_key(
                quarter_lat.div_euclid(split_degrees) as i32,
                quarter_lon.div_euclid(split_degrees) as i32,
            );
            let chunk = (quarter_lat.rem_euclid(split_degrees) * split_degrees
                + quarter_lon.rem_euclid(split_degrees)) as usize;
            degrees
                .entry(key)
                .or_default()
                .push((chunk, quarter_lon, quarter_lat));
        }
    }

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
        for &(chunk, quarter_lon, quarter_lat) in &degrees[key] {
            if let Some(range) = header.chunk_range(chunk) {
                reads.push((key.as_str(), range, quarter_lon, quarter_lat));
            }
        }
    }
    if reads.is_empty() {
        return Ok(raster);
    }
    // `buffered`, а не `buffer_unordered`: порядок кусков = порядок ключей, от него зависит `fill`.
    let mut chunks = stream::iter(reads)
        .map(
            |(key, (offset, length), quarter_lon, quarter_lat)| async move {
                let bytes = source
                    .read(key, offset, length)
                    .await?
                    .ok_or_else(|| Error::Source(format!("{key} disappeared")))?;
                Ok::<_, Error>((bytes, quarter_lon, quarter_lat))
            },
        )
        .buffered(PARALLEL_READS);
    while let Some((bytes, quarter_lon, quarter_lat)) = chunks.try_next().await? {
        window.fill(quarter_lon, quarter_lat, &format::decode_chunk(&bytes)?);
    }

    let columns: Vec<(usize, f64)> = lons
        .iter()
        .map(|&lon| split(lon, window.lon_node))
        .collect();
    for (row, &lat) in lats.iter().enumerate() {
        let y = split(lat, window.lat_node);
        let line = &mut raster.values[row * width..row * width + columns.len()];
        for (value, &x) in line.iter_mut().zip(&columns) {
            *value = window.sample(x, y);
        }
    }
    Ok(raster)
}

/// Сторона растра уровня ниже, из которого `downsample` получает `size` пикселей: окно последнего
/// пикселя — `2(size − 1) .. 2(size − 1) + 2`.
pub fn source_size(size: usize) -> usize {
    2 * size + 1
}

/// Тайл `z ≤ 11` каскадом от z11: растр z11 со сторожевой полосой справа и снизу, затем
/// `downsample` по уровням. Тот же путь, что у генератора архива, поэтому значения совпадают.
pub async fn tile<S: Source>(source: &S, z: u8, x: u32, y: u32) -> Result<Raster, Error> {
    let levels = u32::from(ZOOM - z);
    let mut sizes = vec![SIZE];
    for _ in 0..levels {
        sizes.push(source_size(*sizes.last().unwrap()));
    }
    let side = sizes.pop().unwrap();
    let mut raster = render(
        source,
        (u64::from(x) * SIZE as u64) << levels,
        (u64::from(y) * SIZE as u64) << levels,
        side,
        side,
    )
    .await?;
    while let Some(size) = sizes.pop() {
        raster = downsample(&raster, size, size);
    }
    Ok(raster)
}
