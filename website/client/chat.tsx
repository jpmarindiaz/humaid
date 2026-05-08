/** @jsxRuntime automatic */
/** @jsxImportSource react */
// humaid demo chat — single React app showcasing both systems:
//
//   text → /api/chat (JSON)         knowledge-base retrieval
//   4 PNGs → /api/chat (multipart)  satellite flood detection (lfm2-flood)
//
// The flood-detection contract is non-negotiable: 4 images in the order
// pre_rgb, pre_swir, cur_rgb, cur_swir. See finetune-flood/docs/06-deploy-website.md.

import { createRoot } from "react-dom/client";
import { type FormEvent, useEffect, useRef, useState } from "react";

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

interface UserText { kind: "text"; text: string; ts: number; }
interface UserFlood { kind: "flood-submit"; previews: Record<FloodField, string>; ts: number; }
type UserTurn = UserText | UserFlood;
interface AssistantTurn { kind: "assistant"; payload: ChatPayload; ts: number; }
type Turn = UserTurn | AssistantTurn;

type Mode = "kb" | "flood";

function App() {
  const [mode, setMode] = useState<Mode>("kb");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [floodFiles, setFloodFiles] = useState<Partial<Record<FloodField, File>>>({});
  const [floodPreviews, setFloodPreviews] = useState<Partial<Record<FloodField, string>>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function attachFlood(field: FloodField, file: File | null) {
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

    const userTurn: UserText = { kind: "text", text, ts: Date.now() };
    setTurns((p) => [...p, userTurn]);
    setInput("");

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
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
    const userTurn: UserFlood = { kind: "flood-submit", previews, ts: Date.now() };
    setTurns((p) => [...p, userTurn]);

    const form = new FormData();
    for (const slot of FLOOD_SLOTS) form.append(slot.field, floodFiles[slot.field]!);

    try {
      const resp = await fetch("/api/chat", { method: "POST", body: form });
      const payload = (await resp.json()) as ChatPayload;
      setTurns((p) => [...p, { kind: "assistant", payload, ts: Date.now() }]);
      // Reset slots after successful submit so the user can run another pair.
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
    <div className="flex h-screen flex-col">
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 text-zinc-100 hover:text-zinc-300">
            <span className="block w-2.5 h-2.5 rounded-full bg-orange-700 ring-2 ring-orange-700/30" />
            <span className="text-sm font-semibold">humaid</span>
          </a>
          <span className="text-zinc-600">/</span>
          <span className="text-xs text-zinc-500">demo</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1">← landing</a>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded border border-zinc-800 hover:border-zinc-600 transition"
          >
            new
          </button>
        </div>
      </header>

      <ModeTabs mode={mode} onChange={setMode} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {turns.length === 0 && (mode === "kb" ? <KbWelcome onPick={(s) => setInput(s)} /> : <FloodWelcome />)}
          {turns.map((t, i) => <TurnBubble key={i} turn={t} />)}
          {sending && (
            <div className="text-zinc-500 text-sm pl-1">
              <span className="inline-block animate-pulse">working…</span>
            </div>
          )}
          {error && (
            <div className="rounded border border-red-900 bg-red-950/40 text-red-300 px-3 py-2 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {mode === "kb"
        ? <KbInput value={input} onChange={setInput} onSubmit={sendKb} sending={sending} />
        : <FloodInput
            slots={FLOOD_SLOTS}
            previews={floodPreviews}
            onAttach={attachFlood}
            onSubmit={sendFlood}
            sending={sending}
          />}
    </div>
  );
}

// ── Mode tabs ─────────────────────────────────────────────────────────

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tab = (m: Mode, label: string, hint: string) => (
    <button
      type="button"
      onClick={() => onChange(m)}
      className={`flex-1 px-4 py-2.5 text-left transition border-b-2 ${
        mode === m
          ? "border-orange-700 text-zinc-100"
          : "border-transparent text-zinc-500 hover:text-zinc-300"
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] text-zinc-500">{hint}</div>
    </button>
  );
  return (
    <div className="flex border-b border-zinc-800 bg-zinc-950/60">
      {tab("kb",    "Knowledge base",   "laptop · ollama + nomic + duckdb")}
      {tab("flood", "Flood detection",  "satellite · llama-server + lfm2-flood")}
    </div>
  );
}

// ── KB welcome / input / suggestions ──────────────────────────────────

function KbWelcome({ onPick }: { onPick: (s: string) => void }) {
  const suggestions = [
    "How do I evacuate when the river rises overnight?",
    "¿Qué debe llevar la mochila de emergencia?",
    "What triage protocol do I use at the impact site?",
    "¿Cuándo declarar Calamidad Pública?",
  ];
  return (
    <div className="text-center text-zinc-500 text-sm py-12 space-y-3">
      <p className="text-zinc-300 text-base">Ask the knowledge base</p>
      <p className="text-xs text-zinc-600">
        471 bilingual Q&amp;A pairs · Nomic embeddings · DuckDB cosine search
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto pt-4">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-400 text-sm hover:border-zinc-700 hover:text-zinc-200 transition text-left"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function KbInput({
  value, onChange, onSubmit, sending,
}: {
  value: string; onChange: (s: string) => void;
  onSubmit: (e: FormEvent) => void; sending: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="border-t border-zinc-800 px-4 py-3 bg-zinc-950">
      <div className="mx-auto max-w-2xl flex gap-2 items-end">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSubmit(e as unknown as FormEvent);
            }
          }}
          disabled={sending}
          rows={1}
          placeholder="Ask about flood response, evacuation, triage, WASH…"
          className="flex-1 resize-none rounded-md bg-zinc-900 border border-zinc-800 focus:border-zinc-600 focus:outline-none px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 max-h-40"
        />
        <button
          type="submit"
          disabled={sending || !value.trim()}
          className="px-4 py-2 rounded-md bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {sending ? "…" : "send"}
        </button>
      </div>
    </form>
  );
}

// ── Flood welcome / 4-image input ─────────────────────────────────────

function FloodWelcome() {
  return (
    <div className="text-center text-zinc-500 text-sm py-12 space-y-3 max-w-xl mx-auto">
      <p className="text-zinc-300 text-base">Satellite flood detection</p>
      <p className="text-xs text-zinc-600">
        Upload 4 Sentinel-2 tiles for the same 5 km square — a baseline (pre-event)
        RGB + SWIR pair and a current (suspected event) RGB + SWIR pair. The
        fine-tuned LFM2-VL-450M returns a 7-field JSON assessment.
      </p>
      <p className="text-[11px] text-zinc-600 pt-3">
        Cold start on a fresh isolate takes ~60 s (binary + GGUF + mmproj load).
      </p>
    </div>
  );
}

function FloodInput({
  slots, previews, onAttach, onSubmit, sending,
}: {
  slots: typeof FLOOD_SLOTS;
  previews: Partial<Record<FloodField, string>>;
  onAttach: (field: FloodField, file: File | null) => void;
  onSubmit: (e: FormEvent) => void;
  sending: boolean;
}) {
  const ready = slots.every((s) => previews[s.field]);
  return (
    <form onSubmit={onSubmit} className="border-t border-zinc-800 px-4 py-3 bg-zinc-950">
      <div className="mx-auto max-w-2xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {slots.map((s) => <FloodSlot key={s.field} slot={s} preview={previews[s.field]} onAttach={onAttach} />)}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!ready || sending}
            className="px-4 py-2 rounded-md bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {sending ? "analysing…" : "analyse pair"}
          </button>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2 text-center">
          PNGs only · order matters · same 5 km tile across all four
        </p>
      </div>
    </form>
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
    <label className="block cursor-pointer group">
      <div className="aspect-square rounded border border-dashed border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 transition overflow-hidden flex items-center justify-center text-zinc-600 text-xs">
        {preview
          ? <img src={preview} alt={slot.field} className="w-full h-full object-cover" />
          : <span className="px-2 text-center">{slot.label}<br/>+</span>}
      </div>
      <span className="block text-[10px] text-zinc-500 mt-1 text-center">{slot.label}</span>
      <input
        type="file"
        accept="image/png"
        className="hidden"
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
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl bg-zinc-100 text-zinc-900 px-4 py-2 text-sm whitespace-pre-wrap">
        {t.text}
      </div>
    </div>
  );
}

function UserFloodBubble({ t }: { t: UserFlood }) {
  return (
    <div className="flex justify-end">
      <div className="grid grid-cols-4 gap-1.5 max-w-[60%]">
        {FLOOD_SLOTS.map((s) => (
          <div key={s.field} className="aspect-square rounded overflow-hidden border border-zinc-800">
            <img src={t.previews[s.field]} alt={s.field} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AssistantBubble({ t }: { t: AssistantTurn }) {
  const p = t.payload;
  if (p.kind === "error") {
    return (
      <div className="max-w-[85%] rounded-2xl bg-red-950/40 border border-red-900 text-red-300 px-4 py-2 text-sm">
        {p.error}
      </div>
    );
  }
  if (p.kind === "qa") return <QaResult matches={p.matches} />;
  if (p.kind === "flood") {
    return p.ok
      ? <FloodResult labels={p.labels} latencyMs={p.latency_ms} />
      : (
        <div className="max-w-[85%] rounded-2xl bg-red-950/40 border border-red-900 text-red-300 px-4 py-2 text-sm">
          flood detection failed: {p.error}
        </div>
      );
  }
  return null;
}

function QaResult({ matches }: { matches: QaMatch[] }) {
  if (matches.length === 0) {
    return (
      <div className="max-w-[85%] rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 px-4 py-3 text-sm">
        No matches found above the similarity threshold. Try rephrasing.
      </div>
    );
  }
  const [top, ...rest] = matches;
  return (
    <div className="max-w-[92%] space-y-3">
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 px-4 py-3 text-sm">
        <div className="flex flex-wrap gap-2 mb-2 text-[10px] text-zinc-500 uppercase tracking-wider">
          <Pill>{top.role}</Pill>
          <Pill>{top.phase}</Pill>
          <Pill>{top.region}</Pill>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">sim {top.similarity.toFixed(2)}</span>
        </div>
        <p className="font-semibold text-zinc-100 mb-2">{top.question_en}</p>
        <p className="text-zinc-300 whitespace-pre-wrap mb-3">{top.answer_en}</p>
        {top.references && (
          <p className="text-[10px] text-zinc-500 border-t border-zinc-800 pt-2">
            <span className="uppercase tracking-wider mr-1">sources:</span>
            <span className="font-mono">{top.references.split("|").join(" · ")}</span>
          </p>
        )}
      </div>
      {rest.length > 0 && (
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer hover:text-zinc-300 select-none">
            {rest.length} more match{rest.length === 1 ? "" : "es"}
          </summary>
          <div className="mt-2 space-y-2">
            {rest.map((m) => (
              <div key={m.id} className="rounded border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="flex flex-wrap gap-2 mb-1 text-[10px] text-zinc-500">
                  <Pill>{m.role}</Pill><Pill>{m.phase}</Pill><Pill>{m.region}</Pill>
                  <span>sim {m.similarity.toFixed(2)}</span>
                </div>
                <p className="font-medium text-zinc-300">{m.question_en}</p>
                <p className="text-zinc-400 mt-1">{m.answer_en}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function FloodResult({ labels, latencyMs }: { labels: FloodLabels; latencyMs: number }) {
  const sevColor = ({
    none: "text-zinc-400",
    minor: "text-yellow-300",
    moderate: "text-orange-300",
    severe: "text-red-300",
  } as const)[labels.flood_severity];

  return (
    <div className="max-w-[92%] rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 px-4 py-3 text-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">flood detection · lfm2-flood</p>
        <span className="text-[10px] text-zinc-600 font-mono">{latencyMs} ms</span>
      </div>

      <div className="flex items-baseline gap-3 flex-wrap">
        <span className={`text-2xl font-semibold ${labels.flood_present ? "text-orange-300" : "text-zinc-400"}`}>
          {labels.flood_present ? "FLOOD" : "no flood"}
        </span>
        <span className={`text-sm ${sevColor}`}>severity: {labels.flood_severity}</span>
        <span className="text-xs text-zinc-500">water {labels.water_coverage_pct_estimate}</span>
      </div>

      {labels.image_quality_limited && (
        <div className="rounded bg-yellow-950/30 border border-yellow-900/50 text-yellow-200 px-2 py-1 text-xs">
          ⚠ image quality limited — treat other fields as low-confidence
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 pt-1 border-t border-zinc-800">
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
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 normal-case tracking-normal">
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-zinc-600 uppercase tracking-wider text-[9px]">{label}</span>
      <div className="text-zinc-300">{children}</div>
    </div>
  );
}

const root = document.getElementById("chat-root");
if (root) createRoot(root).render(<App />);
