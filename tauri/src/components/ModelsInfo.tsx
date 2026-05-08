import { useEffect, useRef, useState } from "react";

import { ollamaPullEmbedModel, systemInfo } from "../api";
import type { SystemInfo } from "../types";

export default function ModelsInfo() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [pulling, setPulling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function refresh() {
    systemInfo().then(setInfo).catch(() => {});
  }

  async function pull() {
    setPulling(true);
    setErr(null);
    try {
      await ollamaPullEmbedModel();
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPulling(false);
    }
  }

  const ollamaOk = info?.ollama.reachable && info?.ollama.embed_model_present;
  const ollamaWarn = info?.ollama.reachable && !info?.ollama.embed_model_present;
  const dotCls = ollamaOk
    ? "bg-leaf"
    : ollamaWarn
    ? "bg-amber-500"
    : "bg-muted";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Local models & runtime"
        className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] transition ${
          open
            ? "border-line bg-deep text-ink"
            : "border-line bg-soft/60 text-ink-soft hover:border-line hover:text-ink"
        }`}
      >
        <span className={`block w-2 h-2 rounded-full ${dotCls}`} />
        <span>models</span>
      </button>

      {open && info && (
        <div className="absolute z-30 mt-1 right-0 w-[min(360px,calc(100vw-32px))] rounded-md border border-line bg-paper shadow-xl text-ink text-xs p-4 space-y-4">
          <Section
            title="Ollama daemon"
            status={
              info.ollama.reachable
                ? { tone: "ok", text: "running" }
                : { tone: "err", text: "offline" }
            }
          >
            <KV k="base">{info.ollama.base_url}</KV>
          </Section>

          <Section
            title="Embedding model"
            status={
              info.ollama.embed_model_present
                ? { tone: "ok", text: "loaded" }
                : { tone: "warn", text: "not pulled" }
            }
          >
            <KV k="model">{info.ollama.embed_model}</KV>
            {!info.ollama.embed_model_present && info.ollama.reachable && (
              <button
                type="button"
                disabled={pulling}
                onClick={pull}
                className="mt-1 px-2 py-1 rounded border border-line bg-deep text-ink text-[11px] hover:border-muted disabled:opacity-50"
              >
                {pulling ? "Pulling… (~270 MB)" : "Pull now"}
              </button>
            )}
            {err && <div className="text-red-700 mt-1">{err}</div>}
          </Section>

          <Section
            title="Knowledge base"
            status={{ tone: "ok", text: `${info.kb_total} Q&A` }}
          >
            <KV k="path">
              <code className="font-mono text-[10px] break-all">{info.kb_path}</code>
            </KV>
          </Section>

          <Section
            title="Document repository"
            status={{ tone: "ok", text: `${info.docs_total} files` }}
          >
            <KV k="root">
              <code className="font-mono text-[10px] break-all">{info.docs_root}</code>
            </KV>
          </Section>

          <Section title="Alert API" status={{ tone: "muted", text: "polling" }}>
            <KV k="base">
              <code className="font-mono text-[10px] break-all">{info.api_base}</code>
            </KV>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  status,
  children,
}: {
  title: string;
  status: { tone: "ok" | "warn" | "err" | "muted"; text: string };
  children: React.ReactNode;
}) {
  const tone = {
    ok: "text-leaf",
    warn: "text-amber-700",
    err: "text-red-700",
    muted: "text-muted",
  }[status.tone];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-muted uppercase tracking-wider text-[10px]">{title}</span>
        <span className={`${tone} text-[10px] font-medium`}>{status.text}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted w-12 shrink-0">{k}</span>
      <span className="text-ink-soft break-all">{children}</span>
    </div>
  );
}
