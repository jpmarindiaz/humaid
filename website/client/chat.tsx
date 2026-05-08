/** @jsxRuntime automatic */
/** @jsxImportSource react */
// humaid demo — two tabs in editorial-light theme:
//
//   Knowledge base   chat thread + filtered document repository, side-by-side
//                    (role/region/phase filters apply to BOTH the QA search
//                    and which docs are highlighted as "in scope")
//   Flood detection  4-image upload OR one of 3 pre-loaded sample pairs

import { createRoot } from "react-dom/client";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────

interface QaMatch {
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
  similarity: number;
}

interface FloodLabels {
  flood_present: boolean;
  flood_severity: "none" | "minor" | "moderate" | "severe";
  water_coverage_pct_estimate: "<10%" | "10-30%" | "30-60%" | ">60%";
  populated_area_affected: boolean;
  infrastructure_at_risk: boolean;
  river_overflow_visible: boolean;
  image_quality_limited: boolean;
}

interface Source {
  slug: string;
  publisher: string;
  year: number;
  region: "la-mojana" | "putumayo" | "national" | "global";
  title: string;
  summary: string;
}

interface FloodSample {
  id: string;
  location_slug: string;
  location_label: string;
  region: "la-mojana" | "putumayo";
  lon: number;
  lat: number;
  event_date: string;
  event_label: string;
  description: string;
  expected_summary: string;
  expected_alert: boolean;
  paths: { pre_rgb: string; pre_swir: string; cur_rgb: string; cur_swir: string };
  thumbnail: string;
  ground_truth_labels: FloodLabels;
}

interface AlertRecord {
  id: string;
  timestamp: string;
  region: "la-mojana" | "putumayo";
  location: string;
  location_label: string;
  coordinates: { lon: number; lat: number };
  severity: "minor" | "moderate" | "severe";
  labels: FloodLabels;
  recommended_qa_ids: string[];
  thumbnail_url: string;
  message?: string;
  source: { kind: "simulator" | "live_simsat" | "manual"; scenario_id?: string };
}

type ChatPayload =
  | { kind: "qa"; query: string; matches: QaMatch[] }
  | { kind: "flood"; ok: true; labels: FloodLabels; latency_ms: number; sample_id?: string }
  | { kind: "flood"; ok: false; error: string }
  | { kind: "alert-published"; alert: AlertRecord }
  | { kind: "alert-rejected"; reason: string; labels: FloodLabels }
  | { kind: "error"; error: string };

const FLOOD_SLOTS = [
  { field: "pre_rgb",  label: "Baseline · RGB" },
  { field: "pre_swir", label: "Baseline · SWIR" },
  { field: "cur_rgb",  label: "Current · RGB" },
  { field: "cur_swir", label: "Current · SWIR" },
] as const;
type FloodField = typeof FLOOD_SLOTS[number]["field"];

const ROLES = [
  { value: "",                     label: "All roles" },
  { value: "local-community",      label: "Local community member" },
  { value: "local-authority",      label: "Local authority (alcaldía / CMGRD)" },
  { value: "national-authorities", label: "National authority (UNGRD / IDEAM)" },
  { value: "humanitarian-staff",   label: "Humanitarian staff (OCHA / cluster)" },
  { value: "ngos",                 label: "NGO field staff" },
  { value: "first-respondants",    label: "First responder (Cruz Roja / Defensa Civil)" },
] as const;

const REGIONS = [
  { value: "",          label: "All regions" },
  { value: "la-mojana", label: "La Mojana (Caribbean wetlands)" },
  { value: "putumayo",  label: "Putumayo (Andean–Amazon)" },
  { value: "generic",   label: "Generic (any region)" },
] as const;

const PHASES = [
  { value: "",      label: "All phases" },
  { value: "pre",   label: "Pre — preparation" },
  { value: "event", label: "Event — first 72 h" },
  { value: "post",  label: "Post — recovery" },
] as const;

interface UserText { kind: "text"; text: string; ts: number; role: string; region: string; phase: string; }
interface UserFlood { kind: "flood-submit"; previews: Record<FloodField, string>; sampleId?: string; ts: number; }
type UserTurn = UserText | UserFlood;
interface AssistantTurn { kind: "assistant"; payload: ChatPayload; ts: number; }
type Turn = UserTurn | AssistantTurn;

type Tab = "kb" | "flood";

// ── App shell ─────────────────────────────────────────────────────────

