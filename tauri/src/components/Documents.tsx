import { useEffect, useMemo, useState } from "react";

import { listDocuments } from "../api";
import type { DocSummary, Language, QaRow } from "../types";
import DocViewer from "./DocViewer";

export default function Documents({
  language,
  initialPath,
  onPickQa,
}: {
  language: Language;
  initialPath?: string | null;
  onPickQa?: (qa: QaRow) => void;
}) {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(initialPath ?? null);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listDocuments()
      .then((d) => {
        setDocs(d);
        if (!selected && d.length > 0) setSelected(d[0].path);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If parent wants a specific doc opened, honour it.
  useEffect(() => {
    if (initialPath) setSelected(initialPath);
  }, [initialPath]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.path.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q),
    );
  }, [docs, filter]);

  return (
    <div className="grid h-full md:grid-cols-[320px_1fr] grid-cols-1">
      <aside className={`border-r border-line md:flex flex-col ${selected ? "hidden md:flex" : "flex"}`}>
        <div className="p-3 border-b border-line space-y-2">
          <input
            type="search"
            placeholder="Filter documents…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-paper border border-line focus:border-terracotta focus:outline-none rounded-md px-2.5 py-1.5 text-xs text-ink placeholder:text-muted/60"
          />
          <p className="text-[10px] text-muted">
            {loading
              ? "Loading…"
              : `${filtered.length} of ${docs.length} files · bundled locally`}
          </p>
        </div>

        {err && (
          <div className="m-3 rounded border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-xs">
            {err}
          </div>
        )}

        <ul className="flex-1 overflow-y-auto scrollbar-thin">
          {filtered.map((d) => (
            <li
              key={d.path}
              onClick={() => setSelected(d.path)}
              className={`cursor-pointer px-3 py-2 border-b border-line transition ${
                selected === d.path
                  ? "bg-paper ring-inset ring-1 ring-terracotta/50"
                  : "hover:bg-soft"
              }`}
            >
              <div className="text-sm text-ink leading-snug truncate">{d.title}</div>
              <div className="text-[10px] text-muted font-mono truncate" title={d.path}>
                {d.path.replace(/^research\//, "")}
              </div>
              <div className="flex gap-2 mt-1 text-[10px] text-muted">
                <span>{d.citation_count} cite{d.citation_count === 1 ? "" : "s"}</span>
                <span>·</span>
                <span>{formatBytes(d.size_bytes)}</span>
                {!d.exists && (
                  <span className="text-amber-700">· missing</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <section className={`overflow-hidden ${selected ? "block" : "hidden md:block"}`}>
        {selected ? (
          <DocViewer path={selected} language={language} onPickQa={onPickQa} onClose={() => setSelected(null)} />
        ) : (
          <div className="text-muted text-sm text-center pt-20">
            Select a document.
          </div>
        )}
      </section>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
