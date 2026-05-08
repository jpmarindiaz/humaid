// Read-only access to the bundled `kb.duckdb`. SQL is the same shape as
// `website/lib/qa.ts` — DuckDB's native `array_cosine_similarity()` against the
// 768-dim Nomic embedding column. The query embedding is inlined as a
// FLOAT[768] literal because (a) the values are ours, (b) it matches what the
// website does, and (c) it avoids the `duckdb` crate's array-binding ceremony.

use std::path::{Path, PathBuf};

use duckdb::Connection;
use parking_lot::Mutex;

use crate::models::{KbStats, QaMatch, QaRow};

pub struct KbDb {
    conn: Mutex<Connection>,
    path: PathBuf,
}

impl KbDb {
    pub fn open(path: &Path) -> duckdb::Result<Self> {
        let conn = Connection::open(path)?;
        Ok(Self {
            conn: Mutex::new(conn),
            path: path.to_path_buf(),
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn list(
        &self,
        role: Option<&str>,
        phase: Option<&str>,
        region: Option<&str>,
        topic: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> duckdb::Result<Vec<QaRow>> {
        let mut where_parts: Vec<String> = Vec::new();
        if let Some(r) = role {
            where_parts.push(format!("role = {}", sql_str(r)));
        }
        if let Some(p) = phase {
            where_parts.push(format!("phase = {}", sql_str(p)));
        }
        if let Some(r) = region {
            where_parts.push(format!("region = {}", sql_str(r)));
        }
        if let Some(t) = topic {
            where_parts.push(format!("topic = {}", sql_str(t)));
        }
        let where_sql = if where_parts.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_parts.join(" AND "))
        };
        let sql = format!(
            r#"
            SELECT id, role, phase, region, topic,
                   question_en, question_es, answer_en, answer_es,
                   "references", ref_types
            FROM qa
            {where_sql}
            ORDER BY id
            LIMIT {limit} OFFSET {offset}
            "#
        );
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], qa_row_from_row)?;
        rows.collect()
    }

