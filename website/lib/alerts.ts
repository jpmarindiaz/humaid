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
  /** Optional human-written note attached at publish time. Useful for the
   *  manual-publish path ("water rising past the bridge near the school"). */
  message?: string;
  source: {
    kind: "simulator" | "live_simsat" | "manual";
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
  message?: string;
  source: AlertRecord["source"];
}

/** Single-source-of-truth threshold for "should we publish an alert?" */
export function shouldPublishAlert(labels: FloodLabels): boolean {
  return labels.flood_present
    && labels.populated_area_affected
    && !labels.image_quality_limited;
}

// ── Historical seed data ──────────────────────────────────────────────
//
// Pre-loaded "past alerts" so the Tauri app's first poll returns useful
// content even before anyone publishes from the simulator. These look
// like alerts the real onboard pipeline would have emitted at major past
// events. Source kind = "live_simsat" — these are not from the website
// simulator, they're back-fill from the historical record.

interface HistoricalSeed {
  id: string;
  timestamp: string;            // back-dated to event date
  region: AlertRecord["region"];
  location: string;
  location_label: string;
  lon: number;
  lat: number;
  labels: FloodLabels;
  thumbnail_url: string;
}

const HISTORICAL_SEEDS: HistoricalSeed[] = [
  {
    id: "alert-historical-mocoa-2017",
    timestamp: "2017-04-01T08:30:00.000Z",
    region: "putumayo",
    location: "mocoa",
    location_label: "Mocoa, Putumayo",
    lon: -76.6534, lat: 1.1463,
    labels: {
      flood_present: true,
      flood_severity: "severe",
      water_coverage_pct_estimate: "10-30%",
      populated_area_affected: true,
      infrastructure_at_risk: true,
      river_overflow_visible: true,
      image_quality_limited: false,
    },
    thumbnail_url: "/assets/samples/mocoa-2017-thumb.png",
  },
  {
    id: "alert-historical-cara-de-gato-2021",
    timestamp: "2021-08-27T18:42:00.000Z",
    region: "la-mojana",
    location: "san_jacinto_del_cauca",
    location_label: "San Jacinto del Cauca, Bolívar",
    lon: -74.7167, lat: 8.25,
    labels: {
      flood_present: true,
      flood_severity: "severe",
      water_coverage_pct_estimate: "30-60%",
      populated_area_affected: true,
      infrastructure_at_risk: true,
      river_overflow_visible: true,
      image_quality_limited: false,
    },
    thumbnail_url: "/assets/samples/san-benito-abad-2021-thumb.png",
  },
  {
    id: "alert-historical-san-benito-abad-2021",
    timestamp: "2021-09-15T14:00:00.000Z",
    region: "la-mojana",
    location: "san_benito_abad",
    location_label: "San Benito Abad, Sucre",
    lon: -75.0319, lat: 8.9275,
    labels: {
      flood_present: true,
      flood_severity: "severe",
      water_coverage_pct_estimate: "30-60%",
      populated_area_affected: true,
      infrastructure_at_risk: true,
      river_overflow_visible: true,
      image_quality_limited: false,
    },
    thumbnail_url: "/assets/samples/san-benito-abad-2021-thumb.png",
  },
  {
    id: "alert-historical-la-mojana-peak-2022",
    timestamp: "2022-12-15T11:20:00.000Z",
    region: "la-mojana",
    location: "ayapel",
    location_label: "Ayapel, Córdoba",
    lon: -75.1389, lat: 8.3128,
    labels: {
      flood_present: true,
      flood_severity: "moderate",
      water_coverage_pct_estimate: "30-60%",
      populated_area_affected: true,
      infrastructure_at_risk: false,
      river_overflow_visible: false,
      image_quality_limited: false,
    },
    thumbnail_url: "/assets/samples/ayapel-peak-2022-thumb.png",
  },
  {
    id: "alert-historical-cara-de-gato-2024",
    timestamp: "2024-05-06T15:30:00.000Z",
    region: "la-mojana",
    location: "san_jacinto_del_cauca",
    location_label: "San Jacinto del Cauca, Bolívar",
    lon: -74.7167, lat: 8.25,
    labels: {
      flood_present: true,
      flood_severity: "moderate",
      water_coverage_pct_estimate: "30-60%",
      populated_area_affected: true,
      infrastructure_at_risk: true,
      river_overflow_visible: true,
      image_quality_limited: false,
    },
    thumbnail_url: "/assets/samples/cara-de-gato-2024-thumb.png",
  },
];

