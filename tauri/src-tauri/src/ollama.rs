// Thin Ollama HTTP client. Mirrors the contract in `website/lib/ollama.ts`,
// but on desktop we only *talk* to a local daemon — we don't supervise one in
// V1. Detection: probe `/api/tags`. If it's not up, surface a clear error to
// the UI and ask the user to install / start Ollama.

use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::models::OllamaStatus;

const DEFAULT_BASE: &str = "http://127.0.0.1:11434";
pub const EMBED_MODEL: &str = "nomic-embed-text";

pub struct OllamaClient {
    base: String,
    http: reqwest::Client,
}

impl OllamaClient {
    pub fn new() -> Self {
        let base = std::env::var("OLLAMA_HOST")
            .map(|h| {
                if h.starts_with("http") {
                    h
                } else {
                    format!("http://{}", h)
                }
            })
            .unwrap_or_else(|_| DEFAULT_BASE.to_string());
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .expect("reqwest client");
        Self { base, http }
    }

    pub fn base(&self) -> &str {
        &self.base
    }

    pub async fn status(&self) -> OllamaStatus {
        let mut s = OllamaStatus {
            reachable: false,
            embed_model_present: false,
            base_url: self.base.clone(),
            embed_model: EMBED_MODEL.to_string(),
        };
        match self.list_models().await {
            Ok(models) => {
                s.reachable = true;
                s.embed_model_present = models
                    .iter()
                    .any(|m| m == EMBED_MODEL || m.starts_with(&format!("{}:", EMBED_MODEL)));
            }
            Err(_) => {}
        }
        s
    }

    pub async fn list_models(&self) -> Result<Vec<String>, reqwest::Error> {
        #[derive(Deserialize)]
        struct Tag {
            name: String,
        }
        #[derive(Deserialize)]
        struct Tags {
            models: Vec<Tag>,
        }
        let url = format!("{}/api/tags", self.base);
        let r = self
            .http
            .get(&url)
            .timeout(Duration::from_millis(1500))
            .send()
            .await?
            .error_for_status()?;
        let tags: Tags = r.json().await?;
        Ok(tags.models.into_iter().map(|m| m.name).collect())
    }

    /// Pulls a model — blocking call (stream=false). Long.
    pub async fn pull(&self, model: &str) -> Result<(), String> {
        #[derive(Serialize)]
        struct Req<'a> {
            name: &'a str,
            stream: bool,
        }
        let url = format!("{}/api/pull", self.base);
        let resp = self
            .http
            .post(&url)
            .json(&Req {
                name: model,
                stream: false,
            })
            .timeout(Duration::from_secs(60 * 30))
            .send()
            .await
            .map_err(|e| format!("ollama pull request failed: {e}"))?;
        if !resp.status().is_success() {
            let s = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("ollama pull {model} failed ({s}): {body}"));
        }
        Ok(())
    }

    pub async fn embed(&self, model: &str, texts: &[&str]) -> Result<Vec<Vec<f32>>, String> {
        if texts.is_empty() {
            return Ok(vec![]);
        }
        #[derive(Serialize)]
        struct Req<'a> {
            model: &'a str,
            input: &'a [&'a str],
        }
        #[derive(Deserialize)]
        struct Resp {
            embeddings: Vec<Vec<f32>>,
        }
        let url = format!("{}/api/embed", self.base);
        let resp = self
            .http
            .post(&url)
            .json(&Req { model, input: texts })
            .send()
            .await
            .map_err(|e| format!("ollama embed request failed: {e}"))?;
        if !resp.status().is_success() {
            let s = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("ollama embed failed ({s}): {}", body.chars().take(300).collect::<String>()));
        }
        let body: Resp = resp.json().await.map_err(|e| format!("decode embed response: {e}"))?;
        if body.embeddings.len() != texts.len() {
            return Err(format!(
                "ollama embed returned {} for {} inputs",
                body.embeddings.len(),
                texts.len()
            ));
        }
        Ok(body.embeddings)
    }
}

impl Default for OllamaClient {
    fn default() -> Self {
        Self::new()
    }
}
