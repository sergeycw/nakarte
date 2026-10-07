mod common;

use common::{MemorySource, degree_from_fn};
use elevation_core::format::{
    CHUNK_VALUES, CHUNKS, HEADER_LEN, Header, NO_VALUE, decode_chunk, encode_degree,
};
use elevation_core::grid::{locate, object_key};
use elevation_core::request::{MAX_POINTS, ParseError, parse_points};
use elevation_core::response::{format_elevation, format_elevations};
use elevation_core::{Error, elevations};
use futures::executor::block_on;

fn node_value(gx: usize, gy: usize) -> i16 {
    (gx as i16) * 3 + (gy as i16) * 2 - 1000
}

fn synthetic_source() -> MemorySource {
    let mut source = MemorySource::default();
    source
        .objects
        .insert("dem3/N43E042".to_string(), degree_from_fn(node_value));
    source.objects.insert(
        "dem3/S33W071".to_string(),
        degree_from_fn(|gx, gy| (gx + gy) as i16),
    );
    source
}

fn lookup(source: &MemorySource, points: &[(f64, f64)]) -> Vec<Option<f64>> {
    block_on(elevations(source, points)).unwrap()
}

#[test]
fn degree_object_roundtrip() {
    let object = degree_from_fn(node_value);
    let header = Header::parse(&object[..HEADER_LEN]).unwrap();
    for chunk in 0..CHUNKS {
        let (offset, length) = header.chunk_range(chunk).unwrap();
        let values = decode_chunk(&object[offset as usize..(offset + length) as usize]).unwrap();
        assert_eq!(values.len(), CHUNK_VALUES);
        let (dy, dx) = (chunk / 4, chunk % 4);
        assert_eq!(values[0], node_value(dx * 300, dy * 300));
        assert_eq!(
            values[CHUNK_VALUES - 1],
            node_value(dx * 300 + 300, dy * 300 + 300)
        );
    }
    assert_eq!(
        header.chunk_range(CHUNKS - 1).unwrap().0 + header.chunk_range(CHUNKS - 1).unwrap().1,
        object.len() as u64
    );
}

#[test]
fn nodata_and_wrapping_deltas_survive_roundtrip() {
    let mut values = vec![0i16; CHUNK_VALUES];
    values[0] = NO_VALUE;
    values[1] = i16::MAX;
    values[2] = NO_VALUE;
    values[3] = 8848;
    let mut chunks = vec![None; CHUNKS];
    chunks[5] = Some(values.clone());
    let object = encode_degree(&chunks, 3);
    let header = Header::parse(&object[..HEADER_LEN]).unwrap();
    assert_eq!(header.chunk_range(0), None);
    let (offset, length) = header.chunk_range(5).unwrap();
    assert_eq!(
        decode_chunk(&object[offset as usize..(offset + length) as usize]).unwrap(),
        values
    );
}

#[test]
fn bad_header_is_rejected() {
    let mut object = degree_from_fn(node_value);
    object[0] = b'X';
    assert_eq!(
        Header::parse(&object[..HEADER_LEN]),
        Err(Error::Format("bad header"))
    );
    assert!(Header::parse(&object[..10]).is_err());
}

#[test]
fn object_keys_follow_hgt_names() {
    assert_eq!(object_key(43, 42), "dem3/N43E042");
    assert_eq!(object_key(-33, -71), "dem3/S33W071");
    assert_eq!(object_key(0, -1), "dem3/N00W001");
    assert_eq!(object_key(-1, 0), "dem3/S01E000");
}

#[test]
fn locate_matches_author_tiles() {
    let cell = locate(43.35, 42.44).unwrap();
    assert_eq!((cell.lat0, cell.lon0, cell.chunk), (43, 42, 5));
    assert!((cell.ix as f64 + cell.dx - 228.0).abs() < 1e-6);
    assert!((cell.iy as f64 + cell.dy - 120.0).abs() < 1e-6);

    let cell = locate(-32.65, -70.01).unwrap();
    assert_eq!((cell.lat0, cell.lon0), (-33, -71));
    assert_eq!(cell.chunk, 7);

    let cell = locate(-90.0, 0.0).unwrap();
    assert_eq!((cell.lat0, cell.iy, cell.dy), (-90, 0, 0.0));
}

#[test]
fn points_outside_grid_have_no_cell() {
    for (lat, lon) in [
        (90.0, 0.0),
        (90.5, 0.0),
        (-90.1, 0.0),
        (43.0, 180.0),
        (43.0, -180.1),
        (43.0, 202.44),
    ] {
        assert_eq!(locate(lat, lon), None, "{lat} {lon}");
    }
    assert_eq!(locate(f64::NAN, 0.0), None);
    assert_eq!(locate(0.0, f64::INFINITY), None);
}

#[test]
fn node_returns_its_value() {
    let source = synthetic_source();
    let lat = 43.0 + 120.0 / 1200.0;
    let lon = 42.0 + 528.0 / 1200.0;
    assert_eq!(
        format_elevations(&lookup(&source, &[(lat, lon)])),
        format_elevation(Some(f64::from(node_value(528, 120))))
    );
}

