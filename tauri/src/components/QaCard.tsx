import { openUrl } from "@tauri-apps/plugin-opener";

import type { Language, QaRow } from "../types";

export default function QaCard({
  row,
  language,
  embedded = false,
  onOpenDoc,
}: {
  row: QaRow;
  language: Language;
  embedded?: boolean;
  onOpenDoc?: (path: string) => void;
}) {
  const q = language === "en" ? row.question_en : row.question_es;
  const a = language === "en" ? row.answer_en : row.answer_es;
  const refs = parseRefs(row.references, row.ref_types);

  const wrapper = embedded
    ? "text-sm"
    : "rounded-2xl bg-paper border border-line text-ink px-4 py-3 text-sm";

  return (
    <article className={wrapper}>
      <div className="flex flex-wrap gap-1.5 mb-2 text-[10px]">
        <Pill>{row.id}</Pill>
        <Pill>{row.role}</Pill>
        <Pill>{row.phase}</Pill>
        <Pill>{row.region}</Pill>
        <Pill tone="topic">{row.topic}</Pill>
      </div>
      <h3 className="font-semibold text-ink mb-2 leading-snug">{q}</h3>
      <p className="text-ink-soft whitespace-pre-wrap mb-3">{a}</p>
      {refs.length > 0 && (
        <div className="text-[10px] text-muted border-t border-line pt-2 flex flex-wrap gap-x-3 gap-y-1 items-baseline">
          <span className="uppercase tracking-wider">sources:</span>
          {refs.map((r, i) => (
            <span key={i} className="font-mono">
              {r.type === "cloud" ? (
                <a
                  href={r.value}
                  className="text-terracotta-deep hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    openUrl(r.value).catch(() => {});
                  }}
                >
                  {short(r.value)}
                </a>
              ) : onOpenDoc ? (
                <button
                  type="button"
                  onClick={() => onOpenDoc(r.value)}
                  className="text-terracotta-deep hover:underline cursor-pointer"
                  title={`Open ${r.value}`}
                >
                  {shortLocal(r.value)}
                </button>
              ) : (
                <span>{shortLocal(r.value)}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "topic";
}) {
  const cls =
    tone === "topic"
      ? "bg-terracotta/15 text-terracotta"
      : "bg-deep text-muted";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}

function parseRefs(refs: string, types: string): { value: string; type: string }[] {
  if (!refs) return [];
  const r = refs.split("|").map((s) => s.trim()).filter(Boolean);
  const t = types.split("|").map((s) => s.trim());
  return r.map((value, i) => ({ value, type: t[i] ?? "local" }));
}

function short(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

function shortLocal(p: string): string {
  return p.replace(/^research\//, "");
}
