use serde::{Deserialize, Serialize};

// Role / region / phase are passed around as strings (kebab-case slugs) — the
// canonical values come from `knowledge-base/qa-pairs.csv`. We don't enumerate
// them in Rust because the KB is the source of truth.

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    En,
    Es,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub role: String,
    pub region: String,
    pub language: Language,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QaRow {
    pub id: String,
    pub role: String,
    pub phase: String,
    pub region: String,
    pub topic: String,
    pub question_en: String,
    pub question_es: String,
    pub answer_en: String,
    pub answer_es: String,
    pub references: String,
    pub ref_types: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QaMatch {
    #[serde(flatten)]
    pub row: QaRow,
    pub similarity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KbStats {
    pub total: u64,
    pub by_role: std::collections::BTreeMap<String, u64>,
    pub by_phase: std::collections::BTreeMap<String, u64>,
    pub by_region: std::collections::BTreeMap<String, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FloodLabels {
    pub flood_present: bool,
    pub flood_severity: String,
    pub water_coverage_pct_estimate: String,
    pub populated_area_affected: bool,
    pub infrastructure_at_risk: bool,
    pub river_overflow_visible: bool,
    pub image_quality_limited: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertCoords {
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AlertImages {
    /// Optional full-resolution URLs. If the server only ships a single
    /// watermarked thumbnail (`Alert::thumbnail_url`), these can all be None.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pre_rgb: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cur_rgb: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pre_swir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cur_swir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumb_b64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertSource {
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scenario_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: String,
    pub timestamp: String,
    pub region: String,
    pub location: String,
    pub severity: String,
    pub labels: FloodLabels,
    pub recommended_qa_ids: Vec<String>,

    // Server-provided geo.  `coords` is accepted as an alias for older
    // local payloads that were stored before the contract was finalised.
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        alias = "coords"
    )]
    pub coordinates: Option<AlertCoords>,

    /// Human-readable name (e.g. "San Benito Abad, Sucre") — distinct from the
    /// `location` slug.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location_label: Option<String>,

    /// Single watermarked PNG ("📡 ONBOARD · LFM2-VL-450M · computed in space").
    /// When the server returns a relative path, the poller absolutises it
    /// against the API base before storing.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,

    /// Provenance: where did this alert come from? (e.g. "simulator").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<AlertSource>,

    /// LLM-generated 1–2 sentence gloss. Optional; not currently emitted.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,

    /// Reserved for future 4-up RGB+SWIR pairing. Currently unused by the
    /// server — kept on the model so a later contract change is additive.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub images: Option<AlertImages>,

    /// True the first time this alert is materialized locally; false on subsequent reads.
    #[serde(default)]
    pub is_new: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertEvent {
    pub alert: Alert,
    pub recommended_qa: Vec<QaRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub reachable: bool,
    pub embed_model_present: bool,
    pub base_url: String,
    pub embed_model: String,
}
