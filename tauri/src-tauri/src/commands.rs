// Tauri IPC handlers. Thin layer — they delegate to the modules under `state`.
// All errors come back to the frontend as plain strings.

use std::sync::Arc;

use tauri::{AppHandle, State};

use serde::Serialize;

use crate::alerts::AlertPoller;
use crate::docs::{DocContent, DocSummary};
use crate::models::{
    Alert, KbStats, OllamaStatus, Profile, QaMatch, QaRow,
};
use crate::AppState;

#[tauri::command]
pub fn get_profile(state: State<AppState>) -> Result<Option<Profile>, String> {
    state.db.get_profile().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_profile(
    profile: Profile,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.set_profile(&profile).map_err(|e| e.to_string())?;
    // Restart the alert poller against the new region.
    crate::spawn_alert_poller(app, state.inner().clone(), &profile.region);
    Ok(())
}

#[tauri::command]
pub fn list_qa(
    role: Option<String>,
    phase: Option<String>,
    region: Option<String>,
    topic: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
    state: State<AppState>,
) -> Result<Vec<QaRow>, String> {
    state
        .kb
        .list(
            role.as_deref(),
            phase.as_deref(),
            region.as_deref(),
            topic.as_deref(),
            limit.unwrap_or(100),
            offset.unwrap_or(0),
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_qa(id: String, state: State<AppState>) -> Result<Option<QaRow>, String> {
    state.kb.get(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_qa_many(ids: Vec<String>, state: State<AppState>) -> Result<Vec<QaRow>, String> {
    state.kb.get_many(&ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn kb_stats(state: State<AppState>) -> Result<KbStats, String> {
    state.kb.stats().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn kb_topics(state: State<AppState>) -> Result<Vec<(String, u64)>, String> {
    state.kb.topics().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn qa_search(
    query: String,
    role: Option<String>,
    phase: Option<String>,
    region: Option<String>,
    limit: Option<u32>,
    min_similarity: Option<f32>,
    state: State<'_, AppState>,
) -> Result<Vec<QaMatch>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }

    // Path 1: local — embed via Ollama, run cosine in DuckDB. This is the
    // desktop happy path. On Android (no Ollama daemon) it always fails fast,
    // and we fall through to the remote endpoint.
    let local = local_qa_search(
        q,
        role.as_deref(),
        phase.as_deref(),
        region.as_deref(),
        limit,
        min_similarity,
        &state,
    )
    .await;

    if let Ok(matches) = local {
        return Ok(matches);
    }
    let local_err = local.err().unwrap_or_default();

    // Path 2: remote — POST to the website's /api/qa. Same engine, server-side.
    // Used on mobile where Ollama isn't available, or when the user hasn't
    // pulled the embed model yet.
    let api_base = std::env::var("HUMAID_API_BASE")
        .unwrap_or_else(|_| crate::DEFAULT_API_BASE.to_string());
    remote_qa_search(
        &api_base,
        q,
        role.as_deref(),
        phase.as_deref(),
        region.as_deref(),
        limit,
        min_similarity,
    )
    .await
    .map_err(|remote_err| format!("local: {local_err} · remote: {remote_err}"))
}

async fn local_qa_search(
    q: &str,
    role: Option<&str>,
    phase: Option<&str>,
    region: Option<&str>,
    limit: Option<u32>,
    min_similarity: Option<f32>,
    state: &State<'_, AppState>,
) -> Result<Vec<QaMatch>, String> {
    let embeds = state
        .ollama
        .embed(crate::ollama::EMBED_MODEL, &[q])
        .await?;
    let qvec = embeds
        .into_iter()
        .next()
        .ok_or_else(|| "ollama returned no embeddings".to_string())?;
    let kb = state.kb.clone();
    let role = role.map(|s| s.to_string());
    let phase = phase.map(|s| s.to_string());
    let region = region.map(|s| s.to_string());
    tokio::task::spawn_blocking(move || {
        kb.search(
            &qvec,
            role.as_deref(),
            phase.as_deref(),
            region.as_deref(),
            limit.unwrap_or(5),
            min_similarity.unwrap_or(0.4),
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("blocking task: {e}"))?
}

async fn remote_qa_search(
    api_base: &str,
    query: &str,
    role: Option<&str>,
    phase: Option<&str>,
    region: Option<&str>,
    limit: Option<u32>,
    min_similarity: Option<f32>,
) -> Result<Vec<QaMatch>, String> {
    use serde::{Deserialize, Serialize};

    #[derive(Serialize)]
    struct Req<'a> {
        query: &'a str,
        #[serde(skip_serializing_if = "Option::is_none")]
        role: Option<&'a str>,
        #[serde(skip_serializing_if = "Option::is_none")]
        phase: Option<&'a str>,
        #[serde(skip_serializing_if = "Option::is_none")]
        region: Option<&'a str>,
        limit: u32,
        #[serde(rename = "minSimilarity")]
        min_similarity: f32,
    }
    #[derive(Deserialize)]
    struct Resp {
        matches: Vec<QaMatch>,
    }

    let url = format!("{}/api/qa", api_base.trim_end_matches('/'));
    let req = Req {
        query,
        role,
        phase,
        region,
        limit: limit.unwrap_or(5),
        min_similarity: min_similarity.unwrap_or(0.4),
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("build http: {e}"))?;
    let resp = client
        .post(&url)
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("remote /api/qa request: {e}"))?;
    if !resp.status().is_success() {
        let s = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("remote /api/qa {s}: {}", body.chars().take(200).collect::<String>()));
    }
    let body: Resp = resp
        .json()
        .await
        .map_err(|e| format!("decode /api/qa: {e}"))?;
    Ok(body.matches)
}

#[tauri::command]
pub async fn ollama_status(state: State<'_, AppState>) -> Result<OllamaStatus, String> {
    Ok(state.ollama.status().await)
}

#[tauri::command]
pub async fn ollama_pull_embed_model(state: State<'_, AppState>) -> Result<(), String> {
    state.ollama.pull(crate::ollama::EMBED_MODEL).await
}

#[tauri::command]
pub fn list_alerts(
    region: Option<String>,
    limit: Option<u32>,
    state: State<AppState>,
) -> Result<Vec<Alert>, String> {
    state
        .db
        .list_alerts(region.as_deref(), limit.unwrap_or(100))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn acknowledge_alert(id: String, state: State<AppState>) -> Result<(), String> {
    state.db.acknowledge_alert(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn poll_alerts_now(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<Alert>, String> {
    let profile = state.db.get_profile().map_err(|e| e.to_string())?;
    let region = match profile {
        Some(p) => p.region,
        None => return Err("no profile configured".into()),
    };
    let api_base = std::env::var("HUMAID_API_BASE")
        .unwrap_or_else(|_| crate::DEFAULT_API_BASE.to_string());
    let poller = AlertPoller::new(api_base, region, std::time::Duration::from_secs(0));
    poller
        .poll_once(&state.db, &state.kb, &app)
        .await
}

/// Wipe the alert cursor(s) so the next poll fetches the full server history.
/// Existing rows in the local `alerts` table are kept; INSERT OR IGNORE on
/// duplicate IDs just no-ops.
#[tauri::command]
pub async fn refetch_alert_history(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<Alert>, String> {
    state
        .db
        .delete_cursors_with_prefix("alerts:since:")
        .map_err(|e| format!("clear cursors: {e}"))?;
    poll_alerts_now(app, state).await
}

#[tauri::command]
pub fn kb_db_path(state: State<AppState>) -> Result<String, String> {
    Ok(state.kb.path().to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_documents(state: State<AppState>) -> Result<Vec<DocSummary>, String> {
    state.docs.list(&state.kb)
}

#[tauri::command]
pub fn read_document(path: String, state: State<AppState>) -> Result<DocContent, String> {
    state.docs.read(&state.kb, &path)
}

#[derive(Debug, Serialize)]
pub struct SystemInfo {
    pub ollama: OllamaStatus,
    pub kb_path: String,
    pub kb_total: u64,
    pub docs_root: String,
    pub docs_total: u32,
    pub api_base: String,
}

#[tauri::command]
pub async fn system_info(state: State<'_, AppState>) -> Result<SystemInfo, String> {
    let ollama = state.ollama.status().await;
    let kb_total = state
        .kb
        .stats()
        .map_err(|e| e.to_string())
        .map(|s| s.total)
        .unwrap_or(0);
    let docs_total = state
        .docs
        .list(&state.kb)
        .map(|v| v.len() as u32)
        .unwrap_or(0);
    let api_base =
        std::env::var("HUMAID_API_BASE").unwrap_or_else(|_| crate::DEFAULT_API_BASE.to_string());
    Ok(SystemInfo {
        ollama,
        kb_path: state.kb.path().to_string_lossy().to_string(),
        kb_total,
        docs_root: state.docs.root().to_string_lossy().to_string(),
        docs_total,
        api_base,
    })
}

// Suppress unused warnings on AppState clone helper not yet used by all callers.
#[allow(dead_code)]
pub(crate) fn _state_marker(_a: Arc<AppState>) {}