#[test]
fn midpoint_between_nodes_is_their_mean() {
    let mut source = MemorySource::default();
    source.objects.insert(
        "dem3/N43E042".to_string(),
        degree_from_fn(|gx, _| {
            if gx == 100 {
                100
            } else if gx == 101 {
                200
            } else {
                0
            }
        }),
    );
    let lat = 43.0 + 600.0 / 1200.0;
    let lon = 42.0 + 100.5 / 1200.0;
    assert_eq!(format_elevations(&lookup(&source, &[(lat, lon)])), "150.00");
}

#[test]
fn chunk_and_degree_edges_use_the_right_chunk() {
    let source = synthetic_source();
    let points = [
        (43.25, 42.0),
        (43.0, 42.25),
        (43.0, 42.0),
        (43.5, 42.75),
        (43.999999, 42.999999),
    ];
    assert_eq!(
        format_elevations(&lookup(&source, &points)),
        "-400.00\n-100.00\n-1000.00\n2900.00\n4999.99"
    );
}

#[test]
fn southern_and_western_hemispheres() {
    let source = synthetic_source();
    let values = lookup(&source, &[(-33.0 + 0.5, -71.0 + 0.25)]);
    assert_eq!(values, vec![Some(f64::from((300 + 600) as i16))]);
}

#[test]
fn nodata_neighbor_gives_null() {
    let mut source = MemorySource::default();
    source.objects.insert(
        "dem3/N43E042".to_string(),
        degree_from_fn(|gx, gy| if (gx, gy) == (11, 10) { NO_VALUE } else { 5 }),
    );
    let lat = 43.0 + 10.5 / 1200.0;
    let values = lookup(
        &source,
        &[
            (lat, 42.0 + 10.5 / 1200.0),
            (lat, 42.0 + 11.5 / 1200.0),
            (lat, 42.0 + 12.5 / 1200.0),
        ],
    );
    assert_eq!(values, vec![None, None, Some(5.0)]);
}

#[test]
fn missing_degree_and_outside_grid_give_null_in_order() {
    let source = synthetic_source();
    let values = lookup(
        &source,
        &[(43.0, 35.0), (43.5, 42.5), (90.5, 0.0), (43.35, 202.44)],
    );
    assert_eq!(
        values.iter().map(Option::is_some).collect::<Vec<_>>(),
        vec![false, true, false, false]
    );
}

#[test]
fn empty_chunk_gives_null() {
    let mut chunks = vec![None; CHUNKS];
    chunks[0] = Some(vec![7i16; CHUNK_VALUES]);
    let mut source = MemorySource::default();
    source
        .objects
        .insert("dem3/N43E042".to_string(), encode_degree(&chunks, 3));
    assert_eq!(
        lookup(&source, &[(43.1, 42.1), (43.9, 42.9)]),
        vec![Some(7.0), None]
    );
}

#[test]
fn parse_accepts_author_format() {
    assert_eq!(parse_points(b""), Ok(vec![]));
    assert_eq!(parse_points(b"43.35 42.44"), Ok(vec![(43.35, 42.44)]));
    assert_eq!(parse_points(b"43.35 42.44\n"), Ok(vec![(43.35, 42.44)]));
    assert_eq!(
        parse_points(b"1e1 4.244e1\n-0.5 .5"),
        Ok(vec![(10.0, 42.44), (-0.5, 0.5)])
    );
    assert!(parse_points(b"nan nan").unwrap()[0].0.is_nan());
}

#[test]
fn parse_rejects_malformed_lines() {
    for body in [
        &b"abc def"[..],
        b"43.35",
        b"43.35,42.44",
        b"43.35  42.44",
        b" 43.35 42.44",
        b"43.35 42.44 1",
        b"43.35 42.44\r\n",
        b"43.35 42.44\n\n43.35 42.44",
        b"\n",
        b"\xff 1",
    ] {
        assert_eq!(
            parse_points(body),
            Err(ParseError::Invalid),
            "{:?}",
            String::from_utf8_lossy(body)
        );
    }
}

#[test]
fn parse_limits() {
    let line = "1.000000 2.000000\n";
    assert_eq!(
        parse_points(line.repeat(MAX_POINTS).as_bytes()).map(|points| points.len()),
        Ok(MAX_POINTS)
    );
    let short = "1 2\n";
    assert_eq!(
        parse_points(short.repeat(MAX_POINTS + 1).as_bytes()),
        Err(ParseError::TooBig)
    );
    assert_eq!(parse_points(&vec![b'1'; 250_001]), Err(ParseError::TooBig));
}

#[test]
fn elevation_formatting_matches_author() {
    let cases = [
        (Some(5571.0), "5571.00"),
        (Some(0.125), "0.13"),
        (Some(-0.125), "-0.13"),
        (Some(0.0), "0.00"),
        (Some(0.07), "0.07"),
        (Some(0.5), "0.50"),
        (Some(-0.05), "-0.05"),
        (Some(-1.5), "-1.50"),
        (Some(-0.001), "0.00"),
        (None, "NULL"),
    ];
    for (value, text) in cases {
        assert_eq!(format_elevation(value), text, "{value:?}");
    }
    assert_eq!(format_elevations(&[Some(1.0), None]), "1.00\nNULL");
    assert_eq!(format_elevations(&[]), "");
}