// Bump this when you change HISTORICAL_SEEDS so the next isolate boot
// re-seeds (the marker key includes the version).
const SEED_VERSION = "v1";

// ── Storage backend ───────────────────────────────────────────────────

let kv: Deno.Kv | null = null;
let kvProbed = false;
const memoryFallback: AlertRecord[] = [];
let seedPromise: Promise<void> | null = null;

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

/** Idempotent seed of historical alerts. Runs at most once per isolate
 *  (and at most once globally per SEED_VERSION when KV is available).
 *  Computes recommended_qa_ids by running qaSearch for each seed — the
 *  first list-poll on a fresh isolate pays a few hundred ms for this.
 *  Subsequent polls and isolates skip the work. */
async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const kvHandle = await getKv();
    const markerKey = ["alerts_seeded", SEED_VERSION];

    // KV-backed: skip if a previous isolate already seeded this version.
    if (kvHandle) {
      const marker = await kvHandle.get<boolean>(markerKey);
      if (marker.value) {
        console.log(`[alerts] seed ${SEED_VERSION} already applied — skipping`);
        return;
      }
    } else if (memoryFallback.some((a) => a.id.startsWith("alert-historical-"))) {
      // Memory-backed: skip if this isolate already seeded.
      return;
    }

    console.log(`[alerts] seeding ${HISTORICAL_SEEDS.length} historical alerts (${SEED_VERSION})`);
    for (const seed of HISTORICAL_SEEDS) {
      const synth = `Flood ${seed.labels.flood_severity} severity in ${seed.location_label}, ${seed.region}. ` +
        (seed.labels.populated_area_affected ? "Populated area affected. " : "") +
        (seed.labels.infrastructure_at_risk  ? "Infrastructure at risk. "  : "") +
        (seed.labels.river_overflow_visible  ? "River overflow visible."   : "");

      let recommended: string[] = [];
      try {
        const matches = await qaSearch(synth, { region: seed.region, phase: "event", limit: 5 });
        recommended = matches.map((m) => m.id);
      } catch (err) {
        console.warn(`[alerts] seed ${seed.id} qaSearch failed: ${(err as Error).message}`);
      }

      const record: AlertRecord = {
        id: seed.id,
        timestamp: seed.timestamp,
        region: seed.region,
        location: seed.location,
        location_label: seed.location_label,
        coordinates: { lon: seed.lon, lat: seed.lat },
        severity: seed.labels.flood_severity === "none" ? "minor" : seed.labels.flood_severity as AlertRecord["severity"],
        labels: seed.labels,
        recommended_qa_ids: recommended,
        thumbnail_url: seed.thumbnail_url,
        source: { kind: "live_simsat" },
      };

      if (kvHandle) {
        await kvHandle.atomic()
          .set(["alert", record.id], record)
          .set(["alert_by_region", record.region, record.timestamp, record.id], record.id)
          .commit();
      } else {
        memoryFallback.push(record);
      }
      console.log(`[alerts] seeded ${record.id} (${record.region}/${record.location}) qa=${recommended.length}`);
    }

    if (kvHandle) {
      await kvHandle.set(markerKey, true);
    }
    console.log(`[alerts] seed ${SEED_VERSION} complete`);
  })();
  return seedPromise;
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
    message: input.message,
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
  await ensureSeeded();
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
  await ensureSeeded();
  const kvHandle = await getKv();
  if (kvHandle) {
    const rec = await kvHandle.get<AlertRecord>(["alert", id]);
    return rec.value ?? null;
  }
  return memoryFallback.find((a) => a.id === id) ?? null;
}
