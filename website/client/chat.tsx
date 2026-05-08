/** @jsxRuntime automatic */
/** @jsxImportSource react */
// humaid demo — three tabs in editorial-light theme:
//
//   Knowledge base  text query (role/region/phase filters)  → /api/chat JSON
//   Flood detection 4 satellite tiles (pre+current RGB/SWIR) → /api/chat multipart
//   Sources         the 17 PDFs that ground the KB           → /api/sources

import { createRoot } from "react-dom/client";
import { type FormEvent, useEffect, useRef, useState } from "react";

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

type ChatPayload =
  | { kind: "qa"; query: string; matches: QaMatch[] }
  | { kind: "flood"; ok: true; labels: FloodLabels; latency_ms: number }
  | { kind: "flood"; ok: false; error: string }
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
interface UserFlood { kind: "flood-submit"; previews: Record<FloodField, string>; ts: number; }
type UserTurn = UserText | UserFlood;
interface AssistantTurn { kind: "assistant"; payload: ChatPayload; ts: number; }
type Turn = UserTurn | AssistantTurn;

type Tab = "kb" | "flood" | "sources";

// ── App shell ─────────────────────────────────────────────────────────

function App() {
  const [tab, setTab] = useState<Tab>("kb");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [role, setRole] = useState("");
  const [region, setRegion] = useState("");
  const [phase, setPhase] = useState("");
  const [floodFiles, setFloodFiles] = useState<Partial<Record<FloodField, File>>>({});
  const [floodPreviews, setFloodPreviews] = useState<Partial<Record<FloodField, string>>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function attachFlood(field: FloodField, file: File | null) {
    if (!file) {
      setFloodFiles((f) => { const c = { ...f }; delete c[field]; return c; });
      setFloodPreviews((p) => { const c = { ...p }; delete c[field]; return c; });
      return;
    }
    const url = URL.createObjectURL(file);
    setFloodFiles((f) => ({ ...f, [field]: file }));
    setFloodPreviews((p) => ({ ...p, [field]: url }));
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

    const previews = floodPreviews as Record<FloodField, string>;
    setTurns((p) => [...p, { kind: "flood-submit", previews, ts: Date.now() }]);

    const form = new FormData();
    for (const slot of FLOOD_SLOTS) form.append(slot.field, floodFiles[slot.field]!);

    try {
      const resp = await fetch("/api/chat", { method: "POST", body: form });
      const payload = (await resp.json()) as ChatPayload;
      setTurns((p) => [...p, { kind: "assistant", payload, ts: Date.now() }]);
      setFloodFiles({});
      setFloodPreviews({});
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

      <div className="app-main">
        {tab === "kb" && (
          <KbTab
            turns={turns} sending={sending} error={error} scrollRef={scrollRef}
            input={input} setInput={setInput}
            role={role} setRole={setRole}
            region={region} setRegion={setRegion}
            phase={phase} setPhase={setPhase}
            onSubmit={sendKb}
          />
        )}
        {tab === "flood" && (
          <FloodTab
            turns={turns} sending={sending} error={error} scrollRef={scrollRef}
            previews={floodPreviews}
            onAttach={attachFlood}
            onSubmit={sendFlood}
          />
        )}
        {tab === "sources" && <SourcesTab />}
      </div>
    </div>
  );
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
      {item("kb",      "Knowledge base",   "laptop · ollama + nomic + duckdb")}
      {item("flood",   "Flood detection",  "satellite · llama-server + lfm2-flood")}
      {item("sources", "Source documents", `${17} PDFs · OCHA / UNGRD / ACAPS / …`)}
    </div>
  );
}

// ── KB tab ────────────────────────────────────────────────────────────

function KbTab(props: {
  turns: Turn[]; sending: boolean; error: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  input: string; setInput: (s: string) => void;
  role: string; setRole: (s: string) => void;
  region: string; setRegion: (s: string) => void;
  phase: string; setPhase: (s: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <>
      <ProfileBar
        role={props.role} setRole={props.setRole}
        region={props.region} setRegion={props.setRegion}
        phase={props.phase} setPhase={props.setPhase}
      />
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
            placeholder="Ask about flood response — evacuation, triage, WASH, calamidad pública…"
          />
          <button type="submit" disabled={props.sending || !props.input.trim()} className="primary-btn">
            {props.sending ? "…" : "send"}
          </button>
        </div>
      </form>
    </>
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
        471 bilingual Q&amp;A pairs · Nomic embeddings · DuckDB cosine search.
        Pick your role, region and phase above so the answers fit the context
        you're acting in.
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

// ── Flood tab ─────────────────────────────────────────────────────────

function FloodTab(props: {
  turns: Turn[]; sending: boolean; error: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  previews: Partial<Record<FloodField, string>>;
  onAttach: (field: FloodField, file: File | null) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const ready = FLOOD_SLOTS.every((s) => props.previews[s.field]);
  return (
    <>
      <div ref={props.scrollRef} className="scroll">
        <div className="thread">
          {props.turns.length === 0 && <FloodWelcome />}
          {props.turns.map((t, i) => <TurnBubble key={i} turn={t} />)}
          {props.sending && <div className="thinking">running lfm2-flood…</div>}
          {props.error && <div className="error-bubble">{props.error}</div>}
        </div>
      </div>
      <form onSubmit={props.onSubmit} className="composer">
        <div className="composer-inner composer-flood">
          <div className="flood-grid">
            {FLOOD_SLOTS.map((s) => (
              <FloodSlot key={s.field} slot={s} preview={props.previews[s.field]} onAttach={props.onAttach} />
            ))}
          </div>
          <div className="flood-actions">
            <p className="flood-hint">PNG only · same 5 km Sentinel-2 tile · order matters</p>
            <button type="submit" disabled={!ready || props.sending} className="primary-btn">
              {props.sending ? "analysing…" : "analyse pair"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function FloodWelcome() {
  return (
    <div className="welcome">
      <p className="welcome-title">Satellite flood detection</p>
      <p className="welcome-sub">
        Upload 4 Sentinel-2 tiles for the same 5 km square: a baseline (pre-event)
        RGB + SWIR pair and a current (suspected event) RGB + SWIR pair. The
        fine-tuned LFM2-VL-450M returns a 7-field structured assessment.
      </p>
      <p className="welcome-note">
        Cold start on a fresh isolate takes ~60 s while the GGUF + mmproj load.
      </p>
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

// ── Sources tab ───────────────────────────────────────────────────────

function SourcesTab() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((d) => setSources(d.sources))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <div className="scroll"><div className="thread"><div className="error-bubble">{error}</div></div></div>;
  if (!sources) return <div className="scroll"><div className="thread"><div className="thinking">loading sources…</div></div></div>;

  return (
    <div className="scroll">
      <div className="sources">
        <div className="sources-head">
          <p className="welcome-title">{sources.length} source documents</p>
          <p className="welcome-sub">
            The on-the-ground knowledge base is grounded in these PDFs. Every
            answer in the KB tab cites one or more of them. Together they cover
            La Mojana 2021–2025, Mocoa 2017, Putumayo 2025, and the
            cross-cutting policy + ENSO frameworks.
          </p>
        </div>
        <div className="sources-grid">
          {sources.map((s) => <SourceCard key={s.slug} source={s} />)}
        </div>
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: Source }) {
  return (
    <article className="source-card">
      <header>
        <span className={`region-pill region-${source.region}`}>{source.region}</span>
        <span className="source-meta">{source.year} · {source.publisher}</span>
      </header>
      <h3>{source.title}</h3>
      <p>{source.summary}</p>
      <p className="source-slug">{source.slug}.md</p>
    </article>
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
