// Mirrors the Rust structs in src-tauri/src/models.rs.
// Keep in sync — Tauri serializes via serde with the field renamings declared there.

export type Role =
  | "local-community"
  | "local-authority"
  | "national-authorities"
  | "humanitarian-staff"
  | "ngos"
  | "first-respondants";

export type Region = "la-mojana" | "putumayo" | "generic";
export type Phase = "pre" | "event" | "post";
export type Language = "en" | "es";

export interface Profile {
  role: Role;
  region: Region;
  language: Language;
}

export interface QaRow {
  id: string;
  role: string;
  phase: string;
  region: string;
  topic: string;
  question_en: string;
  question_es: string;
  answer_en: string;
  answer_es: string;
  references: string;
  ref_types: string;
}

export interface QaMatch extends QaRow {
  similarity: number;
}

export interface KbStats {
  total: number;
  by_role: Record<string, number>;
  by_phase: Record<string, number>;
  by_region: Record<string, number>;
}

export interface FloodLabels {
  flood_present: boolean;
  flood_severity: "none" | "minor" | "moderate" | "severe";
  water_coverage_pct_estimate: "<10%" | "10-30%" | "30-60%" | ">60%";
  populated_area_affected: boolean;
  infrastructure_at_risk: boolean;
  river_overflow_visible: boolean;
  image_quality_limited: boolean;
}

export interface AlertCoords {
  lat: number;
  lon: number;
}

export interface AlertImages {
  pre_rgb?: string;
  cur_rgb?: string;
  pre_swir?: string;
  cur_swir?: string;
  thumb_b64?: string;
}

export interface AlertSource {
  kind: string;
  scenario_id?: string;
}

export interface Alert {
  id: string;
  timestamp: string;
  region: string;
  location: string;
  /** Human-readable location, e.g. "San Benito Abad, Sucre". */
  location_label?: string;
  severity: "moderate" | "severe" | string;
  labels: FloodLabels;
  recommended_qa_ids: string[];
  coordinates?: AlertCoords;
  /** Single watermarked PNG ("📡 ONBOARD · LFM2-VL-450M · computed in space"). */
  thumbnail_url?: string;
  source?: AlertSource;
  summary?: string;
  images?: AlertImages;
  is_new?: boolean;
}

export interface AlertEvent {
  alert: Alert;
  recommended_qa: QaRow[];
}

export interface OllamaStatus {
  reachable: boolean;
  embed_model_present: boolean;
  base_url: string;
  embed_model: string;
}

export interface DocSummary {
  path: string;
  title: string;
  size_bytes: number;
  citation_count: number;
  exists: boolean;
}

export interface DocContent {
  path: string;
  title: string;
  markdown: string;
  size_bytes: number;
  citing_qa_ids: string[];
}

export interface SystemInfo {
  ollama: OllamaStatus;
  kb_path: string;
  kb_total: number;
  docs_root: string;
  docs_total: number;
  api_base: string;
}

export type PhaseFilter = "all" | Phase;

export const ROLE_LABELS: Record<Role, string> = {
  "local-community": "Local community",
  "local-authority": "Local authority",
  "national-authorities": "National authorities",
  "humanitarian-staff": "Humanitarian staff",
  "ngos": "NGO",
  "first-respondants": "First responder",
};

export const REGION_LABELS: Record<Region, string> = {
  "la-mojana": "La Mojana",
  "putumayo": "Putumayo",
  "generic": "Generic",
};

export const PHASE_LABELS: Record<Phase, string> = {
  pre: "Pre",
  event: "Event",
  post: "Post",
};
