// Тайлы высот: кодирование, каскад, архив, HTTP и контрактный тест с тайлами автора.
// Эталоны `fixtures/tiles/{z}-{x}-{y}.gz` — тела `tiles.nakarte.me/elevation` как есть (gzip),
// сняты 2026-10-07; DEM для них — прореженные `fixtures/dem3/*` (`elevation-tiles thin`).

mod common;

use std::io::Cursor;

use common::{MemorySource, degree_from_fn, fixtures_dir};
use elevation_core::archive::{self, Lookup, Writer};
use elevation_core::http::{self, Request};
use elevation_core::render;
use elevation_core::tile::{
    NODATA, Raster, SIZE, decode, downsample, encode, encode_tile, gunzip, parse_path,
};
use futures::executor::block_on;

fn author_tile(z: u8, x: u32, y: u32) -> Raster {
    let path = fixtures_dir().join(format!("tiles/{z}-{x}-{y}.gz"));
    let raw = gunzip(&std::fs::read(&path).unwrap()).unwrap();
    assert_eq!(raw.len(), SIZE * SIZE * 2, "{}", path.display());
    Raster {
        width: SIZE,
        height: SIZE,
        values: decode(&raw),
    }
}

fn mismatches(expected: &Raster, actual: &Raster) -> Vec<(usize, usize, i16, i16)> {
    let mut result = Vec::new();
    for y in 0..expected.height {
        for x in 0..expected.width {
            let (e, a) = (expected.get(x, y), actual.get(x, y));
            if e != a {
                result.push((x, y, e, a));
            }
        }
    }
    result
}

fn get(path: &str, source: &MemorySource) -> http::Response {
    let request = Request {
        method: "GET",
        path,
        origin: None,
        content_length: None,
        request_headers: None,
        body: b"",
    };
    block_on(http::handle(
        &request,
        &["https://nakarte-routing.pages.dev"],
        source,
    ))
}

#[test]
fn encoding_roundtrips_like_client_prefix_sum() {
    let values: Vec<i16> = (0..SIZE * SIZE)
        .map(|i| match i % 7 {
            0 => NODATA,
            1 => i16::MAX,
            2 => i16::MIN,
            _ => (i as i16).wrapping_mul(31),
        })
        .collect();
    let raw = encode(&values);
    assert_eq!(raw.len(), 131_072);
    assert_eq!(decode(&raw), values);
    let tile = Raster {
        width: SIZE,
        height: SIZE,
        values: values.clone(),
    };
    assert_eq!(decode(&gunzip(&encode_tile(&tile)).unwrap()), values);
}

#[test]
fn downsample_uses_shifted_1_2_1_window_and_skips_nodata() {
    // Источник 5×3: пиксель 0 берёт столбцы 0..=2, пиксель 1 — 2..=4; строка 0 — строки 0..=2.
    let source = Raster {
        width: 5,
        height: 3,
        values: vec![
            10, 20, 30, 40, 50, //
            10, 20, 30, 40, 50, //
            10, 20, 30, 40, 50, //
        ],
    };
    let result = downsample(&source, 2, 1);
    assert_eq!(result.values, vec![20, 40]);

    // nodata и край растра выпадают, вес нормируется: из окна остаётся только (0, 0) с весом 1
    // и (1, 0) с весом 2 → (1·10 + 2·40) / 3 = 30
    let edge = Raster {
        width: 2,
        height: 1,
        values: vec![10, 40],
    };
    assert_eq!(downsample(&edge, 1, 1).values, vec![30]);
    assert_eq!(downsample(&Raster::empty(3, 3), 1, 1).values, vec![NODATA]);
}

#[test]
fn downsample_rounds_halves_away_from_zero() {
    // (−2·1 + −3·1) / 2 = −2.5 → −3; (2 + 3) / 2 = 2.5 → 3
    let negative = Raster {
        width: 3,
        height: 1,
        values: vec![-2, NODATA, -3],
    };
    assert_eq!(downsample(&negative, 1, 1).values, vec![-3]);
    let positive = Raster {
        width: 3,
        height: 1,
        values: vec![2, NODATA, 3],
    };
    assert_eq!(downsample(&positive, 1, 1).values, vec![3]);
}

#[test]
fn parses_tile_paths() {
    assert_eq!(parse_path("11/1277/754"), Some((11, 1277, 754)));
    assert_eq!(parse_path("0/0/0"), Some((0, 0, 0)));
    for bad in [
        "12/0/0",
        "1/2/0",
        "1/0/2",
        "11/1277",
        "11/1277/754/1",
        "a/b/c",
        "+1/0/0",
        "",
        "1//0",
    ] {
        assert_eq!(parse_path(bad), None, "{bad}");
    }
}

#[test]
fn renders_constant_degree_and_hides_values_below_minus_430() {
    let mut source = MemorySource::default();
    // N00E000 — 100 м, N00E001 — −500 м (ниже порога автора −430)
    source
        .objects
        .insert("dem3/N00E000".into(), degree_from_fn(|_, _| 100));
    source
        .objects
        .insert("dem3/N00E001".into(), degree_from_fn(|_, _| -500));
    // z11 тайл 1024/1023 — сразу севернее экватора у нулевого меридиана, внутри N00E000
    let tile = block_on(render::tile(&source, 11, 1024, 1023)).unwrap();
    assert!(tile.values.iter().all(|&value| value == 100));
    // 1030/1023 — внутри N00E001
    let low = block_on(render::tile(&source, 11, 1030, 1023)).unwrap();
    assert!(!low.has_data());
}

