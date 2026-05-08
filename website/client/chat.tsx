/** @jsxRuntime automatic */
/** @jsxImportSource react */
// humaid demo — two tabs:
//
//   Knowledge base   chat thread + filtered document repository, side-by-side
//                    role/region/phase filters apply to both QA search and
//                    which docs are highlighted as "in scope"
//
//   Flood detection  2-column workbench (no chat thread):
//     left  — model tester (drop before/after, run model, auto-publish if eligible)
//     right — curated test alerts (click any to publish instantly)
//     bottom — recent-activity log of alerts published this session

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
  | { kind: "flood"; ok: true; labels: FloodLabels; latency_ms: number }
  | { kind: "flood"; ok: false; error: string }
  | { kind: "error"; error: string };

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
interface AssistantTurn { kind: "assistant"; payload: ChatPayload; ts: number; }
type Turn = UserText | AssistantTurn;

type Tab = "kb" | "flood";

// ── App shell ─────────────────────────────────────────────────────────

function App() {
  const [tab, setTab] = useState<Tab>("kb");

  // KB-tab state (the chat thread)
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [role, setRole] = useState("");
  const [region, setRegion] = useState("");
  const [phase, setPhase] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [citedSlugs, setCitedSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

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
      if (payload.kind === "qa") setCitedSlugs(extractCitedSlugs(payload.matches));
      if (!resp.ok && "error" in payload) setError(payload.error);
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

      {tab === "kb" && (
        <ProfileBar
          role={role} setRole={setRole}
          region={region} setRegion={setRegion}
          phase={phase} setPhase={setPhase}
        />
      )}

      {tab === "kb" && (
        <KbTab
          turns={turns} sending={sending} error={error} scrollRef={scrollRef}
          input={input} setInput={setInput}
          region={region}
          onSubmit={sendKb}
          citedSlugs={citedSlugs}
        />
      )}
      {tab === "flood" && <FloodTab />}
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
      {item("flood", "Flood detection",  "satellite · llama-server + lfm2-flood · alerts")}
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

// ── KB tab (chat + docs panel) ────────────────────────────────────────

function KbTab(props: {
  turns: Turn[]; sending: boolean; error: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  input: string; setInput: (s: string) => void;
  region: string;
  onSubmit: (e: FormEvent) => void;
  citedSlugs: Set<string>;
}) {
  return (
    <div className="kb-split">
      <section className="kb-chat">
        <div ref={props.scrollRef} className="scroll">
          <div className="thread">
            {props.turns.length === 0 && <KbWelcome onPick={props.setInput} />}
            {props.turns.map((t, i) => <KbTurnBubble key={i} turn={t} />)}
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
          <button key={s} type="button" className="suggestion" onClick={() => onPick(s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}

function KbTurnBubble({ turn }: { turn: Turn }) {
  if (turn.kind === "text") {
    const filterLine = [turn.role, turn.region, turn.phase].filter(Boolean).join(" · ");
    return (
      <div className="user-bubble">
        <div className="user-bubble-text">{turn.text}</div>
        {filterLine && <p className="user-bubble-meta">filtering by {filterLine}</p>}
      </div>
    );
  }
  const p = turn.payload;
  if (p.kind === "error") {
    return <div className="assistant-bubble assistant-error">{p.error}</div>;
  }
  if (p.kind === "qa") return <QaResult matches={p.matches} />;
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

// ── Documents panel (right side of KB tab) ────────────────────────────

function DocsPanel({ region, citedSlugs }: { region: string; citedSlugs: Set<string> }) {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((d) => setSources(d.sources))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  const visible = useMemo(() => {
    if (!sources) return [] as Source[];
    if (!region || region === "generic") return sources;
    return sources.filter((s) => s.region === region || s.region === "national" || s.region === "global");
  }, [sources, region]);
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
          <article key={s.slug} className={`source-card${citedSlugs.has(s.slug) ? " source-card-cited" : ""}`}>
            <header>
              <span className={`region-pill region-${s.region}`}>{s.region}</span>
              <span className="source-meta">{s.year} · {s.publisher}</span>
              {citedSlugs.has(s.slug) && <span className="cited-pill">cited</span>}
            </header>
            <h3>{s.title}</h3>
            <p>{s.summary}</p>
            <p className="source-slug">{s.slug}.md</p>
          </article>
        ))}
      </div>
    </div>
  );
}

// ── Flood tab — 2-column workbench ────────────────────────────────────

function FloodTab() {
  const [recentAlerts, setRecentAlerts] = useState<AlertRecord[]>([]);
  function appendAlert(a: AlertRecord) {
    setRecentAlerts((p) => [a, ...p].slice(0, 10));
  }
  return (
    <div className="flood-board">
      <div className="flood-board-cols">
        <ModelTester onAlertPublished={appendAlert} />
        <CuratedAlerts onAlertPublished={appendAlert} />
      </div>
      <RecentAlertsLog alerts={recentAlerts} />
    </div>
  );
}

// ── Column 1: model tester ────────────────────────────────────────────

interface ModelStatus {
  phase: "idle" | "running" | "labels" | "publishing" | "published" | "no-alert" | "error";
  labels?: FloodLabels;
  latencyMs?: number;
  alert?: AlertRecord;
  reason?: string;
  error?: string;
}

function ModelTester({ onAlertPublished }: { onAlertPublished: (a: AlertRecord) => void }) {
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter]   = useState<File | null>(null);
  const [region, setRegion] = useState<"la-mojana" | "putumayo">("la-mojana");
  const [locationLabel, setLocationLabel] = useState("Custom location");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<ModelStatus>({ phase: "idle" });

  const beforePreview = useMemo(() => before ? URL.createObjectURL(before) : undefined, [before]);
  const afterPreview  = useMemo(() => after  ? URL.createObjectURL(after)  : undefined, [after]);

  async function run() {
    if (!before || !after || status.phase === "running" || status.phase === "publishing") return;
    setStatus({ phase: "running" });
    try {
      const form = new FormData();
      form.append("pre_rgb",  before, "pre_rgb.png");
      form.append("pre_swir", before, "pre_swir.png");
      form.append("cur_rgb",  after,  "cur_rgb.png");
      form.append("cur_swir", after,  "cur_swir.png");
      const resp = await fetch("/api/chat", { method: "POST", body: form });
      const payload = (await resp.json()) as ChatPayload;
      if (payload.kind !== "flood" || !payload.ok) {
        const err = payload.kind === "flood" ? payload.error
                  : payload.kind === "error" ? payload.error
                  : "unknown error";
        setStatus({ phase: "error", error: err });
        return;
      }
      const labels = payload.labels;
      const eligible = labels.flood_present && labels.populated_area_affected && !labels.image_quality_limited;
      if (!eligible) {
        const reason = !labels.flood_present              ? "model didn't detect a flood"
                     : !labels.populated_area_affected    ? "no populated area visible"
                     :                                       "image quality limited";
        setStatus({ phase: "no-alert", labels, latencyMs: payload.latency_ms, reason });
        return;
      }

      // Auto-publish.
      setStatus({ phase: "publishing", labels, latencyMs: payload.latency_ms });
      const pubResp = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          manual: true,
          region,
          location_label: locationLabel.trim() || "Custom location",
          severity: labels.flood_severity === "none" ? "minor" : labels.flood_severity,
          message: message.trim() || undefined,
          lat: lat ? parseFloat(lat) : undefined,
          lon: lon ? parseFloat(lon) : undefined,
          labels,
        }),
      });
      const data = await pubResp.json() as { ok: boolean; alert?: AlertRecord; error?: string };
      if (data.ok && data.alert) {
        setStatus({ phase: "published", labels, latencyMs: payload.latency_ms, alert: data.alert });
        onAlertPublished(data.alert);
      } else {
        setStatus({ phase: "error", labels, error: data.error ?? "publish failed" });
      }
    } catch (err) {
      setStatus({ phase: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  function clear() {
    setBefore(null); setAfter(null);
    setStatus({ phase: "idle" });
  }

  const busy = status.phase === "running" || status.phase === "publishing";
  const canRun = !!before && !!after && !busy;

  return (
    <section className="board-col board-col-tester">
      <header className="col-head">
        <h2>Test the flood model</h2>
        <p>Drop a before / after pair. The model runs onboard inference; if a populated-area flood is detected, the alert publishes automatically.</p>
      </header>

      <div className="upload-grid">
        <UploadSlot label="Before" file={before} preview={beforePreview} onChange={setBefore} />
        <UploadSlot label="After"  file={after}  preview={afterPreview}  onChange={setAfter} />
      </div>

      <div className="upload-fields">
        <label>
          <span>Location</span>
          <input type="text" value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)}
            placeholder="e.g. Vereda Sincelejito, San Marcos" />
        </label>
        <label>
          <span>Region</span>
          <select value={region} onChange={(e) => setRegion(e.target.value as never)}>
            <option value="la-mojana">La Mojana</option>
            <option value="putumayo">Putumayo</option>
          </select>
        </label>
        <label>
          <span>Lat</span>
          <input type="text" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="8.25" />
        </label>
        <label>
          <span>Lon</span>
          <input type="text" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-74.71" />
        </label>
      </div>
      <label className="upload-message">
        <span>Message (optional)</span>
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Water rising past the bridge near the school."
        />
      </label>

      <div className="upload-actions">
        <button type="button" onClick={run} disabled={!canRun} className="primary-btn">
          {status.phase === "running"    ? "🛰  running model…"
            : status.phase === "publishing" ? "📡  publishing alert…"
            : "🛰  Run model + publish if alert detected"}
        </button>
        {(status.phase !== "idle" && status.phase !== "running" && status.phase !== "publishing") && (
          <button type="button" onClick={clear} className="ghost-btn">clear</button>
        )}
      </div>

      <ModelResult status={status} />
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

function ModelResult({ status }: { status: ModelStatus }) {
  if (status.phase === "idle") {
    return (
      <div className="result result-idle">
        Drop a before / after pair above to run the model.
      </div>
    );
  }
  if (status.phase === "running") {
    return <div className="result result-busy">🛰 running lfm2-flood — first call on a fresh isolate takes ~60 s.</div>;
  }
  if (status.phase === "publishing") {
    return <div className="result result-busy">📡 threshold met — publishing alert…</div>;
  }
  if (status.phase === "error") {
    return <div className="result result-error">Error: {status.error}</div>;
  }
  if (status.phase === "no-alert" && status.labels) {
    return (
      <div className="result result-noalert">
        <p className="result-head">
          <span className="result-tag">no alert</span>
          <span>· {status.reason}</span>
          {status.latencyMs && <span className="result-latency">{status.latencyMs} ms</span>}
        </p>
        <FloodLabelGrid labels={status.labels} />
      </div>
    );
  }
  if (status.phase === "published" && status.alert && status.labels) {
    const a = status.alert;
    return (
      <div className="result result-published">
        <p className="result-head">
          <span className="result-tag tag-pub">📡 alert published</span>
          <span className="result-id">{a.id}</span>
          {status.latencyMs && <span className="result-latency">{status.latencyMs} ms</span>}
        </p>
        <FloodLabelGrid labels={status.labels} />
        <p className="result-meta">
          {a.severity.toUpperCase()} · {a.location_label} · {a.coordinates.lat.toFixed(3)}, {a.coordinates.lon.toFixed(3)}
        </p>
      </div>
    );
  }
  return null;
}

function FloodLabelGrid({ labels }: { labels: FloodLabels }) {
  return (
    <div className="label-grid">
      <Field label="flood">{labels.flood_present ? "yes" : "no"}</Field>
      <Field label="severity">{labels.flood_severity}</Field>
      <Field label="water">{labels.water_coverage_pct_estimate}</Field>
      <Field label="populated">{yn(labels.populated_area_affected)}</Field>
      <Field label="infra at risk">{yn(labels.infrastructure_at_risk)}</Field>
      <Field label="river overflow">{yn(labels.river_overflow_visible)}</Field>
      <Field label="quality limited">{yn(labels.image_quality_limited)}</Field>
    </div>
  );
}

// ── Column 2: curated test alerts ─────────────────────────────────────

function CuratedAlerts({ onAlertPublished }: { onAlertPublished: (a: AlertRecord) => void }) {
  const [samples, setSamples] = useState<FloodSample[] | null>(null);
  useEffect(() => {
    fetch("/api/samples").then((r) => r.json()).then((d) => setSamples(d.samples)).catch(() => {});
  }, []);
  return (
    <section className="board-col board-col-curated">
      <header className="col-head">
        <h2>Curated test alerts</h2>
        <p>Each card publishes an alert immediately using the dataset's verified ground-truth labels — no model in the loop, always succeeds.</p>
      </header>
      <div className="curated-list">
        {samples?.map((s) => (
          <CuratedCard key={s.id} sample={s} onAlertPublished={onAlertPublished} />
        ))}
        {!samples && <div className="thinking">loading curated alerts…</div>}
      </div>
    </section>
  );
}

function CuratedCard({ sample, onAlertPublished }: {
  sample: FloodSample;
  onAlertPublished: (a: AlertRecord) => void;
}) {
  const [state, setState] = useState<{ phase: "idle" | "publishing" | "done" | "error"; alert?: AlertRecord; error?: string }>({ phase: "idle" });

  async function publish() {
    if (state.phase === "publishing") return;
    setState({ phase: "publishing" });
    try {
      const resp = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample_id: sample.id, manual: true }),
      });
      const data = await resp.json() as { ok: boolean; alert?: AlertRecord; error?: string };
      if (data.ok && data.alert) {
        setState({ phase: "done", alert: data.alert });
        onAlertPublished(data.alert);
      } else {
        setState({ phase: "error", error: data.error ?? "publish failed" });
      }
    } catch (err) {
      setState({ phase: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <article className="curated-card">
      <img className="curated-thumb" src={sample.thumbnail} alt={sample.event_label} />
      <div className="curated-text">
        <header>
          <span className={`region-pill region-${sample.region}`}>{sample.region}</span>
          <span className="curated-severity sev-{sample.ground_truth_labels.flood_severity}">
            {sample.ground_truth_labels.flood_severity}
          </span>
        </header>
        <h4>{sample.event_label}</h4>
        <p className="curated-loc">{sample.location_label} · {sample.lat.toFixed(3)}, {sample.lon.toFixed(3)}</p>
        <p className="curated-desc">{sample.description}</p>
        {state.phase === "done" && state.alert && (
          <p className="curated-status curated-status-done">✓ {state.alert.id} published</p>
        )}
        {state.phase === "error" && (
          <p className="curated-status curated-status-error">✗ {state.error}</p>
        )}
        <button
          type="button"
          onClick={publish}
          disabled={state.phase === "publishing"}
          className="primary-btn curated-publish-btn"
        >
          {state.phase === "publishing" ? "publishing…" : state.phase === "done" ? "📡 Publish another" : "📡 Send alert"}
        </button>
      </div>
    </article>
  );
}

// ── Recent alerts log (bottom strip on flood tab) ─────────────────────

function RecentAlertsLog({ alerts }: { alerts: AlertRecord[] }) {
  if (alerts.length === 0) return null;
  return (
    <section className="recent-log">
      <h3>Recently published <span className="muted">· this session</span></h3>
      <div className="recent-list">
        {alerts.map((a) => (
          <article key={a.id} className="recent-card">
            <img src={a.thumbnail_url} alt={a.location_label} />
            <div className="recent-meta">
              <span className={`recent-sev recent-sev-${a.severity}`}>{a.severity.toUpperCase()}</span>
              <span className="recent-id">{a.id}</span>
              <span className="recent-loc">{a.location_label}</span>
              <span className="recent-coords">{a.coordinates.lat.toFixed(3)}, {a.coordinates.lon.toFixed(3)}</span>
              <span className="recent-source">source: {a.source.kind}</span>
              {a.message && <span className="recent-msg">"{a.message.slice(0, 60)}"</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ── Small atoms ───────────────────────────────────────────────────────

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
