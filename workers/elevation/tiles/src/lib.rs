//! Генератор архива тайлов высот z0–9 (`elevation_core::archive`) из объектов `<data>/dem3/<градус>`.
//!
//! Мир обрабатывается блоками по тайлу z5: растр z11 блока со сторожевой полосой справа и снизу
//! (16 447 пикселей вместо 16 384 — столько нужно каскаду `downsample` до z5), затем z10…z5 тем же
//! кодом, что Worker на лету; тайлы z5–9 блока сжимаются и дописываются в архив, а тайл z5 — в
//! мировой растр z5 (8192², 128 МБ), из которого в конце строятся z0–4. Блоки без градусов
//! пропускаются: там всё `NODATA`, как над океаном у автора.

use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::fs::File;
use std::io::{BufWriter, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

use elevation_core::archive::Writer;
use elevation_core::format::{self, CHUNKS, HEADER_LEN, Header};
use elevation_core::render::{self, WORLD_PIXELS, pixel_lat, pixel_lon, source_size};
use elevation_core::tile::{self, Raster, SIZE, downsample};
use elevation_core::{Error, Source};

pub const BLOCK_ZOOM: u8 = 5;
pub const ARCHIVE_MAX_ZOOM: u8 = tile::LIVE_MIN_ZOOM - 1;
// Строк z11 на один вызов `render`: окно узлов полосы ~20 МБ, куски на стыке полос читаются дважды.
const STRIP_ROWS: usize = 1024;

pub struct FileSource {
    pub root: PathBuf,
}

impl Source for FileSource {
    async fn read(&self, key: &str, offset: u64, length: u64) -> Result<Option<Vec<u8>>, Error> {
        let source_error = |error: std::io::Error| Error::Source(format!("{key}: {error}"));
        let mut file = match File::open(self.root.join(key)) {
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

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Bbox {
    pub west: f64,
    pub south: f64,
    pub east: f64,
    pub north: f64,
}

impl Bbox {
    pub fn parse(text: &str) -> Option<Bbox> {
        let values: Vec<f64> = text
            .split(',')
            .map(|part| part.trim().parse().ok())
            .collect::<Option<_>>()?;
        let [west, south, east, north] = values[..] else {
            return None;
        };
        (west < east && south < north).then_some(Bbox {
            west,
            south,
            east,
            north,
        })
    }

    fn intersects(&self, other: &Bbox) -> bool {
        self.west < other.east
            && other.west < self.east
            && self.south < other.north
            && other.south < self.north
    }
}

pub struct Options {
    pub max_zoom: u8,
    pub bbox: Option<Bbox>,
    pub threads: usize,
}

#[derive(Debug, Default)]
pub struct Report {
    pub blocks: usize,
    pub tiles: BTreeMap<u8, (usize, u64)>,
}

/// Градусы из имён файлов `dem3/N43E042` → `(lat0, lon0)`.
pub fn list_degrees(data: &Path) -> std::io::Result<HashSet<(i32, i32)>> {
    let mut degrees = HashSet::new();
    for entry in std::fs::read_dir(data.join("dem3"))? {
        let name = entry?.file_name().to_string_lossy().to_ascii_uppercase();
        if let Some(degree) = parse_degree(&name) {
            degrees.insert(degree);
        }
    }
    Ok(degrees)
}

fn parse_degree(name: &str) -> Option<(i32, i32)> {
    let bytes = name.as_bytes();
    if name.len() != 7 || !matches!(bytes[0], b'N' | b'S') || !matches!(bytes[3], b'E' | b'W') {
        return None;
    }
    let lat: i32 = name[1..3].parse().ok()?;
    let lon: i32 = name[4..7].parse().ok()?;
    Some((
        if bytes[0] == b'S' { -lat } else { lat },
        if bytes[3] == b'W' { -lon } else { lon },
    ))
}

/// Границы пикселей z11 `[x0, x0 + side) × [y0, y0 + side)` в градусах, по центрам крайних пикселей.
fn pixels_bbox(x0: u64, y0: u64, side: u64) -> Bbox {
    let last = WORLD_PIXELS - 1;
    Bbox {
        west: pixel_lon(x0),
        east: pixel_lon((x0 + side - 1).min(last)),
        north: pixel_lat(y0),
        south: pixel_lat((y0 + side - 1).min(last)),
    }
}

fn has_degrees(degrees: &HashSet<(i32, i32)>, bbox: &Bbox) -> bool {
    // градус задевает и соседние узлы, поэтому с запасом в градус
    let lats = bbox.south.floor() as i32 - 1..=bbox.north.floor() as i32 + 1;
    lats.into_iter().any(|lat| {
        (bbox.west.floor() as i32 - 1..=bbox.east.floor() as i32 + 1)
            .any(|lon| degrees.contains(&(lat, lon)))
    })
}

fn run_parallel<T: Send>(count: usize, threads: usize, job: impl Fn(usize) -> T + Sync) -> Vec<T> {
    let next = AtomicUsize::new(0);
    let results = Mutex::new((0..count).map(|_| None).collect::<Vec<Option<T>>>());
    std::thread::scope(|scope| {
        for _ in 0..threads.max(1) {
            scope.spawn(|| {
                loop {
                    let index = next.fetch_add(1, Ordering::Relaxed);
                    if index >= count {
                        break;
                    }
                    let result = job(index);
                    results.lock().unwrap()[index] = Some(result);
                }
            });
        }
    });
    results
        .into_inner()
        .unwrap()
        .into_iter()
        .map(|result| result.expect("job result"))
        .collect()
}

/// Растр z11 полосами параллельно: будущее `render` не `Send` (как и трейт `Source`), поэтому
/// каждая полоса крутится своим `block_on` в своём потоке.
fn render_parallel(
    source: &FileSource,
    x0: u64,
    y0: u64,
    side: usize,
    threads: usize,
) -> Result<Raster, Error> {
    let strips = side.div_ceil(STRIP_ROWS);
    let parts = run_parallel(strips, threads, |strip| {
        let start = strip * STRIP_ROWS;
        let rows = STRIP_ROWS.min(side - start);
        futures::executor::block_on(render::render(source, x0, y0 + start as u64, side, rows))
    });
    let mut values = Vec::with_capacity(side * side);
    for part in parts {
        values.extend(part?.values);
    }
    Ok(Raster {
        width: side,
        height: side,
        values,
    })
}

struct Sink<'a> {
    writer: Writer<BufWriter<File>>,
    report: &'a mut Report,
    threads: usize,
}

impl Sink<'_> {
    /// Тайлы `256 × 256` из левого верхнего угла `raster` (остальное — сторожевая полоса) с номерами
    /// от `(x0, y0)`: пустые пропускаются, остальные сжимаются параллельно.
    fn add_level(
        &mut self,
        z: u8,
        raster: &Raster,
        x0: u32,
        y0: u32,
        count: u32,
    ) -> std::io::Result<()> {
        let positions: Vec<(u32, u32)> = (0..count)
            .flat_map(|ty| (0..count).map(move |tx| (tx, ty)))
            .collect();
        let bodies = run_parallel(positions.len(), self.threads, |index| {
            let (tx, ty) = positions[index];
            let tile = raster.crop(tx as usize * SIZE, ty as usize * SIZE, SIZE, SIZE);
            tile.has_data().then(|| tile::encode_tile(&tile))
        });
        for (&(tx, ty), body) in positions.iter().zip(bodies) {
            let Some(body) = body else {
                continue;
            };
            self.writer.add(z, x0 + tx, y0 + ty, &body)?;
            let entry = self.report.tiles.entry(z).or_default();
            entry.0 += 1;
            entry.1 += body.len() as u64;
        }
        Ok(())
    }
}

pub fn build(data: &Path, out: &Path, options: &Options) -> std::io::Result<Report> {
    assert!(
        (BLOCK_ZOOM..=ARCHIVE_MAX_ZOOM).contains(&options.max_zoom),
        "max zoom must be {BLOCK_ZOOM}..={ARCHIVE_MAX_ZOOM}"
    );
    let degrees = list_degrees(data)?;
    let source = FileSource {
        root: data.to_path_buf(),
    };
    let mut report = Report::default();
    let mut sink = Sink {
        writer: Writer::new(BufWriter::new(File::create(out)?), options.max_zoom)?,
        report: &mut report,
        threads: options.threads,
    };

    // Каскад z11 → z5 для одного тайла z5: стороны 16447, 8223, …, 513, 256.
    let levels = u32::from(render::ZOOM - BLOCK_ZOOM);
    let mut sides = vec![SIZE];
    for _ in 0..levels {
        sides.push(source_size(*sides.last().unwrap()));
    }
    let block_pixels = (SIZE as u64) << levels;
    let blocks_per_side = 1u32 << BLOCK_ZOOM;
    let mut world = Raster::empty(SIZE << BLOCK_ZOOM, SIZE << BLOCK_ZOOM);
    let started = Instant::now();

    for block_y in 0..blocks_per_side {
        for block_x in 0..blocks_per_side {
            let x0 = u64::from(block_x) * block_pixels;
            let y0 = u64::from(block_y) * block_pixels;
            let side = *sides.last().unwrap();
            let extent = pixels_bbox(x0, y0, side as u64);
            if options
                .bbox
                .is_some_and(|bbox| !bbox.intersects(&pixels_bbox(x0, y0, block_pixels)))
                || !has_degrees(&degrees, &extent)
            {
                continue;
            }
            let block_started = Instant::now();
            let mut raster = render_parallel(&source, x0, y0, side, options.threads)
                .map_err(std::io::Error::other)?;
            for (index, &size) in sides.iter().rev().skip(1).enumerate() {
                raster = downsample(&raster, size, size);
                let z = render::ZOOM - 1 - index as u8;
                if z <= options.max_zoom {
                    let scale = 1u32 << (z - BLOCK_ZOOM);
                    sink.add_level(z, &raster, block_x * scale, block_y * scale, scale)?;
                }
            }
            for row in 0..SIZE {
                let target =
                    (block_y as usize * SIZE + row) * world.width + block_x as usize * SIZE;
                world.values[target..target + SIZE]
                    .copy_from_slice(&raster.values[row * SIZE..(row + 1) * SIZE]);
            }
            sink.report.blocks += 1;
            eprintln!(
                "block 5/{block_x}/{block_y}: {:.1} s, total {:.0} s",
                block_started.elapsed().as_secs_f64(),
                started.elapsed().as_secs_f64()
            );
        }
    }

    // z4…z0 из мирового растра z5: за краем мира `downsample` сам пропускает пиксели.
    let mut raster = world;
    for z in (0..BLOCK_ZOOM).rev() {
        let side = SIZE << z;
        raster = downsample(&raster, side, side);
        sink.add_level(z, &raster, 0, 0, 1 << z)?;
    }
    sink.writer.finish()?;
    Ok(report)
}

/// Источник, который запоминает прочитанные диапазоны: по ним `thin` понимает, какие куски нужны.
struct Recording<'a> {
    inner: &'a FileSource,
    reads: RefCell<BTreeSet<(String, u64)>>,
}

impl Source for Recording<'_> {
    async fn read(&self, key: &str, offset: u64, length: u64) -> Result<Option<Vec<u8>>, Error> {
        let bytes = self.inner.read(key, offset, length).await?;
        if bytes.is_some() {
            self.reads.borrow_mut().insert((key.to_string(), offset));
        }
        Ok(bytes)
    }
}

