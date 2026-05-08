import { useEffect, useRef, useState, type FormEvent } from "react";

import { qaSearch } from "../api";
import type {
  Language,
  PhaseFilter,
  Profile,
  QaMatch,
  QaRow,
  Region,
} from "../types";
import QaCard from "./QaCard";
import DocViewer from "./DocViewer";

interface UserTurn { kind: "user"; text: string; ts: number; }
interface AssistantTurn { kind: "assistant"; matches: QaMatch[]; ts: number; }
interface ErrorTurn { kind: "error"; text: string; ts: number; }
type Turn = UserTurn | AssistantTurn | ErrorTurn;

export default function Chat({
  profile,
  language,
  phase,
  regionFilter,
  openDocPath,
  onOpenDoc,
  onCloseDoc,
  onOpenDocInTab,
}: {
  profile: Profile;
  language: Language;
  phase: PhaseFilter;
  regionFilter: Region | "all";
  openDocPath: string | null;
  onOpenDoc: (path: string) => void;
  onCloseDoc: () => void;
  onOpenDocInTab?: (path: string) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    setTurns((p) => [...p, { kind: "user", text, ts: Date.now() }]);
    try {
      const matches = await qaSearch({
        query: text,
        role: profile.role,
        phase: phase === "all" ? undefined : phase,
        region: regionFilter === "all" ? undefined : regionFilter,
        limit: 5,
        minSimilarity: 0.4,
      });
      setTurns((p) => [...p, { kind: "assistant", matches, ts: Date.now() }]);
    } catch (e) {
      setTurns((p) => [
        ...p,
        { kind: "error", text: e instanceof Error ? e.message : String(e), ts: Date.now() },
      ]);
    } finally {
      setSending(false);
    }
  }

  const suggestions = language === "es"
    ? [
        "¿Cómo evacúo cuando el río sube de noche?",
        "¿Qué debe llevar la mochila de emergencia?",
        "¿Cómo coordino el albergue temporal?",
        "¿Cuándo declarar Calamidad Pública?",
      ]
    : [
        "How do I evacuate when the river rises overnight?",
        "What should an emergency go-bag contain?",
        "How do I run a temporary shelter?",
        "When do I declare a public calamity?",
      ];

  return (
    <div
      className={`grid h-full ${openDocPath ? "grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : "grid-cols-1"}`}
    >
      <ChatPane
        turns={turns}
        sending={sending}
        input={input}
        setInput={setInput}
        send={send}
        scrollRef={scrollRef}
        suggestions={suggestions}
        language={language}
        onOpenDoc={onOpenDoc}
      />

      {openDocPath && (
        <aside className="border-l border-line bg-cream overflow-hidden">
          <DocViewer
            path={openDocPath}
            language={language}
            onClose={onCloseDoc}
            onPickQa={onOpenDocInTab ? undefined : undefined}
          />
        </aside>
      )}
    </div>
  );
}

function ChatPane({
  turns,
  sending,
  input,
  setInput,
  send,
  scrollRef,
  suggestions,
  language,
  onOpenDoc,
}: {
  turns: Turn[];
  sending: boolean;
  input: string;
  setInput: (s: string) => void;
  send: (e: FormEvent) => Promise<void>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  suggestions: string[];
  language: Language;
  onOpenDoc: (path: string) => void;
}) {
  return (
    <div className="grid grid-rows-[1fr_auto] h-full overflow-hidden">
      <div ref={scrollRef} className="overflow-y-auto scrollbar-thin px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {turns.length === 0 && (
            <div className="text-center text-muted text-sm py-12 space-y-3">
              <p className="text-ink text-xl font-serif tracking-tight">
                {language === "es" ? "Pregunta a la base de conocimiento" : "Ask the knowledge base"}
              </p>
              <p className="text-xs text-muted/70">
                {language === "es"
                  ? "Búsqueda semántica local · 471 Q&A · Nomic + DuckDB"
                  : "Local semantic search · 471 Q&A pairs · Nomic + DuckDB"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto pt-4">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="rounded-md border border-line bg-soft/60 px-3 py-2 text-muted text-sm hover:border-line hover:text-ink transition text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <TurnBubble key={i} turn={t} language={language} onOpenDoc={onOpenDoc} />
          ))}

          {sending && (
            <div className="text-muted text-sm pl-1">
              <span className="inline-block animate-pulse">working…</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={send} className="border-t border-line px-4 py-3 bg-cream">
        <div className="mx-auto max-w-2xl flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            rows={1}
            placeholder={
              language === "es"
                ? "Pregunta sobre evacuación, WASH, triage, coordinación…"
                : "Ask about evacuation, WASH, triage, coordination…"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as FormEvent);
              }
            }}
            className="flex-1 resize-none rounded-md bg-paper border border-line focus:border-terracotta focus:outline-none px-3 py-2 text-sm text-ink placeholder:text-muted/60 max-h-40"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 py-2 rounded-md bg-ink text-paper text-sm font-medium hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {sending ? "…" : language === "es" ? "Enviar" : "send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TurnBubble({
  turn,
  language,
  onOpenDoc,
}: {
  turn: Turn;
  language: Language;
  onOpenDoc: (path: string) => void;
}) {
  if (turn.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-ink text-paper px-4 py-2 text-sm whitespace-pre-wrap">
          {turn.text}
        </div>
      </div>
    );
  }
  if (turn.kind === "error") {
    return (
      <div className="max-w-[85%] rounded-2xl bg-red-50 border border-red-300 text-red-700 px-4 py-2 text-sm">
        {turn.text}
      </div>
    );
  }
  if (turn.matches.length === 0) {
    return (
      <div className="max-w-[85%] rounded-2xl bg-paper border border-line text-muted px-4 py-3 text-sm">
        {language === "es"
          ? "Sin coincidencias por encima del umbral. Reformula la pregunta."
          : "No matches above the similarity threshold. Try rephrasing."}
      </div>
    );
  }
  const [top, ...rest] = turn.matches;
  return (
    <div className="max-w-[92%] space-y-3">
      <div className="rounded-2xl bg-paper border border-line text-ink px-4 py-3 text-sm">
        <div className="flex flex-wrap gap-2 mb-2 text-[10px] text-muted uppercase tracking-wider items-center">
          <Pill>{top.role}</Pill>
          <Pill>{top.phase}</Pill>
          <Pill>{top.region}</Pill>
          <span className="text-muted/70">·</span>
          <span className="text-muted normal-case tracking-normal">
            sim {top.similarity.toFixed(2)}
          </span>
        </div>
        <QaCard row={top} language={language} embedded onOpenDoc={onOpenDoc} />
      </div>

      {rest.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer hover:text-ink-soft select-none">
            {rest.length} more match{rest.length === 1 ? "" : "es"}
          </summary>
          <div className="mt-2 space-y-2">
            {rest.map((m: QaRow & { similarity: number }) => (
              <div key={m.id} className="rounded border border-line bg-soft p-3">
                <QaCard row={m} language={language} embedded onOpenDoc={onOpenDoc} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-deep text-muted normal-case tracking-normal">
      {children}
    </span>
  );
}
