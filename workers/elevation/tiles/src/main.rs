//! `elevation-tiles build --data DIR --out FILE [--bbox W,S,E,N] [--max-zoom 9] [--threads N]`
//!   — архив тайлов z0–max из `DIR/dem3/*` (с `--bbox` — только блоки z5, задевающие область).
//! `elevation-tiles thin --data DIR --fixtures DIR Z/X/Y...`
//!   — дописать в прореженные фикстуры `dem3` куски, нужные для расчёта этих тайлов.

use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Instant;

use elevation_core::tile::parse_path;
use elevation_tiles::{ARCHIVE_MAX_ZOOM, Bbox, Options, build, thin};

fn value(args: &mut impl Iterator<Item = String>, name: &str) -> Result<String, String> {
    args.next().ok_or(format!("missing value for {name}"))
}

fn run() -> Result<(), String> {
    let mut args = std::env::args().skip(1);
    let command = args.next().ok_or("missing command: build or thin")?;
    let mut data = None;
    let mut out = None;
    let mut fixtures = None;
    let mut bbox = None;
    let mut max_zoom = ARCHIVE_MAX_ZOOM;
    let mut threads = std::thread::available_parallelism().map_or(1, |n| n.get());
    let mut tiles = Vec::new();
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--data" => data = Some(PathBuf::from(value(&mut args, &arg)?)),
            "--out" => out = Some(PathBuf::from(value(&mut args, &arg)?)),
            "--fixtures" => fixtures = Some(PathBuf::from(value(&mut args, &arg)?)),
            "--bbox" => {
                bbox = Some(Bbox::parse(&value(&mut args, &arg)?).ok_or("--bbox wants W,S,E,N")?)
            }
            "--max-zoom" => {
                max_zoom = value(&mut args, &arg)?
                    .parse()
                    .map_err(|_| "bad --max-zoom")?
            }
            "--threads" => {
                threads = value(&mut args, &arg)?
                    .parse()
                    .map_err(|_| "bad --threads")?
            }
            _ => tiles.push(parse_path(&arg).ok_or(format!("bad tile {arg}, want Z/X/Y"))?),
        }
    }
    let data = data.ok_or("missing --data")?;
    match command.as_str() {
        "build" => {
            let out = out.ok_or("missing --out")?;
            let started = Instant::now();
            let options = Options {
                max_zoom,
                bbox,
                threads,
            };
            let report = build(&data, &out, &options).map_err(|error| error.to_string())?;
            let mut total = (0, 0);
            for (z, (count, bytes)) in &report.tiles {
                println!("z{z}: {count} tiles, {bytes} bytes");
                total.0 += count;
                total.1 += bytes;
            }
            println!(
                "{} blocks, {} tiles, {} bytes, {:.0} s",
                report.blocks,
                total.0,
                total.1,
                started.elapsed().as_secs_f64()
            );
        }
        "thin" => {
            let fixtures = fixtures.ok_or("missing --fixtures")?;
            for line in thin(&data, &fixtures, &tiles).map_err(|error| error.to_string())? {
                println!("{line}");
            }
        }
        _ => return Err(format!("unknown command {command}")),
    }
    Ok(())
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            ExitCode::from(2)
        }
    }
}
