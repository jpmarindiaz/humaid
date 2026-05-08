// Local SQLite for desktop-only state: user profile, alert history, sync cursors.
// The KB itself lives in the bundled DuckDB file (read-only) — see kb.rs.

use std::path::Path;

use parking_lot::Mutex;
use rusqlite::{params, Connection};

use crate::models::{Alert, Language, Profile};

pub struct LocalDb {
    conn: Mutex<Connection>,
}

impl LocalDb {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(path)?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS profile (
                id           INTEGER PRIMARY KEY CHECK (id = 1),
                role         TEXT NOT NULL,
                region       TEXT NOT NULL,
                language     TEXT NOT NULL DEFAULT 'es',
                created_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id              TEXT PRIMARY KEY,
                timestamp       TEXT NOT NULL,
                region          TEXT NOT NULL,
                location        TEXT NOT NULL,
                severity        TEXT NOT NULL,
                labels_json     TEXT NOT NULL DEFAULT '{}',
                recommended_ids TEXT NOT NULL DEFAULT '',
                seen_at         TEXT NOT NULL DEFAULT (datetime('now')),
                acknowledged_at TEXT
            );

            CREATE TABLE IF NOT EXISTS sync_cursor (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "#,
        )?;
        // Idempotent: add `payload_json` to alerts so we can store the full
        // server-shaped Alert (including coords / summary / images that
        // weren't in the original schema) without a hard migration.
        conn.execute(
            "ALTER TABLE alerts ADD COLUMN payload_json TEXT",
            [],
        )
        .ok();
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn get_profile(&self) -> rusqlite::Result<Option<Profile>> {
        let conn = self.conn.lock();
        let mut stmt =
            conn.prepare("SELECT role, region, language FROM profile WHERE id = 1")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            let role: String = row.get(0)?;
            let region: String = row.get(1)?;
            let lang_s: String = row.get(2)?;
            let language = if lang_s == "en" { Language::En } else { Language::Es };
            Ok(Some(Profile { role, region, language }))
        } else {
            Ok(None)
        }
    }

    pub fn set_profile(&self, p: &Profile) -> rusqlite::Result<()> {
        let lang_s = match p.language {
            Language::En => "en",
            Language::Es => "es",
        };
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO profile (id, role, region, language) VALUES (1, ?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET role=excluded.role, region=excluded.region, language=excluded.language",
            params![p.role, p.region, lang_s],
        )?;
        Ok(())
    }

    pub fn get_cursor(&self, key: &str) -> rusqlite::Result<Option<String>> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare("SELECT value FROM sync_cursor WHERE key = ?1")?;
        let mut rows = stmt.query([key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_cursor(&self, key: &str, value: &str) -> rusqlite::Result<()> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO sync_cursor (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    /// Drop a cursor (and all matching prefix cursors). Used by the
    /// "refetch history" path so the next poll has no `since`.
    pub fn delete_cursors_with_prefix(&self, prefix: &str) -> rusqlite::Result<usize> {
        let conn = self.conn.lock();
        let n = conn.execute(
            "DELETE FROM sync_cursor WHERE key LIKE ?1",
            params![format!("{}%", prefix)],
        )?;
        Ok(n)
    }

    /// Insert a new alert. Returns true if it was a new row, false if already known.
    /// We persist the entire `Alert` struct as JSON so future fields don't need
    /// schema migrations on the desktop side.
    pub fn record_alert(&self, alert: &Alert) -> rusqlite::Result<bool> {
        let payload_json = serde_json::to_string(alert).unwrap_or_else(|_| "{}".into());
        let labels_json = serde_json::to_string(&alert.labels).unwrap_or_else(|_| "{}".into());
        let rec_ids = alert.recommended_qa_ids.join("|");
        let conn = self.conn.lock();
        let changed = conn.execute(
            "INSERT OR IGNORE INTO alerts
                (id, timestamp, region, location, severity, labels_json, recommended_ids, payload_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                alert.id,
                alert.timestamp,
                alert.region,
                alert.location,
                alert.severity,
                labels_json,
                rec_ids,
                payload_json,
            ],
        )?;
        Ok(changed > 0)
    }

    pub fn list_alerts(
        &self,
        region: Option<&str>,
        limit: u32,
    ) -> rusqlite::Result<Vec<Alert>> {
        let conn = self.conn.lock();
        let (sql, params): (&str, Vec<Box<dyn rusqlite::ToSql>>) = match region {
            Some(r) => (
                "SELECT payload_json, id, timestamp, region, location, severity,
                        labels_json, recommended_ids
                 FROM alerts WHERE region = ?1
                 ORDER BY timestamp DESC LIMIT ?2",
                vec![Box::new(r.to_string()), Box::new(limit)],
            ),
            None => (
                "SELECT payload_json, id, timestamp, region, location, severity,
                        labels_json, recommended_ids
                 FROM alerts ORDER BY timestamp DESC LIMIT ?1",
                vec![Box::new(limit)],
            ),
        };
        let mut stmt = conn.prepare(sql)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> =
            params.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            let payload_json: Option<String> = row.get(0)?;
            // Prefer the full payload when present; fall back to reconstructing
            // from the legacy columns for rows recorded before payload_json existed.
            if let Some(s) = payload_json {
                if let Ok(a) = serde_json::from_str::<Alert>(&s) {
                    return Ok(a);
                }
            }
            let labels_json: String = row.get(6)?;
            let rec_ids: String = row.get(7)?;
            let labels = serde_json::from_str(&labels_json).unwrap_or_default();
            Ok(Alert {
                id: row.get(1)?,
                timestamp: row.get(2)?,
                region: row.get(3)?,
                location: row.get(4)?,
                severity: row.get(5)?,
                labels,
                recommended_qa_ids: if rec_ids.is_empty() {
                    Vec::new()
                } else {
                    rec_ids.split('|').map(|s| s.to_string()).collect()
                },
                coordinates: None,
                location_label: None,
                thumbnail_url: None,
                source: None,
                summary: None,
                images: None,
                is_new: false,
            })
        })?;
        rows.collect()
    }

    pub fn acknowledge_alert(&self, id: &str) -> rusqlite::Result<()> {
        let conn = self.conn.lock();
        conn.execute(
            "UPDATE alerts SET acknowledged_at = datetime('now') WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }
}
