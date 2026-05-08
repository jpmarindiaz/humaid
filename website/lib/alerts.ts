// Alert publishing + storage. Backed by Deno KV (free on Deno Deploy,
// in-memory locally), with a tiny in-memory fallback if KV isn't available
// for some reason.
//
// Contract is the AlertRecord shape consumed by the Tauri desktop app —
// see `tauri/README.md` and `website/docs/SIMULATOR.md`.
//
// Threshold rule (the single source of truth):
//   flood_present && populated_area_affected && !image_quality_limited
// If true, the alert is "publishable". Severity tier comes from
// labels.flood_severity directly.

import { qaSearch } from "./qa.ts";
import type { FloodLabels } from "./flood.ts";

export interface Coordinates { lon: number; lat: number }

export interface AlertRecord {
  id: string;
  timestamp: string;
  region: "la-mojana" | "putumayo";
  location: string;       // slug, e.g. "san_jacinto_del_cauca"
  location_label: string; // human-readable
  coordinates: Coordinates;
  severity: "minor" | "moderate" | "severe";
  labels: FloodLabels;
  recommended_qa_ids: string[];
  /** Pre-baked watermarked thumbnail of the AFTER tile, ~280×280 with an
   *  "ONBOARD · LFM2-VL · computed in space" footer band. Both the website
   *  alert UI and the Tauri desktop app render this. Stable URL — the
   *  asset ships in the deploy artifact. */
  thumbnail_url: string;
  source: {
    kind: "simulator" | "live_simsat";
    scenario_id?: string;
  };
}

export interface PublishInput {
  region: AlertRecord["region"];
  location: string;
  location_label: string;
  coordinates: Coordinates;
  labels: FloodLabels;
  thumbnail_url: string;
  source: AlertRecord["source"];
}

/** Single-source-of-truth threshold for "should we publish an alert?" */
export function shouldPublishAlert(labels: FloodLabels): boolean {
  return labels.flood_present
    && labels.populated_area_affected
    && !labels.image_quality_limited;
}

// ── Storage backend ───────────────────────────────────────────────────

let kv: Deno.Kv | null = null;
let kvProbed = false;
const memoryFallback: AlertRecord[] = [];

async function getKv(): Promise<Deno.Kv | null> {
  if (kvProbed) return kv;
  kvProbed = true;
  try {
    kv = await Deno.openKv();
    console.log("[alerts] using Deno KV for storage");
    return kv;
  } catch (err) {
    console.warn(`[alerts] Deno KV unavailable, using in-memory fallback: ${(err as Error).message}`);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────

let counter = 0;

function genAlertId(): string {
  const date = new Date().toISOString().slice(0, 10);
  counter++;
  return `alert-${date}-${String(counter).padStart(3, "0")}`;
}

/** Build the synthesized retrieval query — one short string the embedder
 *  can turn into a vector for KB lookup. Mirrors the SIMULATOR.md spec. */
function buildSynthQuery(rec: AlertRecord): string {
  const parts: string[] = [];
  parts.push(`Flood ${rec.labels.flood_severity} severity in ${rec.location_label}, ${rec.region}.`);
  if (rec.labels.populated_area_affected) parts.push("Populated area affected.");
  if (rec.labels.infrastructure_at_risk)  parts.push("Infrastructure at risk.");
  if (rec.labels.river_overflow_visible)  parts.push("River overflow visible.");
  return parts.join(" ");
}

/** Publish an alert: assigns id+timestamp, computes recommended_qa_ids,
 *  stores under primary + secondary indexes. */
export async function publishAlert(input: PublishInput): Promise<AlertRecord> {
  const id = genAlertId();
  const timestamp = new Date().toISOString();

  const record: AlertRecord = {
    id,
    timestamp,
    region: input.region,
    location: input.location,
    location_label: input.location_label,
    coordinates: input.coordinates,
    severity: (input.labels.flood_severity === "none" ? "minor" : input.labels.flood_severity) as AlertRecord["severity"],
    labels: input.labels,
    recommended_qa_ids: [],
    thumbnail_url: input.thumbnail_url,
    source: input.source,
  };

  // Build recommended Q&A list — phase=event is the right scope for an
  // active alert, region biases the result toward local SOPs.
  try {
    const synth = buildSynthQuery(record);
    const matches = await qaSearch(synth, {
      region: record.region,
      phase: "event",
      limit: 5,
    });
    record.recommended_qa_ids = matches.map((m) => m.id);
    console.log(`[alerts] ${id} recommended_qa_ids=${record.recommended_qa_ids.join(",")}`);
  } catch (err) {
    console.warn(`[alerts] ${id} recommended_qa_ids skipped: ${(err as Error).message}`);
  }

  const kvHandle = await getKv();
  if (kvHandle) {
    await kvHandle.atomic()
      .set(["alert", id], record)
      .set(["alert_by_region", record.region, timestamp, id], id)
      .commit();
  } else {
    memoryFallback.push(record);
  }
  console.log(`[alerts] ${id} published · ${record.region}/${record.location} · severity=${record.severity}`);
  return record;
}

export async function listAlerts(opts: {
  region?: AlertRecord["region"];
  since?: string;
  limit?: number;
}): Promise<{ alerts: AlertRecord[]; cursor: string }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const since = opts.since ?? "1970-01-01T00:00:00.000Z";

  const kvHandle = await getKv();
  const out: AlertRecord[] = [];

  if (kvHandle) {
    if (opts.region) {
      const iter = kvHandle.list<string>({
        start: ["alert_by_region", opts.region, since],
        end:   ["alert_by_region", opts.region, "9"],
      }, { limit });
      for await (const entry of iter) {
        const id = entry.value;
        const rec = await kvHandle.get<AlertRecord>(["alert", id]);
        if (rec.value) out.push(rec.value);
      }
    } else {
      const iter = kvHandle.list<AlertRecord>({ prefix: ["alert"] }, { limit });
      for await (const entry of iter) {
        if (entry.value && entry.value.timestamp > since) out.push(entry.value);
      }
    }
  } else {
    for (const rec of memoryFallback) {
      if (opts.region && rec.region !== opts.region) continue;
      if (rec.timestamp <= since) continue;
      out.push(rec);
      if (out.length >= limit) break;
    }
  }

  // Newest first.
  out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  // Cursor for the next poll = max timestamp we returned (or `since` if empty).
  const cursor = out[0]?.timestamp ?? since;
  return { alerts: out, cursor };
}

export async function getAlert(id: string): Promise<AlertRecord | null> {
  const kvHandle = await getKv();
  if (kvHandle) {
    const rec = await kvHandle.get<AlertRecord>(["alert", id]);
    return rec.value ?? null;
  }
  return memoryFallback.find((a) => a.id === id) ?? null;
}
