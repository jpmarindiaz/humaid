// Polls the website for region-scoped flood alerts.
//
// Endpoint contract (proposed in tauri/README.md, not yet built on the website):
//   GET /api/alerts?region=<region>&since=<iso8601>
//   → { alerts: [...], cursor: <iso8601> }
//
// Persists the `since` cursor in local SQLite so we never replay an alert.
// Emits a Tauri event `alert_received` for each newly-seen alert and shows an
// OS-native notification.

use std::sync::Arc;
use std::time::Duration;

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::db::LocalDb;
use crate::kb::KbDb;
use crate::models::{Alert, AlertEvent};

const CURSOR_KEY_PREFIX: &str = "alerts:since:";
/// Background safety-net cadence. The frontend drives faster polling when the
/// window is focused and the user is on the Alerts tab; this loop is what
/// catches alerts when the app is minimized or the user is on another tab.
pub const POLL_BACKGROUND_SECS: u64 = 30 * 60;

#[derive(Deserialize)]
struct AlertsResp {
    alerts: Vec<Alert>,
    cursor: Option<String>,
}

pub struct AlertPoller {
    api_base: String,
    region: String,
    http: reqwest::Client,
    interval: Duration,
}

impl AlertPoller {
    pub fn new(api_base: String, region: String, interval: Duration) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .expect("reqwest client");
        Self {
            api_base,
            region,
            http,
            interval,
        }
    }

    /// One poll cycle. Returns the newly-seen alerts (in order).
    pub async fn poll_once(
        &self,
        db: &LocalDb,
        kb: &KbDb,
        app: &AppHandle,
    ) -> Result<Vec<Alert>, String> {
        let cursor_key = format!("{}{}", CURSOR_KEY_PREFIX, self.region);
        // First-install: omit `since` so the server returns the full history
        // (the alerts we have go back to 2017). After the first response we
        // start tracking the server's cursor and only ask for what's newer.
        let cursor = db
            .get_cursor(&cursor_key)
            .map_err(|e| format!("read cursor: {e}"))?;
        let base = self.api_base.trim_end_matches('/');
        let region_enc = urlencode(&self.region);
        let url = match &cursor {
            Some(s) => format!("{}/api/alerts?region={}&since={}", base, region_enc, urlencode(s)),
            None => format!("{}/api/alerts?region={}", base, region_enc),
        };

        let resp = match self.http.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                // Offline / network glitch — silent failure is the spec.
                log::debug!("alert poll offline: {e}");
                return Ok(vec![]);
            }
        };
        if !resp.status().is_success() {
            return Err(format!("alerts endpoint returned {}", resp.status()));
        }
        let body: AlertsResp = resp
            .json()
            .await
            .map_err(|e| format!("decode alerts response: {e}"))?;

        let mut new_alerts = Vec::new();
        for mut alert in body.alerts {
            // Server returns relative thumbnail paths like
            // `/assets/samples/foo-thumb.png`. Absolutise so the webview's
            // <img> tag fetches against the right host even if API base
            // changes later.
            if let Some(t) = &alert.thumbnail_url {
                if t.starts_with('/') {
                    alert.thumbnail_url = Some(format!(
                        "{}{}",
                        self.api_base.trim_end_matches('/'),
                        t
                    ));
                }
            }
            let inserted = db
                .record_alert(&alert)
                .map_err(|e| format!("record alert: {e}"))?;
            if !inserted {
                continue;
            }
            alert.is_new = true;

            // Pull the recommended Q&A rows from the local KB (no network).
            let recommended = kb
                .get_many(&alert.recommended_qa_ids)
                .unwrap_or_default();

            // OS-native notification.
            let title = format!("Flood alert · {}", pretty_region(&alert.region));
            let body_text = format!(
                "{} severity{}",
                alert.severity,
                if alert.location.is_empty() {
                    String::new()
                } else {
                    format!(" · {}", alert.location.replace('_', " "))
                }
            );
            let _ = app
                .notification()
                .builder()
                .title(&title)
                .body(&body_text)
                .show();

            // Front-end event.
            let _ = app.emit(
                "alert_received",
                AlertEvent {
                    alert: alert.clone(),
                    recommended_qa: recommended,
                },
            );

            new_alerts.push(alert);
        }

        if let Some(cur) = body.cursor {
            db.set_cursor(&cursor_key, &cur)
                .map_err(|e| format!("save cursor: {e}"))?;
        }

        Ok(new_alerts)
    }

    /// Runs forever until the app handle goes away. Errors are logged, not
    /// propagated — polling must be resilient.
    pub async fn run(self, db: Arc<LocalDb>, kb: Arc<KbDb>, app: AppHandle) {
        log::info!(
            "alert poller started (region={}, interval={:?})",
            self.region,
            self.interval
        );
        loop {
            match self.poll_once(&db, &kb, &app).await {
                Ok(new) if !new.is_empty() => {
                    log::info!("alerts: {} new", new.len());
                }
                Ok(_) => {}
                Err(e) => log::warn!("alert poll error: {e}"),
            }
            // Allow the app to surface the most recent state even on shutdown.
            if app.try_state::<crate::AppState>().is_none() {
                break;
            }
            tokio::time::sleep(self.interval).await;
        }
    }
}

fn urlencode(s: &str) -> String {
    // Minimal — region/cursor only contain a–z, 0–9, ':', '-', 'T', '+', '.'.
    s.bytes()
        .map(|b| match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{:02X}", b),
        })
        .collect()
}

fn pretty_region(slug: &str) -> String {
    match slug {
        "la-mojana" => "La Mojana".into(),
        "putumayo" => "Putumayo".into(),
        other => other.replace('-', " "),
    }
}