    pub fn get(&self, id: &str) -> duckdb::Result<Option<QaRow>> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            r#"SELECT id, role, phase, region, topic,
                      question_en, question_es, answer_en, answer_es,
                      "references", ref_types
               FROM qa WHERE id = ?"#,
        )?;
        let mut rows = stmt.query_map([id], qa_row_from_row)?;
        match rows.next() {
            Some(Ok(r)) => Ok(Some(r)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    pub fn get_many(&self, ids: &[String]) -> duckdb::Result<Vec<QaRow>> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        let placeholders = ids
            .iter()
            .map(|s| sql_str(s))
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            r#"SELECT id, role, phase, region, topic,
                      question_en, question_es, answer_en, answer_es,
                      "references", ref_types
               FROM qa WHERE id IN ({placeholders})"#
        );
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], qa_row_from_row)?;
        rows.collect()
    }

    pub fn search(
        &self,
        query_vec: &[f32],
        role: Option<&str>,
        phase: Option<&str>,
        region: Option<&str>,
        limit: u32,
        min_similarity: f32,
    ) -> duckdb::Result<Vec<QaMatch>> {
        let mut where_parts: Vec<String> = Vec::new();
        if let Some(r) = role {
            where_parts.push(format!("role = {}", sql_str(r)));
        }
        if let Some(p) = phase {
            where_parts.push(format!("phase = {}", sql_str(p)));
        }
        if let Some(r) = region {
            where_parts.push(format!("region = {}", sql_str(r)));
        }
        let where_sql = if where_parts.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_parts.join(" AND "))
        };

        let vec_lit = float_array_literal(query_vec);
        let sql = format!(
            r#"
            SELECT id, role, phase, region, topic,
                   question_en, question_es, answer_en, answer_es,
                   "references", ref_types,
                   array_cosine_similarity(embedding, {vec_lit}) AS similarity
            FROM qa
            {where_sql}
            ORDER BY similarity DESC
            LIMIT {limit}
            "#
        );

        let conn = self.conn.lock();
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], |row| {
            let row_data = qa_row_from_row(row)?;
            let similarity: f32 = row.get::<_, f32>(11)?;
            Ok(QaMatch {
                row: row_data,
                similarity,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            let m = r?;
            if m.similarity < min_similarity {
                continue;
            }
            out.push(m);
        }
        Ok(out)
    }

    pub fn stats(&self) -> duckdb::Result<KbStats> {
        let conn = self.conn.lock();

        let mut total_stmt = conn.prepare("SELECT COUNT(*) FROM qa")?;
        let total: u64 = total_stmt
            .query_map([], |row| row.get::<_, i64>(0))?
            .next()
            .transpose()?
            .map(|n| n as u64)
            .unwrap_or(0);

        let by = |col: &str| -> duckdb::Result<std::collections::BTreeMap<String, u64>> {
            let sql = format!("SELECT {col}, COUNT(*) FROM qa GROUP BY {col}");
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map([], |row| {
                let k: String = row.get(0)?;
                let n: i64 = row.get(1)?;
                Ok((k, n as u64))
            })?;
            let mut out = std::collections::BTreeMap::new();
            for r in rows {
                let (k, n) = r?;
                out.insert(k, n);
            }
            Ok(out)
        };

        Ok(KbStats {
            total,
            by_role: by("role")?,
            by_phase: by("phase")?,
            by_region: by("region")?,
        })
    }

    /// Return every (references, ref_types) tuple from the qa table — used by
    /// the docs module to discover bundled documents.
    pub fn raw_refs(&self) -> duckdb::Result<Vec<(String, String)>> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(r#"SELECT "references", ref_types FROM qa"#)?;
        let rows = stmt.query_map([], |row| {
            let r: Option<String> = row.get(0)?;
            let t: Option<String> = row.get(1)?;
            Ok((r.unwrap_or_default(), t.unwrap_or_default()))
        })?;
        rows.collect()
    }

    /// QA IDs whose references contain a given LIKE pattern (caller supplies
    /// the wildcards — typically `%|<exact-path>|%`).
    pub fn qa_ids_referencing(&self, pattern: &str) -> duckdb::Result<Vec<String>> {
        let conn = self.conn.lock();
        // Wrap the column in pipes so prefix/suffix patterns match cleanly.
        let mut stmt = conn.prepare(
            r#"SELECT id FROM qa WHERE '|' || "references" || '|' LIKE ? ESCAPE '\' ORDER BY id"#,
        )?;
        let rows = stmt.query_map([pattern], |row| row.get::<_, String>(0))?;
        rows.collect()
    }

    pub fn topics(&self) -> duckdb::Result<Vec<(String, u64)>> {
        let conn = self.conn.lock();
        let mut stmt =
            conn.prepare("SELECT topic, COUNT(*) FROM qa GROUP BY topic ORDER BY COUNT(*) DESC")?;
        let rows = stmt.query_map([], |row| {
            let k: String = row.get(0)?;
            let n: i64 = row.get(1)?;
            Ok((k, n as u64))
        })?;
        rows.collect()
    }
}

fn qa_row_from_row(row: &duckdb::Row) -> duckdb::Result<QaRow> {
    Ok(QaRow {
        id: row.get(0)?,
        role: row.get(1)?,
        phase: row.get(2)?,
        region: row.get(3)?,
        topic: row.get(4)?,
        question_en: row.get(5)?,
        question_es: row.get(6)?,
        answer_en: row.get(7)?,
        answer_es: row.get(8)?,
        references: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
        ref_types: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
    })
}

fn sql_str(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

fn float_array_literal(v: &[f32]) -> String {
    let mut s = String::with_capacity(v.len() * 10 + 16);
    s.push('[');
    for (i, x) in v.iter().enumerate() {
        if i > 0 {
            s.push(',');
        }
        s.push_str(&format!("{:.7}", x));
    }
    s.push_str(&format!("]::FLOAT[{}]", v.len()));
    s
}
