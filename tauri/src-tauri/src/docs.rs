// Local document repository — markdown files referenced by the Q&A pairs.
//
// In production, the relevant subset of `research/**/*.md` is bundled under
// the Tauri resource directory. In dev, we read directly from the repo at
// `../../research/`.
//
// Two operations frontend cares about:
//   - list every local document referenced by at least one Q&A pair
//   - read a single document, returning its markdown content
//
// We never read paths that don't appear as a `local` reference somewhere in
// kb.duckdb, so the surface is bounded by the data we shipped.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::kb::KbDb;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocSummary {
    pub path: String,        // relative to research/ root, e.g. "download-md/ACAPS-...md"
    pub title: String,       // first H1 if present, else file stem
    pub size_bytes: u64,
    pub citation_count: u32,
    pub exists: bool,        // false → ref present in KB but file not bundled
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocContent {
    pub path: String,
    pub title: String,
    pub markdown: String,
    pub size_bytes: u64,
    pub citing_qa_ids: Vec<String>,
}

pub struct DocsRepo {
    /// Filesystem root where documents live (bundled or dev fallback).
    /// Note: references in kb.duckdb are stored *with* the leading "research/"
    /// segment, so the canonical relative form is `research/<path>`.
    root: PathBuf,
}

impl DocsRepo {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Walk every Q&A row and pull out the unique local reference paths along
    /// with how many times each one is cited.
    pub fn list(&self, kb: &KbDb) -> Result<Vec<DocSummary>, String> {
        let mut counts: BTreeMap<String, u32> = BTreeMap::new();
        let rows = kb
            .raw_refs()
            .map_err(|e| format!("read refs from kb: {e}"))?;
        for (refs, types) in rows {
            for (r, t) in zip_refs(&refs, &types) {
                if t == "local" && r.starts_with("research/") && r.ends_with(".md") {
                    *counts.entry(r.to_string()).or_insert(0) += 1;
                }
            }
        }
        let mut out = Vec::with_capacity(counts.len());
        for (rel, n) in counts {
            let abs = self.resolve(&rel);
            let (size_bytes, exists, title) = match abs {
                Some(p) => {
                    let meta = std::fs::metadata(&p).ok();
                    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                    let title = read_title(&p).unwrap_or_else(|| stem_title(&rel));
                    (size, meta.is_some(), title)
                }
                None => (0, false, stem_title(&rel)),
            };
            out.push(DocSummary {
                path: rel,
                title,
                size_bytes,
                citation_count: n,
                exists,
            });
        }
        // Sort by citation count desc, then alpha.
        out.sort_by(|a, b| {
            b.citation_count
                .cmp(&a.citation_count)
                .then_with(|| a.path.cmp(&b.path))
        });
        Ok(out)
    }

    pub fn read(&self, kb: &KbDb, rel_path: &str) -> Result<DocContent, String> {
        let abs = self
            .resolve(rel_path)
            .ok_or_else(|| format!("document not found: {rel_path}"))?;
        let markdown = std::fs::read_to_string(&abs)
            .map_err(|e| format!("read {rel_path}: {e}"))?;
        let size_bytes = markdown.len() as u64;
        let title = read_title(&abs).unwrap_or_else(|| stem_title(rel_path));
        let citing_qa_ids = qa_citing(kb, rel_path).unwrap_or_default();
        Ok(DocContent {
            path: rel_path.to_string(),
            title,
            markdown,
            size_bytes,
            citing_qa_ids,
        })
    }

    /// Resolve a `research/...` style relative path against the configured
    /// root. Returns None if the resolved path escapes the root or doesn't
    /// exist on disk.
    fn resolve(&self, rel: &str) -> Option<PathBuf> {
        // Strip the canonical "research/" prefix — our root *is* the research dir.
        let stripped = rel.strip_prefix("research/").unwrap_or(rel);
        if stripped.contains("..") {
            return None;
        }
        let candidate = self.root.join(stripped);
        let canon_root = std::fs::canonicalize(&self.root).ok()?;
        let canon = std::fs::canonicalize(&candidate).ok()?;
        if !canon.starts_with(&canon_root) {
            return None;
        }
        Some(canon)
    }
}

fn qa_citing(kb: &KbDb, rel_path: &str) -> Result<Vec<String>, duckdb::Error> {
    // Pipe-separated string match. Wrap in `|` on both sides of the haystack
    // so we don't false-match on a substring.
    let pat = format!("%|{}|%", sql_escape(rel_path));
    kb.qa_ids_referencing(&pat)
}

fn sql_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
}

fn zip_refs<'a>(refs: &'a str, types: &'a str) -> impl Iterator<Item = (&'a str, &'a str)> {
    let r = refs.split('|').filter(|s| !s.is_empty());
    let t = types.split('|');
    r.zip(t).map(|(a, b)| (a.trim(), b.trim()))
}

fn read_title(p: &Path) -> Option<String> {
    let s = std::fs::read_to_string(p).ok()?;
    for line in s.lines().take(20) {
        let t = line.trim_start();
        if let Some(rest) = t.strip_prefix("# ") {
            return Some(rest.trim().to_string());
        }
    }
    None
}

fn stem_title(rel: &str) -> String {
    Path::new(rel)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(rel)
        .replace('-', " ")
        .replace('_', " ")
}
