// Генератор на фикстурах: архив блока z5 вокруг Казбека совпадает с тайлами, посчитанными тем же
// путём, что Worker на лету (`render::tile`), а позиции без данных в архиве пустые.

use std::path::Path;

use elevation_core::archive::{self, Lookup};
use elevation_core::render;
use elevation_core::tile::{decode, gunzip};
use elevation_core::{Error, Source};
use elevation_tiles::{Bbox, FileSource, Options, build};
use futures::executor::block_on;

struct ArchiveFile(Vec<u8>);

impl Source for ArchiveFile {
    async fn read(&self, key: &str, offset: u64, length: u64) -> Result<Option<Vec<u8>>, Error> {
        assert_eq!(key, archive::KEY);
        let start = offset as usize;
        Ok(Some(self.0[start..start + length as usize].to_vec()))
    }
}

fn archived(archive: &ArchiveFile, z: u8, x: u32, y: u32) -> Option<Vec<i16>> {
    match block_on(archive::read(archive, z, x, y)).unwrap() {
        Lookup::Tile(body) => Some(decode(&gunzip(&body).unwrap())),
        Lookup::Missing => None,
        Lookup::NotCovered => panic!("{z}/{x}/{y} not covered"),
    }
}

#[test]
fn builds_block_matching_live_tiles() {
    let data = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures");
    let out = std::env::temp_dir().join(format!("elevation-tiles-{}", std::process::id()));
    let options = Options {
        max_zoom: 9,
        bbox: Some(Bbox::parse("44.3,42.5,44.7,42.8").unwrap()),
        threads: 4,
    };
    let report = build(&data, &out, &options).unwrap();
    let archive = ArchiveFile(std::fs::read(&out).unwrap());
    std::fs::remove_file(&out).unwrap();
    assert_eq!(report.blocks, 1);

    let source = FileSource { root: data };
    // Казбек: z9 и z5 из архива — те же значения, что каскад на лету
    for (z, x, y) in [(9, 319, 188), (5, 19, 11)] {
        let live = block_on(render::tile(&source, z, x, y)).unwrap();
        assert_eq!(
            archived(&archive, z, x, y).as_deref(),
            Some(&live.values[..]),
            "{z}/{x}/{y}"
        );
    }
    // z0–4 строятся из мирового растра z5; в нём только этот блок, но тайлы есть
    for z in 0..5 {
        let side = 1u32 << z;
        let (x, y) = (19 * side / 32, 11 * side / 32);
        assert!(archived(&archive, z, x, y).is_some(), "{z}/{x}/{y}");
    }
    // тот же блок, но в куске без данных фикстур (прорежено) — тайла нет
    assert_eq!(archived(&archive, 9, 304, 176), None);
}
