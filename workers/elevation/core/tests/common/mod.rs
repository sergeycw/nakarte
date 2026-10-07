#![allow(dead_code)]

use std::collections::HashMap;
use std::path::Path;

use elevation_core::format::{CHUNKS, SPLIT, TILE_SIZE, encode_degree};
use elevation_core::{Error, Source};

#[derive(Default)]
pub struct MemorySource {
    pub objects: HashMap<String, Vec<u8>>,
}

impl MemorySource {
    pub fn from_dir(root: &Path) -> MemorySource {
        let mut source = MemorySource::default();
        for entry in std::fs::read_dir(root.join("dem3")).unwrap() {
            let entry = entry.unwrap();
            let name = entry.file_name().into_string().unwrap();
            source
                .objects
                .insert(format!("dem3/{name}"), std::fs::read(entry.path()).unwrap());
        }
        source
    }
}

impl Source for MemorySource {
    async fn read(&self, key: &str, offset: u64, length: u64) -> Result<Option<Vec<u8>>, Error> {
        let Some(object) = self.objects.get(key) else {
            return Ok(None);
        };
        let start = offset as usize;
        let end = start + length as usize;
        Ok(Some(object[start..end].to_vec()))
    }
}

pub fn degree_from_fn(value: impl Fn(usize, usize) -> i16) -> Vec<u8> {
    let chunks: Vec<Option<Vec<i16>>> = (0..CHUNKS)
        .map(|chunk| {
            let (dy, dx) = (chunk / SPLIT, chunk % SPLIT);
            let mut values = Vec::with_capacity(TILE_SIZE * TILE_SIZE);
            for iy in 0..TILE_SIZE {
                for ix in 0..TILE_SIZE {
                    values.push(value(dx * (TILE_SIZE - 1) + ix, dy * (TILE_SIZE - 1) + iy));
                }
            }
            Some(values)
        })
        .collect();
    encode_degree(&chunks, 3)
}

pub fn fixtures_dir() -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures")
}
