// Embedded data files. Bundling at compile time (instead of via Tauri's
// `bundle.resources`) means the same staging code works on desktop and on
// Android: read from `&[u8]` constants, write into `app_data_dir`, and open
// the staged files like any other.
//
// The cost is binary size (~3.5 MB). Worth it to avoid wrestling with the
// Android AssetManager from Rust.

use std::fs;
use std::io;
use std::path::Path;

use include_dir::{include_dir, Dir};

pub const KB_DUCKDB: &[u8] =
    include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../knowledge-base/kb.duckdb"));

static RESEARCH_DOWNLOAD_MD: Dir<'_> =
    include_dir!("$CARGO_MANIFEST_DIR/../../research/download-md");
static RESEARCH_HUMANITARIAN: Dir<'_> =
    include_dir!("$CARGO_MANIFEST_DIR/../../research/humanitarian-aid-colombia");

const RESEARCH_ROOT_FILES: &[(&str, &[u8])] = &[
    (
        "flood-tagging-and-reference-points.md",
        include_bytes!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../research/flood-tagging-and-reference-points.md"
        )),
    ),
    (
        "water-crisis-colombia.md",
        include_bytes!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../research/water-crisis-colombia.md"
        )),
    ),
    (
        "zenu-hydraulic-network.md",
        include_bytes!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../research/zenu-hydraulic-network.md"
        )),
    ),
    (
        "links.md",
        include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../research/links.md")),
    ),
];

/// Idempotently materialise the embedded data into the writable app data
/// directory. Subsequent launches skip files that are already present.
pub fn stage(app_data_dir: &Path) -> io::Result<()> {
    fs::create_dir_all(app_data_dir)?;

    let kb_path = app_data_dir.join("kb.duckdb");
    if !kb_path.exists() || fs::metadata(&kb_path).map(|m| m.len() == 0).unwrap_or(true) {
        fs::write(&kb_path, KB_DUCKDB)?;
        log::info!("staged kb.duckdb ({} bytes)", KB_DUCKDB.len());
    }

    let research_dir = app_data_dir.join("research");
    let download_md_dir = research_dir.join("download-md");
    let humanitarian_dir = research_dir.join("humanitarian-aid-colombia");
    fs::create_dir_all(&download_md_dir)?;
    fs::create_dir_all(&humanitarian_dir)?;

    let mut staged = 0usize;
    for file in RESEARCH_DOWNLOAD_MD.files() {
        let name = file.path().file_name().and_then(|s| s.to_str()).unwrap_or("_");
        let dest = download_md_dir.join(name);
        if !dest.exists() {
            fs::write(&dest, file.contents())?;
            staged += 1;
        }
    }
    for file in RESEARCH_HUMANITARIAN.files() {
        let name = file.path().file_name().and_then(|s| s.to_str()).unwrap_or("_");
        let dest = humanitarian_dir.join(name);
        if !dest.exists() {
            fs::write(&dest, file.contents())?;
            staged += 1;
        }
    }
    for (name, bytes) in RESEARCH_ROOT_FILES {
        let dest = research_dir.join(name);
        if !dest.exists() {
            fs::write(&dest, bytes)?;
            staged += 1;
        }
    }
    if staged > 0 {
        log::info!("staged {staged} research markdown files");
    }
    Ok(())
}