/// Прореженные фикстуры `<fixtures>/dem3/*`: из объектов `<data>/dem3/*` только куски, которые
/// читает расчёт перечисленных тайлов, плюс куски, уже лежащие в фикстуре (их берут эталоны API).
pub fn thin(data: &Path, fixtures: &Path, tiles: &[(u8, u32, u32)]) -> Result<Vec<String>, Error> {
    let source = FileSource {
        root: data.to_path_buf(),
    };
    let recording = Recording {
        inner: &source,
        reads: RefCell::new(BTreeSet::new()),
    };
    for &(z, x, y) in tiles {
        futures::executor::block_on(render::tile(&recording, z, x, y))?;
    }
    let io_error =
        |path: &Path, error: std::io::Error| Error::Source(format!("{}: {error}", path.display()));
    let mut wanted: BTreeMap<String, BTreeSet<u64>> = BTreeMap::new();
    for (key, offset) in recording.reads.into_inner() {
        wanted.entry(key).or_default().insert(offset);
    }
    let mut written = Vec::new();
    for (key, offsets) in wanted {
        let object_path = data.join(&key);
        let object = std::fs::read(&object_path).map_err(|error| io_error(&object_path, error))?;
        let header = Header::parse(&object[..HEADER_LEN])?;
        let fixture_path = fixtures.join(&key);
        let existing = match std::fs::read(&fixture_path) {
            Ok(bytes) => Some(bytes),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => return Err(io_error(&fixture_path, error)),
        };
        let existing_header = existing
            .as_ref()
            .map(|bytes| Header::parse(&bytes[..HEADER_LEN]))
            .transpose()?;
        let chunks: Vec<Vec<u8>> = (0..CHUNKS)
            .map(|chunk| {
                let kept = existing_header
                    .as_ref()
                    .and_then(|header| header.chunk_range(chunk))
                    .map(|(offset, length)| {
                        existing.as_ref().unwrap()[offset as usize..(offset + length) as usize]
                            .to_vec()
                    });
                if let Some(bytes) = kept {
                    return bytes;
                }
                match header.chunk_range(chunk) {
                    Some((offset, length)) if offsets.contains(&offset) => {
                        object[offset as usize..(offset + length) as usize].to_vec()
                    }
                    _ => Vec::new(),
                }
            })
            .collect();
        let kept = chunks.iter().filter(|chunk| !chunk.is_empty()).count();
        std::fs::write(&fixture_path, format::assemble_degree(&chunks))
            .map_err(|error| io_error(&fixture_path, error))?;
        written.push(format!("{key}: {kept} chunks"));
    }
    Ok(written)
}