function App() {
  const [tab, setTab] = useState<Tab>("kb");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [role, setRole] = useState("");
  const [region, setRegion] = useState("");
  const [phase, setPhase] = useState("");
  const [floodFiles, setFloodFiles] = useState<Partial<Record<FloodField, Blob>>>({});
  const [floodPreviews, setFloodPreviews] = useState<Partial<Record<FloodField, string>>>({});
  const [activeSample, setActiveSample] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // The most recently retrieved docs (slug set) — used by the docs panel
  // to highlight which sources the model just cited.
  const [citedSlugs, setCitedSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function attachFloodFile(field: FloodField, file: File | null) {
    if (!file) {
      setFloodFiles((f) => { const c = { ...f }; delete c[field]; return c; });
      setFloodPreviews((p) => { const c = { ...p }; delete c[field]; return c; });
      setActiveSample(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setFloodFiles((f) => ({ ...f, [field]: file }));
    setFloodPreviews((p) => ({ ...p, [field]: url }));
    setActiveSample(undefined);
  }

  async function loadSample(s: FloodSample) {
    setSending(true);
    setError(null);
    try {
      const fields: FloodField[] = ["pre_rgb", "pre_swir", "cur_rgb", "cur_swir"];
      const blobs: Partial<Record<FloodField, Blob>> = {};
      const previews: Partial<Record<FloodField, string>> = {};
      for (const f of fields) {
        const r = await fetch(s.paths[f]);
        if (!r.ok) throw new Error(`failed to load ${f}: ${r.status}`);
        const b = await r.blob();
        blobs[f] = b;
        previews[f] = URL.createObjectURL(b);
      }
      setFloodFiles(blobs);
      setFloodPreviews(previews);
      setActiveSample(s.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  /** One-shot: load images, run inference, auto-publish if eligible.
   *  Each phase pushes a turn into the thread so the user sees progress. */
  async function runAndPublish(s: FloodSample) {
    if (sending) return;
    setError(null);
    setSending(true);

    const previews: Record<FloodField, string> = {
      pre_rgb:  s.paths.pre_rgb,
      pre_swir: s.paths.pre_swir,
      cur_rgb:  s.paths.cur_rgb,
      cur_swir: s.paths.cur_swir,
    };
    setTurns((p) => [...p, { kind: "flood-submit", previews, sampleId: s.id, ts: Date.now() }]);

    try {
      const fields: FloodField[] = ["pre_rgb", "pre_swir", "cur_rgb", "cur_swir"];
      const blobs: Record<FloodField, Blob> = {} as never;
      for (const f of fields) {
        const r = await fetch(s.paths[f]);
        if (!r.ok) throw new Error(`failed to load ${f}: ${r.status}`);
        blobs[f] = await r.blob();
      }

      const form = new FormData();
      for (const f of fields) form.append(f, blobs[f], `${f}.png`);
      const resp = await fetch("/api/chat", { method: "POST", body: form });
      const payload = (await resp.json()) as ChatPayload;

      if (payload.kind !== "flood" || !payload.ok) {
        const err = payload.kind === "flood" ? payload.error
                  : payload.kind === "error" ? payload.error
                  : "unknown error";
        setTurns((p) => [...p, { kind: "assistant", payload: { kind: "error", error: err }, ts: Date.now() }]);
        return;
      }
      payload.sample_id = s.id;
      setTurns((p) => [...p, { kind: "assistant", payload, ts: Date.now() }]);

      const labels = payload.labels;
      const eligible = labels.flood_present && labels.populated_area_affected && !labels.image_quality_limited;
      if (!eligible) {
        const reason = !labels.flood_present              ? "model didn't detect a flood"
                     : !labels.populated_area_affected    ? "no populated area visible"
                     :                                       "image quality limited";
        setTurns((p) => [...p, {
          kind: "assistant",
          payload: { kind: "alert-rejected", reason, labels },
          ts: Date.now(),
        }]);
        return;
      }

      const pubResp = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample_id: s.id, labels }),
      });
      const data = await pubResp.json() as { ok: boolean; alert?: AlertRecord; error?: string };
      if (data.ok && data.alert) {
        setTurns((p) => [...p, { kind: "assistant", payload: { kind: "alert-published", alert: data.alert! }, ts: Date.now() }]);
      } else {
        setTurns((p) => [...p, {
          kind: "assistant",
          payload: { kind: "alert-rejected", reason: data.error ?? "rejected", labels },
          ts: Date.now(),
        }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
      setFloodFiles({});
      setFloodPreviews({});
      setActiveSample(undefined);
    }
  }

  async function sendKb(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);

    const userTurn: UserText = { kind: "text", text, role, region, phase, ts: Date.now() };
    setTurns((p) => [...p, userTurn]);
    setInput("");

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          role:   role   || undefined,
          phase:  phase  || undefined,
          region: region || undefined,
        }),
      });
      const payload = (await resp.json()) as ChatPayload;
      setTurns((p) => [...p, { kind: "assistant", payload, ts: Date.now() }]);
      if (payload.kind === "qa") {
        setCitedSlugs(extractCitedSlugs(payload.matches));
      }
      if (!resp.ok && "error" in payload) setError(payload.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function sendFlood(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const missing = FLOOD_SLOTS.filter((s) => !floodFiles[s.field]).map((s) => s.field);
    if (missing.length) {
      setError(`Need all 4 images. Missing: ${missing.join(", ")}`);
      return;
    }
    setError(null);
    setSending(true);

    const sampleIdForRun = activeSample;  // capture before we reset
    const previews = floodPreviews as Record<FloodField, string>;
    setTurns((p) => [...p, { kind: "flood-submit", previews, sampleId: sampleIdForRun, ts: Date.now() }]);

    const form = new FormData();
    for (const slot of FLOOD_SLOTS) {
      const blob = floodFiles[slot.field]!;
      const filename = blob instanceof File ? blob.name : `${slot.field}.png`;
      form.append(slot.field, blob, filename);
    }

    try {
      const resp = await fetch("/api/chat", { method: "POST", body: form });
      const payload = (await resp.json()) as ChatPayload;
      // Tag the flood payload with sample_id so the bubble can offer
      // "Publish alert" without us needing additional state.
      if (payload.kind === "flood" && payload.ok && sampleIdForRun) {
        (payload as Extract<ChatPayload, { kind: "flood"; ok: true }>).sample_id = sampleIdForRun;
      }
      setTurns((p) => [...p, { kind: "assistant", payload, ts: Date.now() }]);
      setFloodFiles({});
      setFloodPreviews({});
      setActiveSample(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function publishAlert(sampleId: string, labels: FloodLabels) {
    setSending(true);
    setError(null);
    try {
      const resp = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample_id: sampleId, labels }),
      });
      const data = await resp.json() as { ok: boolean; alert?: AlertRecord; error?: string };
      if (data.ok && data.alert) {
        setTurns((p) => [...p, {
          kind: "assistant",
          payload: { kind: "alert-published", alert: data.alert! },
          ts: Date.now(),
        }]);
      } else {
        setTurns((p) => [...p, {
          kind: "assistant",
          payload: { kind: "alert-rejected", reason: data.error ?? "rejected", labels },
          ts: Date.now(),
        }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  /** Send the alert directly using the sample's ground-truth labels —
   *  no model run, no threshold check. Used for the "📡 Send alert"
   *  primary CTA on each sample card. Visible in /api/alerts within
   *  ~half a second; the desktop app picks it up on next poll. */
  async function sendSampleAlert(sample: FloodSample, message?: string) {
    if (sending) return;
    setError(null);
    setSending(true);
    setTurns((p) => [...p, {
      kind: "flood-submit",
      previews: {
        pre_rgb:  sample.paths.pre_rgb,
        pre_swir: sample.paths.pre_swir,
        cur_rgb:  sample.paths.cur_rgb,
        cur_swir: sample.paths.cur_swir,
      },
      sampleId: sample.id,
      ts: Date.now(),
    }]);
    try {
      const resp = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample_id: sample.id, manual: true, message }),
      });
      const data = await resp.json() as { ok: boolean; alert?: AlertRecord; error?: string };
      if (data.ok && data.alert) {
        setTurns((p) => [...p, {
          kind: "assistant",
          payload: { kind: "alert-published", alert: data.alert! },
          ts: Date.now(),
        }]);
      } else {
        setError(data.error ?? "publish failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  /** Run the flood model on a user-uploaded before/after pair. The
   *  model expects 4 tiles (pre+cur × RGB+SWIR); since the upload
   *  section only collects 2 RGB tiles we duplicate them into the SWIR
   *  slots. Output is degraded vs the real 4-band input but the model
   *  still runs and returns the 7-key JSON. */
  async function runUploadedModel(before: File, after: File) {
    if (sending) return;
    setError(null);
    setSending(true);

    const previews: Record<FloodField, string> = {
      pre_rgb:  URL.createObjectURL(before),
      pre_swir: URL.createObjectURL(before),
      cur_rgb:  URL.createObjectURL(after),
      cur_swir: URL.createObjectURL(after),
    };
    setTurns((p) => [...p, { kind: "flood-submit", previews, ts: Date.now() }]);

    try {
      const form = new FormData();
      form.append("pre_rgb",  before, "pre_rgb.png");
      form.append("pre_swir", before, "pre_swir.png");
      form.append("cur_rgb",  after,  "cur_rgb.png");
      form.append("cur_swir", after,  "cur_swir.png");
      const resp = await fetch("/api/chat", { method: "POST", body: form });
      const payload = (await resp.json()) as ChatPayload;
      setTurns((p) => [...p, { kind: "assistant", payload, ts: Date.now() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  /** Custom manual alert from the upload section. Server uses the
   *  generic upload thumbnail; coordinates default to 0,0 if user
   *  doesn't supply them. */
  async function sendCustomAlert(payload: {
    region: "la-mojana" | "putumayo";
    location_label: string;
    severity: "minor" | "moderate" | "severe";
    message?: string;
    lon?: number;
    lat?: number;
    previews?: Record<FloodField, string>;
  }) {
    if (sending) return;
    setError(null);
    setSending(true);
    if (payload.previews) {
      setTurns((p) => [...p, { kind: "flood-submit", previews: payload.previews!, ts: Date.now() }]);
    }
    try {
      const resp = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          manual: true,
          region: payload.region,
          location_label: payload.location_label,
          severity: payload.severity,
          message: payload.message,
          lon: payload.lon,
          lat: payload.lat,
        }),
      });
      const data = await resp.json() as { ok: boolean; alert?: AlertRecord; error?: string };
      if (data.ok && data.alert) {
        setTurns((p) => [...p, {
          kind: "assistant",
          payload: { kind: "alert-published", alert: data.alert! },
          ts: Date.now(),
        }]);
      } else {
        setError(data.error ?? "publish failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setTurns([]);
    setError(null);
    setInput("");
    setFloodFiles({});
    setFloodPreviews({});
    setActiveSample(undefined);
    setCitedSlugs(new Set());
  }

  return (
    <div className="app">
      <header className="app-nav">
        <a href="/" className="brand"><span className="dot" /><span>humaid</span></a>
        <div className="app-nav-right">
          <a href="/" className="muted-link">← landing</a>
          <button type="button" onClick={reset} className="ghost-btn">new</button>
        </div>
      </header>

      <Tabs tab={tab} onChange={setTab} />

      <ProfileBar
        role={role} setRole={setRole}
        region={region} setRegion={setRegion}
        phase={phase} setPhase={setPhase}
      />

      {tab === "kb" && (
        <KbTab
          turns={turns} sending={sending} error={error} scrollRef={scrollRef}
          input={input} setInput={setInput}
          role={role} region={region} phase={phase}
          onSubmit={sendKb}
          citedSlugs={citedSlugs}
        />
      )}
      {tab === "flood" && (
        <FloodTab
          turns={turns} sending={sending} error={error} scrollRef={scrollRef}
          onSendSampleAlert={sendSampleAlert}
          onRunAndPublish={runAndPublish}
          onSendCustomAlert={sendCustomAlert}
          onRunUploadedModel={runUploadedModel}
        />
      )}
    </div>
  );
}

function extractCitedSlugs(matches: QaMatch[]): Set<string> {
  const out = new Set<string>();
  for (const m of matches) {
    if (!m.references) continue;
    for (const ref of m.references.split("|")) {
      const slug = ref.trim()
        .replace(/^research\/download-md\//, "")
        .replace(/\.md$/, "");
      if (slug) out.add(slug);
    }
  }
  return out;
}

// ── Tabs ──────────────────────────────────────────────────────────────

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const item = (t: Tab, label: string, hint: string) => (
    <button
      type="button"
      onClick={() => onChange(t)}
      className={`tab${tab === t ? " tab-active" : ""}`}
    >
      <div className="tab-label">{label}</div>
      <div className="tab-hint">{hint}</div>
    </button>
  );
  return (
    <div className="tabs">
      {item("kb",    "Knowledge base",   "laptop · 471 Q&A · 17 source PDFs")}
      {item("flood", "Flood detection",  "satellite · llama-server + lfm2-flood")}
    </div>
  );
}

function ProfileBar({
  role, setRole, region, setRegion, phase, setPhase,
}: {
  role: string; setRole: (s: string) => void;
  region: string; setRegion: (s: string) => void;
  phase: string; setPhase: (s: string) => void;
}) {
  return (
    <div className="profile-bar">
      <span className="profile-label">I am a</span>
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <span className="profile-label">in</span>
      <select value={region} onChange={(e) => setRegion(e.target.value)}>
        {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <span className="profile-label">·</span>
      <select value={phase} onChange={(e) => setPhase(e.target.value)}>
        {PHASES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
    </div>
  );
}

// ── Knowledge-base tab: chat (left) + docs (right) ────────────────────

function KbTab(props: {
  turns: Turn[]; sending: boolean; error: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  input: string; setInput: (s: string) => void;
  role: string; region: string; phase: string;
  onSubmit: (e: FormEvent) => void;
  citedSlugs: Set<string>;
}) {
  return (
    <div className="kb-split">
      <section className="kb-chat">
        <div ref={props.scrollRef} className="scroll">
          <div className="thread">
            {props.turns.length === 0 && <KbWelcome onPick={props.setInput} />}
            {props.turns.map((t, i) => <TurnBubble key={i} turn={t} />)}
            {props.sending && <div className="thinking">retrieving…</div>}
            {props.error && <div className="error-bubble">{props.error}</div>}
          </div>
        </div>
        <form onSubmit={props.onSubmit} className="composer">
          <div className="composer-inner">
            <textarea
              value={props.input}
              onChange={(e) => props.setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void props.onSubmit(e as unknown as FormEvent);
                }
              }}
              disabled={props.sending}
              rows={1}
              placeholder="Ask the knowledge base…"
            />
            <button type="submit" disabled={props.sending || !props.input.trim()} className="primary-btn">
              {props.sending ? "…" : "send"}
            </button>
          </div>
        </form>
      </section>
      <aside className="kb-docs">
        <DocsPanel region={props.region} citedSlugs={props.citedSlugs} />
      </aside>
    </div>
  );
}

function KbWelcome({ onPick }: { onPick: (s: string) => void }) {
  const suggestions = [
    "How do I evacuate when the river rises overnight?",
    "¿Qué debe llevar la mochila de emergencia?",
    "What triage protocol do I use at the impact site?",
    "¿Cuándo declarar Calamidad Pública?",
  ];
  return (
    <div className="welcome">
      <p className="welcome-title">Ask the knowledge base</p>
      <p className="welcome-sub">
        471 bilingual Q&amp;A pairs grounded in 17 source PDFs (panel on the right).
        Pick your role, region and phase above so the answers fit the context
        you're acting in. Cited documents will be highlighted on the right.
      </p>
      <div className="suggestions">
        {suggestions.map((s) => (
          <button key={s} type="button" className="suggestion" onClick={() => onPick(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Document repository panel ─────────────────────────────────────────

function DocsPanel({ region, citedSlugs }: { region: string; citedSlugs: Set<string> }) {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((d) => setSources(d.sources))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Filter rules:
  //   - region empty                → show all
  //   - region la-mojana | putumayo → show that region + national + global
  //   - region generic              → show all (the KB's "generic" maps to no doc filter)
  const visible = useMemo(() => {
    if (!sources) return [] as Source[];
    if (!region || region === "generic") return sources;
    return sources.filter((s) => s.region === region || s.region === "national" || s.region === "global");
  }, [sources, region]);

  // When citations exist, sort cited first (within filtered set).
  const sorted = useMemo(() => {
    return [...visible].sort((a, b) => {
      const ac = citedSlugs.has(a.slug) ? 0 : 1;
      const bc = citedSlugs.has(b.slug) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return b.year - a.year;
    });
  }, [visible, citedSlugs]);

  return (
    <div className="docs-panel">
      <header className="docs-panel-head">
        <p className="docs-panel-title">Source documents</p>
        <p className="docs-panel-meta">
          {sources
            ? `${visible.length} of ${sources.length} shown${region ? ` · region: ${region}` : ""}${citedSlugs.size ? ` · ${citedSlugs.size} cited` : ""}`
            : "loading…"}
        </p>
      </header>
      <div className="docs-list">
        {error && <div className="error-bubble">{error}</div>}
        {!sources && <div className="thinking">loading sources…</div>}
        {sorted.map((s) => (
          <SourceCard key={s.slug} source={s} cited={citedSlugs.has(s.slug)} />
        ))}
      </div>
    </div>
  );
}

function SourceCard({ source, cited }: { source: Source; cited: boolean }) {
  return (
    <article className={`source-card${cited ? " source-card-cited" : ""}`}>
      <header>
        <span className={`region-pill region-${source.region}`}>{source.region}</span>
        <span className="source-meta">{source.year} · {source.publisher}</span>
        {cited && <span className="cited-pill">cited</span>}
      </header>
      <h3>{source.title}</h3>
      <p>{source.summary}</p>
      <p className="source-slug">{source.slug}.md</p>
    </article>
  );
}

// ── Flood tab ─────────────────────────────────────────────────────────

function FloodTab(props: {
  turns: Turn[]; sending: boolean; error: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSendSampleAlert: (s: FloodSample, message?: string) => void;
  onRunAndPublish: (s: FloodSample) => void;
  onSendCustomAlert: (p: {
    region: "la-mojana" | "putumayo";
    location_label: string;
    severity: "minor" | "moderate" | "severe";
    message?: string;
    lon?: number;
    lat?: number;
    previews?: Record<FloodField, string>;
  }) => void;
  onRunUploadedModel: (before: File, after: File) => void;
}) {
  const [samples, setSamples] = useState<FloodSample[] | null>(null);

  useEffect(() => {
    fetch("/api/samples")
      .then((r) => r.json())
      .then((d) => setSamples(d.samples))
      .catch(() => {});
  }, []);

  return (
    <div className="flood-tab">
      <div ref={props.scrollRef} className="scroll">
        <div className="thread">
          {props.turns.length === 0 && (
            <FloodWelcome
              samples={samples}
              sending={props.sending}
              onSendSampleAlert={props.onSendSampleAlert}
              onRunAndPublish={props.onRunAndPublish}
              onSendCustomAlert={props.onSendCustomAlert}
              onRunUploadedModel={props.onRunUploadedModel}
            />
          )}
          {props.turns.length > 0 && samples && !props.sending && (
            <SampleStrip samples={samples} onSendSampleAlert={props.onSendSampleAlert} />
          )}
          {props.turns.map((t, i) => <TurnBubble key={i} turn={t} />)}
          {props.sending && <div className="thinking">publishing alert…</div>}
          {props.error && <div className="error-bubble">{props.error}</div>}
        </div>
      </div>
    </div>
  );
}

function FloodWelcome({
  samples, sending, onSendSampleAlert, onRunAndPublish, onSendCustomAlert, onRunUploadedModel,
}: {
  samples: FloodSample[] | null;
  sending: boolean;
  onSendSampleAlert: (s: FloodSample, message?: string) => void;
  onRunAndPublish: (s: FloodSample) => void;
  onSendCustomAlert: (p: {
    region: "la-mojana" | "putumayo";
    location_label: string;
    severity: "minor" | "moderate" | "severe";
    message?: string;
    lon?: number;
    lat?: number;
    previews?: Record<FloodField, string>;
  }) => void;
  onRunUploadedModel: (before: File, after: File) => void;
}) {
  return (
    <div className="welcome welcome-wide">
      <p className="welcome-title">Satellite flood detection · alert simulator</p>
      <p className="welcome-sub">
        Click <strong>📡 Send alert</strong> on either scenario below to publish a flood
        alert with the dataset's verified labels — desktop app picks it up
        on the next poll. The "Run model" link runs the bundled LFM2-VL
        first; if its labels pass the threshold, the alert publishes
        automatically.
      </p>
      {samples && (
        <div className="sample-grid">
          {samples.map((s) => (
            <SampleCard
              key={s.id}
              sample={s}
              sending={sending}
              onSendAlert={onSendSampleAlert}
              onRunModel={onRunAndPublish}
            />
          ))}
        </div>
      )}
      <UploadSection
        sending={sending}
        onPublish={onSendCustomAlert}
        onRunModel={onRunUploadedModel}
      />
    </div>
  );
}

function SampleCard({ sample, sending, onSendAlert, onRunModel }: {
  sample: FloodSample;
  sending: boolean;
  onSendAlert: (s: FloodSample, message?: string) => void;
  onRunModel: (s: FloodSample) => void;
}) {
  return (
    <article className="sample-card sample-card-cta">
      <div className="sample-thumbs">
        <img src={sample.paths.pre_rgb} alt="pre RGB" />
        <img src={sample.paths.cur_rgb} alt="current RGB" />
      </div>
      <div className="sample-text">
        <span className={`region-pill region-${sample.region}`}>{sample.region}</span>
        <h4>{sample.event_label}</h4>
        <p className="sample-loc">{sample.location_label} · {sample.lat.toFixed(3)}, {sample.lon.toFixed(3)}</p>
        <p className="sample-desc">{sample.description}</p>
        <div className="sample-actions">
          <button
            type="button"
            onClick={() => onSendAlert(sample)}
            disabled={sending}
            className="primary-btn sample-run-btn"
          >
            {sending ? "publishing…" : "📡  Send alert"}
          </button>
          <button
            type="button"
            onClick={() => onRunModel(sample)}
            disabled={sending}
            className="ghost-link"
          >
            or run the model first
          </button>
        </div>
      </div>
    </article>
  );
}

function SampleStrip({
  samples, onSendSampleAlert,
}: {
  samples: FloodSample[];
  onSendSampleAlert: (s: FloodSample, message?: string) => void;
}) {
  return (
    <div className="sample-strip">
      <span className="sample-strip-label">Send another:</span>
      {samples.map((s) => (
        <button
          key={s.id} type="button"
          onClick={() => onSendSampleAlert(s)}
          className="sample-strip-btn"
          title={s.description}
        >
          📡 {s.event_label}
        </button>
      ))}
    </div>
  );
}

// ── Upload section ────────────────────────────────────────────────────

function UploadSection({
  sending, onPublish, onRunModel,
}: {
  sending: boolean;
  onPublish: (p: {
    region: "la-mojana" | "putumayo";
    location_label: string;
    severity: "minor" | "moderate" | "severe";
    message?: string;
    lon?: number;
    lat?: number;
    previews?: Record<FloodField, string>;
  }) => void;
  onRunModel: (before: File, after: File) => void;
}) {
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [region, setRegion] = useState<"la-mojana" | "putumayo">("la-mojana");
  const [locationLabel, setLocationLabel] = useState("Custom location");
  const [severity, setSeverity] = useState<"minor" | "moderate" | "severe">("moderate");
  const [message, setMessage] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");

  const beforePreview = before ? URL.createObjectURL(before) : undefined;
  const afterPreview  = after  ? URL.createObjectURL(after)  : undefined;
  const havePair = before && after;

  function publish() {
    if (!locationLabel.trim()) return;
    const previews = before && after && beforePreview && afterPreview ? {
      pre_rgb:  beforePreview,
      pre_swir: beforePreview,
      cur_rgb:  afterPreview,
      cur_swir: afterPreview,
    } as Record<FloodField, string> : undefined;
    onPublish({
      region,
      location_label: locationLabel.trim(),
      severity,
      message: message.trim() || undefined,
      lat: lat ? parseFloat(lat) : undefined,
      lon: lon ? parseFloat(lon) : undefined,
      previews,
    });
  }

  return (
    <section className="upload-section">
      <div className="upload-head">
        <h3>Or upload your own pair</h3>
        <p>Drop a before / after image. Run the flood model to see what it
        outputs, or send a manual alert directly with the severity you set
        below — useful for cases the satellite hasn't caught yet.</p>
      </div>
      <div className="upload-grid">
        <UploadSlot label="Before" file={before} preview={beforePreview} onChange={setBefore} />
        <UploadSlot label="After"  file={after}  preview={afterPreview}  onChange={setAfter} />
      </div>
      <div className="upload-fields">
        <label>
          <span>Location</span>
          <input
            type="text"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            placeholder="e.g. Vereda Sincelejito, San Marcos"
          />
        </label>
        <label>
          <span>Region</span>
          <select value={region} onChange={(e) => setRegion(e.target.value as never)}>
            <option value="la-mojana">La Mojana</option>
            <option value="putumayo">Putumayo</option>
          </select>
        </label>
        <label>
          <span>Severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as never)}>
            <option value="minor">minor</option>
            <option value="moderate">moderate</option>
            <option value="severe">severe</option>
          </select>
        </label>
        <label>
          <span>Lat (optional)</span>
          <input type="text" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="8.25" />
        </label>
        <label>
          <span>Lon (optional)</span>
          <input type="text" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-74.71" />
        </label>
      </div>
      <label className="upload-message">
        <span>Message (optional)</span>
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Water rising past the bridge near the school. Need evacuation transport at the polideportivo."
        />
      </label>
      <div className="upload-actions">
        <button
          type="button"
          onClick={() => havePair && onRunModel(before!, after!)}
          disabled={sending || !havePair}
          className="ghost-btn upload-run-btn"
          title={havePair ? "Run lfm2-flood on the uploaded pair" : "Upload a before + after image first"}
        >
          {sending ? "running…" : "🛰  Run flood model"}
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={sending || !locationLabel.trim()}
          className="primary-btn upload-publish-btn"
        >
          {sending ? "publishing…" : "📡  Send manual alert"}
        </button>
      </div>
      <p className="upload-note">
        The flood model trained on 4 Sentinel-2 bands (RGB + SWIR, pre + current).
        Uploads with just 2 RGB tiles still run — the SWIR slots are duplicated
        from the RGB pair, so output quality is lower than the pre-loaded scenarios.
      </p>
    </section>
  );
}

function UploadSlot({ label, file, preview, onChange }: {
  label: string;
  file: File | null;
  preview: string | undefined;
  onChange: (f: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return;
    onChange(f);
  }

  return (
    <label
      className={`upload-slot${dragOver ? " upload-slot-dragover" : ""}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
      onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
      onDrop={handleDrop}
    >
      <div className="upload-slot-tile">
        {preview
          ? <img src={preview} alt={label} />
          : <span className="upload-slot-placeholder">
              {label}<br/>
              <span className="upload-slot-hint">drop image or click</span>
            </span>}
      </div>
      <span className="upload-slot-label">{label}{file ? ` · ${file.name.slice(0, 18)}` : ""}</span>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function SamplePicker({ samples, activeSample, onPick }: {
  samples: FloodSample[]; activeSample: string | undefined;
  onPick: (s: FloodSample) => void;
}) {
  return (
    <div className="sample-picker">
      <span className="sample-picker-label">Try a sample:</span>
      {samples.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s)}
          className={`sample-picker-btn${activeSample === s.id ? " sample-picker-btn-active" : ""}`}
          title={s.description}
        >
          {s.event_label}
        </button>
      ))}
    </div>
  );
}

function FloodSlot({
  slot, preview, onAttach,
}: {
  slot: { field: FloodField; label: string };
  preview: string | undefined;
  onAttach: (field: FloodField, file: File | null) => void;
}) {
  return (
    <label className="flood-slot">
      <div className="flood-slot-tile">
        {preview
          ? <img src={preview} alt={slot.field} />
          : <span className="flood-slot-placeholder">{slot.label}<br/>+</span>}
      </div>
      <span className="flood-slot-label">{slot.label}</span>
      <input
        type="file"
        accept="image/png"
        onChange={(e) => onAttach(slot.field, e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

// ── Bubbles ───────────────────────────────────────────────────────────

function TurnBubble({ turn }: { turn: Turn }) {
  if (turn.kind === "text") return <UserTextBubble t={turn} />;
  if (turn.kind === "flood-submit") return <UserFloodBubble t={turn} />;
  return <AssistantBubble t={turn} />;
}

function UserTextBubble({ t }: { t: UserText }) {
  const filterLine = [t.role, t.region, t.phase].filter(Boolean).join(" · ");
  return (
    <div className="user-bubble">
      <div className="user-bubble-text">{t.text}</div>
      {filterLine && <p className="user-bubble-meta">filtering by {filterLine}</p>}
    </div>
  );
}

function UserFloodBubble({ t }: { t: UserFlood }) {
  return (
    <div className="user-bubble user-bubble-flood">
      {t.sampleId && <p className="user-bubble-meta">sample: {t.sampleId}</p>}
      <div className="user-flood-grid">
        {FLOOD_SLOTS.map((s) => (
          <div key={s.field} className="user-flood-tile">
            <img src={t.previews[s.field]} alt={s.field} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AssistantBubble({ t }: { t: AssistantTurn }) {
  const p = t.payload;
  if (p.kind === "error") {
    return <div className="assistant-bubble assistant-error">{p.error}</div>;
  }
  if (p.kind === "qa") return <QaResult matches={p.matches} />;
  if (p.kind === "flood") {
    return p.ok
      ? <FloodResult labels={p.labels} latencyMs={p.latency_ms} />
      : <div className="assistant-bubble assistant-error">flood detection failed: {p.error}</div>;
  }
  if (p.kind === "alert-published") return <AlertPublishedBubble alert={p.alert} />;
  if (p.kind === "alert-rejected") return <AlertRejectedBubble reason={p.reason} />;
  return null;
}

function QaResult({ matches }: { matches: QaMatch[] }) {
  if (matches.length === 0) {
    return <div className="assistant-bubble">No matches above the similarity threshold. Try rephrasing or relaxing your role/region filter.</div>;
  }
  const [top, ...rest] = matches;
  return (
    <div className="assistant-bubble qa-bubble">
      <div className="qa-pills">
        <Pill>{top.role}</Pill>
        <Pill>{top.phase}</Pill>
        <Pill>{top.region}</Pill>
        <span className="qa-sep">·</span>
        <span className="qa-sim">sim {top.similarity.toFixed(2)}</span>
      </div>
      <p className="qa-question">{top.question_en}</p>
      <p className="qa-answer">{top.answer_en}</p>
      {top.references && (
        <p className="qa-sources">
          <span>sources:</span> {top.references.split("|").join(" · ")}
        </p>
      )}
      {rest.length > 0 && (
        <details className="qa-more">
          <summary>{rest.length} more match{rest.length === 1 ? "" : "es"}</summary>
          <div className="qa-more-list">
            {rest.map((m) => (
              <div key={m.id} className="qa-secondary">
                <div className="qa-pills">
                  <Pill>{m.role}</Pill><Pill>{m.phase}</Pill><Pill>{m.region}</Pill>
                  <span className="qa-sim">sim {m.similarity.toFixed(2)}</span>
                </div>
                <p className="qa-question">{m.question_en}</p>
                <p className="qa-answer">{m.answer_en}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function FloodResult({ labels, latencyMs }: { labels: FloodLabels; latencyMs: number }) {
  const sevClass = `severity-${labels.flood_severity}`;
  return (
    <div className="assistant-bubble flood-bubble">
      <div className="flood-bubble-head">
        <span>flood detection · lfm2-flood</span>
        <span className="flood-latency">{latencyMs} ms</span>
      </div>
      <div className="flood-headline">
        <span className={`flood-verdict${labels.flood_present ? " flood-yes" : ""}`}>
          {labels.flood_present ? "FLOOD" : "no flood"}
        </span>
        <span className={`flood-severity ${sevClass}`}>severity: {labels.flood_severity}</span>
        <span className="flood-coverage">water {labels.water_coverage_pct_estimate}</span>
      </div>
      {labels.image_quality_limited && (
        <div className="flood-warn">⚠ image quality limited — treat other fields as low-confidence</div>
      )}
      <div className="flood-fields">
        <Field label="populated area">{yn(labels.populated_area_affected)}</Field>
        <Field label="infrastructure">{yn(labels.infrastructure_at_risk)}</Field>
        <Field label="river overflow">{yn(labels.river_overflow_visible)}</Field>
        <Field label="quality limited">{yn(labels.image_quality_limited)}</Field>
      </div>
    </div>
  );
}

function AlertPublishedBubble({ alert }: { alert: AlertRecord }) {
  const ts = new Date(alert.timestamp);
  const tauriCurl = `curl 'https://humaid.app/api/alerts?region=${alert.region}&since=${encodeURIComponent(new Date(ts.getTime() - 1000).toISOString())}'`;
  return (
    <div className="assistant-bubble alert-bubble">
      <div className="alert-bubble-head">
        <span className="alert-id">📡 {alert.id}</span>
        <span className="alert-ts">{ts.toLocaleString()}</span>
      </div>
      <div className="alert-thumb-wrap">
        <img src={alert.thumbnail_url} alt={`${alert.location_label} after`} className="alert-thumb" />
      </div>
      <div className="alert-headline">
        <span className={`alert-severity alert-severity-${alert.severity}`}>{alert.severity.toUpperCase()}</span>
        <span className="alert-location">{alert.location_label}</span>
      </div>
      <p className="alert-coords">
        📍 {alert.coordinates.lat.toFixed(4)}°, {alert.coordinates.lon.toFixed(4)}° · region: {alert.region} · source: {alert.source.kind}
      </p>
      {alert.message && <p className="alert-message">"{alert.message}"</p>}
      {alert.recommended_qa_ids.length > 0 && (
        <div className="alert-qa">
          <p className="alert-qa-label">Recommended Q&amp;A (auto-opens on the desktop app):</p>
          <p className="alert-qa-ids">
            {alert.recommended_qa_ids.map((id) => <span key={id} className="pill">{id}</span>)}
          </p>
        </div>
      )}
      <details className="alert-curl">
        <summary>desktop app polling endpoint</summary>
        <pre>{tauriCurl}</pre>
      </details>
    </div>
  );
}

function AlertRejectedBubble({ reason }: { reason: string }) {
  return (
    <div className="assistant-bubble assistant-error">
      Alert not published: {reason}
    </div>
  );
}

function yn(b: boolean) { return b ? "yes" : "no"; }

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="pill">{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="field-value">{children}</div>
    </div>
  );
}

const root = document.getElementById("chat-root");
if (root) createRoot(root).render(<App />);