#[test]
fn matches_author_tiles_at_z11_and_z10() {
    let source = MemorySource::from_dir(&fixtures_dir());
    for (z, x, y) in [
        (11, 1277, 754), // Казбек
        (11, 1265, 749), // Эльбрус
        (11, 1260, 763), // Батуми, побережье
        (11, 1225, 835), // Мёртвое море: войды HGT и высоты ниже нуля
        (11, 1223, 752), // Чёрное море: край покрытия по 43° с.ш., вода 0 и −512
        (11, 1277, 752), // стык N42E044 и N43E044: на общей строке узлов — значения N43
        (11, 625, 1222), // Анды, стык W070 и W071: значения W071
        (11, 625, 1223), // Анды, стык S33 и S34 (и W070/W071): значения S34
        (10, 638, 377),  // Казбек, каскад от z11
    ] {
        let actual = block_on(render::tile(&source, z, x, y)).unwrap();
        let wrong = mismatches(&author_tile(z, x, y), &actual);
        assert!(
            wrong.is_empty(),
            "{z}/{x}/{y}: {} pixels differ, first {:?}",
            wrong.len(),
            &wrong[..wrong.len().min(5)]
        );
    }
}

#[test]
fn matches_author_cascade_from_z1_to_z0() {
    let mut z1 = Raster::empty(2 * SIZE, 2 * SIZE);
    for ty in 0..2 {
        for tx in 0..2 {
            let tile = author_tile(1, tx, ty);
            for row in 0..SIZE {
                let target = (ty as usize * SIZE + row) * z1.width + tx as usize * SIZE;
                z1.values[target..target + SIZE]
                    .copy_from_slice(&tile.values[row * SIZE..(row + 1) * SIZE]);
            }
        }
    }
    let wrong = mismatches(&author_tile(0, 0, 0), &downsample(&z1, SIZE, SIZE));
    assert!(
        wrong.is_empty(),
        "{} pixels differ, first {:?}",
        wrong.len(),
        &wrong[..wrong.len().min(5)]
    );
}

fn archive_source() -> (MemorySource, Vec<u8>) {
    let body = std::fs::read(fixtures_dir().join("tiles/0-0-0.gz")).unwrap();
    let mut writer = Writer::new(Cursor::new(Vec::new()), 9).unwrap();
    writer.add(0, 0, 0, &body).unwrap();
    writer.add(9, 511, 511, b"last").unwrap();
    assert_eq!(writer.tiles(), 2);
    let mut source = MemorySource::from_dir(&fixtures_dir());
    source
        .objects
        .insert(archive::KEY.into(), writer.finish().unwrap().into_inner());
    (source, body)
}

#[test]
fn archive_reads_tiles_gaps_and_zooms_above_max() {
    assert_eq!(archive::tile_index(0, 0, 0), 0);
    assert_eq!(archive::tile_index(1, 0, 0), 1);
    assert_eq!(archive::tile_index(2, 3, 1), 5 + 4 + 3);
    assert_eq!(archive::entry_count(9), 349_525);

    let (source, body) = archive_source();
    assert_eq!(
        block_on(archive::read(&source, 0, 0, 0)).unwrap(),
        Lookup::Tile(body)
    );
    assert_eq!(
        block_on(archive::read(&source, 9, 511, 511)).unwrap(),
        Lookup::Tile(b"last".to_vec())
    );
    assert_eq!(
        block_on(archive::read(&source, 5, 1, 1)).unwrap(),
        Lookup::Missing
    );
    assert_eq!(
        block_on(archive::read(&source, 10, 0, 0)).unwrap(),
        Lookup::NotCovered
    );
    assert_eq!(
        block_on(archive::read(&MemorySource::default(), 0, 0, 0)).unwrap(),
        Lookup::NotCovered
    );
}

#[test]
fn serves_tiles_with_author_headers_without_origin() {
    let (source, body) = archive_source();

    let archived = get("/tiles/0/0/0", &source);
    assert_eq!(archived.status, 200);
    assert_eq!(archived.body, body);
    assert_eq!(archived.header("Content-Encoding"), Some("gzip"));
    assert_eq!(archived.header("Access-Control-Allow-Origin"), Some("*"));
    assert_eq!(archived.header("Cache-Control"), Some("max-age=86400"));

    let live = get("/tiles/11/1277/754", &source);
    assert_eq!(live.status, 200);
    let raster = Raster {
        width: SIZE,
        height: SIZE,
        values: decode(&gunzip(&live.body).unwrap()),
    };
    assert!(mismatches(&author_tile(11, 1277, 754), &raster).is_empty());
}

#[test]
fn answers_404_for_ocean_missing_and_bad_tiles() {
    let (source, _) = archive_source();
    for path in [
        "/tiles/11/796/844", // Атлантика: градусов нет
        "/tiles/10/398/422",
        "/tiles/5/1/1", // позиция в архиве пустая
        "/tiles/12/2554/1508",
        "/tiles/1/2/0",
        "/tiles/abc",
    ] {
        let response = get(path, &source);
        assert_eq!(response.status, 404, "{path}");
        assert_eq!(
            response.header("Access-Control-Allow-Origin"),
            Some("*"),
            "{path}"
        );
    }
    let post = block_on(http::handle(
        &Request {
            method: "POST",
            path: "/tiles/0/0/0",
            origin: None,
            content_length: None,
            request_headers: None,
            body: b"",
        },
        &[],
        &source,
    ));
    assert_eq!(post.status, 405);
}
