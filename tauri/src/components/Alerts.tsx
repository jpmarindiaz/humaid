import { useEffect, useMemo, useState } from "react";

import { acknowledgeAlert, getQaMany, listAlerts, pollAlertsNow, refetchAlertHistory } from "../api";
import type {
  Alert,
  AlertImages,
  Language,
  Profile,
  QaRow,
  Region,
} from "../types";
import AlertMap from "./AlertMap";
import DocViewer from "./DocViewer";
import ImageLightbox from "./ImageLightbox";
import QaCard from "./QaCard";

const IMAGE_SLOTS: { key: keyof AlertImages; label: string }[] = [
  { key: "pre_rgb",  label: "Baseline · RGB" },
  { key: "pre_swir", label: "Baseline · SWIR" },
  { key: "cur_rgb",  label: "Current · RGB" },
  { key: "cur_swir", label: "Current · SWIR" },
];

export default function Alerts({
  language,
  regionFilter,
}: {
  profile: Profile;
  language: Language;
  regionFilter: Region | "all";
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [recommendedQa, setRecommendedQa] = useState<QaRow[]>([]);
  const [polling, setPolling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  const [openDoc, setOpenDoc] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [regionFilter]);

  useEffect(() => {
    if (!selected || selected.recommended_qa_ids.length === 0) {
      setRecommendedQa([]);
      return;
    }
    getQaMany(selected.recommended_qa_ids)
      .then(setRecommendedQa)
      .catch((e) => setErr(String(e)));
  }, [selected]);

  // Documents are derived client-side from the recommended Q&A's references —
  // no extra server contract needed.
  const recommendedDocs = useMemo(() => {
    const set = new Map<string, number>();
    for (const q of recommendedQa) {
      const refs = (q.references || "").split("|").map((s) => s.trim()).filter(Boolean);
      const types = (q.ref_types || "").split("|").map((s) => s.trim());
      for (let i = 0; i < refs.length; i++) {
        const t = types[i] ?? "local";
        if (t !== "local") continue;
        if (!refs[i].endsWith(".md")) continue;
        set.set(refs[i], (set.get(refs[i]) ?? 0) + 1);
      }
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [recommendedQa]);

  async function refresh() {
    try {
      const items = await listAlerts({
        region: regionFilter === "all" ? undefined : regionFilter,
        limit: 100,
      });
      setAlerts(items);
      // Reset selection to the newest matching alert when the filter changes.
      setSelected(items[0] ?? null);
    } catch (e) {
      setErr(String(e));
    }
  }

  async function pollNow() {
    setPolling(true);
    setErr(null);
    try {
      await pollAlertsNow();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPolling(false);
    }
  }

  async function refetchHistory() {
    setPolling(true);
    setErr(null);
    try {
      await refetchAlertHistory();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPolling(false);
    }
  }

  return (
    <div
      className={`grid h-full grid-cols-1 ${
        openDoc
          ? "md:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)]"
          : "md:grid-cols-[280px_minmax(0,1fr)]"
      }`}
    >
      <aside
        className={`border-r border-line px-3 py-3 overflow-y-auto scrollbar-thin md:block ${
          selected ? "hidden md:block" : "block"
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <strong className="text-sm">Alerts</strong>
          <button
            type="button"
            onClick={pollNow}
            disabled={polling}
            className="text-xs px-2.5 py-1 rounded border border-line bg-paper text-ink-soft hover:border-muted hover:text-ink disabled:opacity-50"
          >
            {polling ? "Polling…" : "Poll now"}
          </button>
        </div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted">
            Region: <em className="not-italic text-ink-soft">{regionFilter === "all" ? "all" : regionFilter}</em>
          </p>
          <button
            type="button"
            onClick={refetchHistory}
            disabled={polling}
            title="Drop the local cursor and re-pull the full server history"
            className="text-[10px] text-muted hover:text-ink underline underline-offset-2 disabled:opacity-50"
          >
            refetch history
          </button>
        </div>

        {err && (
          <div className="rounded border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-xs mb-3">
            {err}
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="text-xs text-muted leading-relaxed">
            No alerts yet. The app polls every 60 s while this tab is open;
            nothing to show is good news.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((a) => {
              const sevTone = a.severity === "severe"
                ? "border-red-300 hover:border-red-400"
                : "border-amber-300 hover:border-amber-400";
              const sevText = a.severity === "severe" ? "text-red-700" : "text-amber-700";
              const active = selected?.id === a.id ? "ring-1 ring-terracotta/60" : "";
              return (
                <li
                  key={a.id}
                  onClick={() => {
                    setSelected(a);
                    setOpenDoc(null);
                    acknowledgeAlert(a.id).catch(() => {});
                  }}
                  className={`px-2.5 py-2 rounded-md bg-paper border cursor-pointer transition ${sevTone} ${active}`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={`text-[10px] uppercase tracking-wider font-medium ${sevText}`}>
                      {a.severity}
                    </span>
                    <span className="text-[10px] text-muted">{relativeTs(a.timestamp)}</span>
                  </div>
                  <div className="text-sm text-ink mt-0.5">
                    {a.location.replace(/_/g, " ") || a.region.replace("-", " ")}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section
        className={`overflow-y-auto scrollbar-thin ${
          selected ? "block" : "hidden md:block"
        }`}
      >
        {selected ? (
          <AlertDetail
            alert={selected}
            recommendedQa={recommendedQa}
            recommendedDocs={recommendedDocs}
            language={language}
            onOpenImage={(src, caption) => setLightbox({ src, caption })}
            onOpenDoc={(p) => setOpenDoc(p)}
            openDocPath={openDoc}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="text-muted text-sm text-center pt-20">Select an alert.</div>
        )}
      </section>

      {openDoc && (
        <aside
          className="bg-paper overflow-hidden md:border-l md:border-line fixed inset-0 z-30 md:static md:inset-auto"
        >
          <DocViewer
            path={openDoc}
            language={language}
            onClose={() => setOpenDoc(null)}
          />
        </aside>
      )}

      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function AlertDetail({
  alert,
  recommendedQa,
  recommendedDocs,
  language,
  onOpenImage,
  onOpenDoc,
  openDocPath,
  onBack,
}: {
  alert: Alert;
  recommendedQa: QaRow[];
  recommendedDocs: [string, number][];
  language: Language;
  onOpenImage: (src: string, caption: string) => void;
  onOpenDoc: (path: string) => void;
  openDocPath: string | null;
  onBack?: () => void;
}) {
  const l = alert.labels;
  const sevColor = alert.severity === "severe"
    ? "text-red-700 bg-red-50"
    : "text-amber-700 bg-amber-50";

  const images = alert.images ?? {};
  const fourUp = !!(images.pre_rgb || images.cur_rgb || images.pre_swir || images.cur_swir);
  const singleThumbCaption = "📡 Onboard satellite · LFM2-VL-450M";
  const headerLocation = alert.location_label
    ?? (alert.location.replace(/_/g, " ") || alert.region.replace("-", " "));

  return (
    <div className="grid grid-rows-[auto_auto_auto_1fr] h-full">
      <header className="px-4 sm:px-6 pt-3 sm:pt-5 pb-3 flex items-start justify-between gap-3 border-b border-line">
        <div className="min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden inline-flex items-center gap-1 text-xs text-muted hover:text-ink mb-1"
            >
              ← Back
            </button>
          )}
          <p className="text-[10px] uppercase tracking-wider text-muted">flood alert</p>
          <h2 className="text-xl font-serif font-semibold tracking-tight">{headerLocation}</h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted font-mono">
            <span>{alert.timestamp}</span>
            <span className="opacity-50">·</span>
            <span>{alert.region.replace("-", " ")}</span>
            {alert.source && (
              <>
                <span className="opacity-50">·</span>
                <span title="alert provenance">📡 {alert.source.kind}{alert.source.scenario_id ? ` · ${alert.source.scenario_id}` : ""}</span>
              </>
            )}
          </div>
        </div>
        <span className={`text-sm px-3 py-1 rounded ${sevColor} uppercase tracking-wider font-medium`}>
          {alert.severity}
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] border-b border-line">
        <div className="aspect-[16/10] border-b md:border-b-0 md:border-r border-line">
          <AlertMap coords={alert.coordinates} region={alert.region} severity={alert.severity} />
        </div>
        <div className="px-4 sm:px-5 py-4 space-y-3">
          {alert.summary ? (
            <p className="text-sm text-ink leading-relaxed">{alert.summary}</p>
          ) : (
            <p className="text-sm text-muted italic">No human-readable summary.</p>
          )}
          {alert.coordinates && (
            <p className="text-[11px] text-muted font-mono">
              {alert.coordinates.lat.toFixed(4)}°, {alert.coordinates.lon.toFixed(4)}°
            </p>
          )}
          <div className="grid grid-cols-2 gap-1.5 pt-2">
            <Field label="flood">{l.flood_present ? "yes" : "no"}</Field>
            <Field label="severity">{l.flood_severity}</Field>
            <Field label="water">{l.water_coverage_pct_estimate}</Field>
            <Field label="populated">{l.populated_area_affected ? "yes" : "no"}</Field>
            <Field label="infrastructure">{l.infrastructure_at_risk ? "yes" : "no"}</Field>
            <Field label="river overflow">{l.river_overflow_visible ? "yes" : "no"}</Field>
            <Field label="image quality">{l.image_quality_limited ? "limited" : "ok"}</Field>
          </div>
        </div>
      </div>

      {/* Image strip — single watermarked thumbnail today; 4-up if/when the
          server starts returning the raw RGB+SWIR pair. */}
      {fourUp ? (
        <div className="px-4 sm:px-6 py-4 border-b border-line">
          <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2">satellite tiles</h3>
          <div className="grid grid-cols-4 gap-2">
            {IMAGE_SLOTS.map((slot) => {
              const url = images[slot.key];
              const fallback = images.thumb_b64 ?? alert.thumbnail_url;
              const src = url ?? fallback;
              return (
                <button
                  key={slot.key}
                  type="button"
                  disabled={!src}
                  onClick={() => src && onOpenImage(src, slot.label)}
                  className="group block text-left disabled:cursor-not-allowed"
                >
                  <div className="aspect-square rounded border border-line bg-deep overflow-hidden flex items-center justify-center">
                    {src ? (
                      <img src={src} alt={slot.label} className="w-full h-full object-cover transition group-hover:opacity-90" />
                    ) : (
                      <span className="text-[10px] text-muted px-2 text-center">{slot.label}<br />unavailable</span>
                    )}
                  </div>
                  <span className="block text-[10px] text-muted mt-1">{slot.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : alert.thumbnail_url ? (
        <div className="px-4 sm:px-6 py-4 border-b border-line">
          <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2">satellite thumbnail</h3>
          <button
            type="button"
            onClick={() => onOpenImage(alert.thumbnail_url!, singleThumbCaption)}
            className="block w-full max-w-md group text-left"
          >
            <div className="rounded border border-line bg-deep overflow-hidden">
              <img
                src={alert.thumbnail_url}
                alt="Onboard satellite thumbnail"
                className="w-full h-auto object-cover transition group-hover:opacity-95"
                onError={(e) => {
                  (e.currentTarget.parentElement as HTMLElement).innerHTML =
                    '<div class="text-[11px] text-muted px-3 py-6 text-center">thumbnail unavailable · network may be offline</div>';
                }}
              />
            </div>
            <p className="text-[10px] text-muted mt-1.5 font-mono">
              {singleThumbCaption} · click to enlarge
            </p>
          </button>
        </div>
      ) : null}

      <div className="px-4 sm:px-6 py-5 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-muted mb-3">
              Recommended SOPs · {recommendedQa.length}
            </h3>
            {recommendedQa.length === 0 ? (
              <p className="text-sm text-muted">No recommended Q&amp;A IDs attached.</p>
            ) : (
              <div className="space-y-3">
                {recommendedQa.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-paper border border-line px-4 py-3">
                    <QaCard row={r} language={language} embedded onOpenDoc={onOpenDoc} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-muted mb-3">
              Relevant documents · {recommendedDocs.length}
            </h3>
            {recommendedDocs.length === 0 ? (
              <p className="text-sm text-muted">
                None of the recommended Q&amp;A cite a bundled document.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {recommendedDocs.map(([path, count]) => (
                  <li key={path}>
                    <button
                      type="button"
                      onClick={() => onOpenDoc(path)}
                      className={`w-full text-left px-3 py-2 rounded-md border transition ${
                        openDocPath === path
                          ? "border-terracotta bg-terracotta/10"
                          : "border-line bg-paper hover:border-muted hover:bg-soft"
                      }`}
                    >
                      <div className="text-sm text-ink leading-snug truncate" title={path}>
                        {prettyDocName(path)}
                      </div>
                      <div className="text-[10px] text-muted font-mono truncate">
                        {path.replace(/^research\//, "")} · cited {count}×
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded bg-soft/60 border border-line px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="text-sm text-ink">{children}</div>
    </div>
  );
}

function prettyDocName(path: string): string {
  const stem = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
  return stem.replace(/-/g, " ").replace(/_/g, " ");
}

function relativeTs(ts: string): string {
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return ts;
  const delta = (Date.now() - t) / 1000;
  if (delta < 60) return `${Math.round(delta)}s ago`;
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
}
