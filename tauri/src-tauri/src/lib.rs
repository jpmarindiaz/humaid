mod alerts;
mod assets;
mod commands;
mod db;
mod docs;
mod kb;
mod models;
mod ollama;

use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use std::path::PathBuf;

use crate::alerts::{AlertPoller, POLL_BACKGROUND_SECS};
use crate::db::LocalDb;
use crate::docs::DocsRepo;
use crate::kb::KbDb;
use crate::ollama::OllamaClient;

pub const DEFAULT_API_BASE: &str = "https://humaid.app";

/// Snapshot of the 5 historical flood alerts the website team seeded
/// (`/api/alerts` on humaid.app). Bundled so the desktop app shows them
/// immediately on first launch — no network required. These are well-known
/// reference events (Mocoa 2017, San Benito Abad 2021, etc.).
const SEED_ALERTS_JSON: &str = include_str!("../assets/seed_alerts.json");

pub struct AppState {
    pub db: Arc<LocalDb>,
    pub kb: Arc<KbDb>,
    pub docs: Arc<DocsRepo>,
    pub ollama: Arc<OllamaClient>,
}

impl Clone for AppState {
    fn clone(&self) -> Self {
        Self {
            db: self.db.clone(),
            kb: self.kb.clone(),
            docs: self.docs.clone(),
            ollama: self.ollama.clone(),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let handle = app.handle().clone();

            let app_data = app
                .path()
                .app_data_dir()
                .expect("app_data_dir");
            std::fs::create_dir_all(&app_data).ok();

            // 1. Stage embedded resources (kb.duckdb + research/*.md) into
            //    the writable app-data directory. Idempotent; first launch
            //    on a clean install costs ~50–200ms.
            assets::stage(&app_data).map_err(|e| format!("stage assets: {e}"))?;

            // 2. Local SQLite for profile + alert history.
            let local_db_path = app_data.join("humaid.sqlite");
            let local_db = LocalDb::open(&local_db_path)
                .map_err(|e| format!("open local sqlite: {e}"))?;

            // 3. KB (DuckDB) opens the staged file.
            let kb_path = app_data.join("kb.duckdb");
            log::info!("kb path: {}", kb_path.display());
            let kb = KbDb::open(&kb_path).map_err(|e| format!("open kb duckdb: {e}"))?;

            // 4. Document repository points at the staged research/ tree.
            let docs_root = app_data.join("research");
            log::info!("docs root: {}", docs_root.display());
            let docs = DocsRepo::new(docs_root);

            // 5. Ollama HTTP client (no-op on Android — no daemon there).
            let ollama = OllamaClient::new();

            let state = AppState {
                db: Arc::new(local_db),
                kb: Arc::new(kb),
                docs: Arc::new(docs),
                ollama: Arc::new(ollama),
            };
            app.manage(state.clone());

            // 6. Seed the historical alerts (idempotent — INSERT OR IGNORE).
            //    These ship with the app so the Alerts tab is never empty,
            //    even on first launch with no network.
            if let Ok(seeds) = serde_json::from_str::<Vec<crate::models::Alert>>(SEED_ALERTS_JSON) {
                for a in &seeds {
                    let _ = state.db.record_alert(a);
                }
                log::info!("seeded {} historical alerts", seeds.len());
            } else {
                log::warn!("failed to parse bundled seed_alerts.json");
            }

            // 7. Spawn alert poller if a profile is configured.
            if let Ok(Some(profile)) = state.db.get_profile() {
                spawn_alert_poller(handle.clone(), state, &profile.region);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_profile,
            commands::set_profile,
            commands::list_qa,
            commands::get_qa,
            commands::get_qa_many,
            commands::kb_stats,
            commands::kb_topics,
            commands::qa_search,
            commands::ollama_status,
            commands::ollama_pull_embed_model,
            commands::list_alerts,
            commands::acknowledge_alert,
            commands::poll_alerts_now,
            commands::refetch_alert_history,
            commands::kb_db_path,
            commands::list_documents,
            commands::read_document,
            commands::system_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// resolve_kb_path / resolve_docs_root removed — assets are now embedded via
// `include_bytes!` / `include_dir!` and staged to app_data_dir at startup.
// See `assets.rs`.

#[allow(dead_code)]
fn _path_marker(_p: PathBuf) {}

pub fn spawn_alert_poller(app: AppHandle, state: AppState, region: &str) {
    let api_base =
        std::env::var("HUMAID_API_BASE").unwrap_or_else(|_| DEFAULT_API_BASE.to_string());
    let interval = std::env::var("HUMAID_POLL_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .map(Duration::from_secs)
        .unwrap_or_else(|| Duration::from_secs(POLL_BACKGROUND_SECS));
    let region_owned = region.to_string();
    tauri::async_runtime::spawn(async move {
        let poller = AlertPoller::new(api_base, region_owned, interval);
        poller.run(state.db, state.kb, app).await;
    });
}
