import { useEffect, useState } from "react";

import { getQaMany, readDocument } from "../api";
import type { DocContent, Language, QaRow } from "../types";
import MarkdownView from "./MarkdownView";

export default function DocViewer({
  path,
  language,
  onClose,
  onPickQa,
}: {
  path: string;
  language: Language;
  onClose?: () => void;
  onPickQa?: (qa: QaRow) => void;
}) {
  const [doc, setDoc] = useState<DocContent | null>(null);
  const [citing, setCiting] = useState<QaRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setDoc(null);
    setCiting([]);
    readDocument(path)
      .then(async (d) => {
        if (cancelled) return;
        setDoc(d);
        if (d.citing_qa_ids.length > 0) {
          try {
            const rows = await getQaMany(d.citing_qa_ids);
            if (!cancelled) setCiting(rows);
          } catch { /* ignore */ }
        }
      })
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [path]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-start justify-between gap-3 px-5 py-3 border-b border-line bg-cream/80">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted">document</p>
          <h2 className="text-base font-serif font-semibold text-ink truncate" title={path}>
            {doc?.title ?? path.split("/").pop()}
          </h2>
          <p className="text-[10px] text-muted font-mono truncate" title={path}>
            {path}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink px-2 py-1 text-xs"
            title="Close"
          >
            ×
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6">
        {loading && <div className="text-muted text-sm">Loading…</div>}
        {err && (
          <div className="rounded border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {err}
          </div>
        )}
        {doc && <MarkdownView markdown={doc.markdown} />}

        {citing.length > 0 && (
          <section className="border-t border-line pt-4">
            <h3 className="text-[10px] uppercase tracking-wider text-muted mb-3">
              Cited by {citing.length} Q&amp;A
            </h3>
            <ul className="space-y-2">
              {citing.map((q) => (
                <li
                  key={q.id}
                  onClick={() => onPickQa?.(q)}
                  className={`rounded border border-line bg-soft/60 px-3 py-2 text-sm ${
                    onPickQa
                      ? "cursor-pointer hover:border-line hover:bg-paper"
                      : ""
                  }`}
                >
                  <div className="flex flex-wrap gap-1.5 mb-1 text-[10px] text-muted uppercase tracking-wider">
                    <span className="px-1.5 py-0.5 rounded bg-deep text-muted">{q.id}</span>
                    <span className="px-1.5 py-0.5 rounded bg-deep text-muted">{q.role}</span>
                    <span className="px-1.5 py-0.5 rounded bg-deep text-muted">{q.phase}</span>
                    <span className="px-1.5 py-0.5 rounded bg-deep text-muted">{q.region}</span>
                  </div>
                  <p className="text-ink leading-snug">
                    {language === "en" ? q.question_en : q.question_es}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
