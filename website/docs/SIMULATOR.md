# Alert simulator — spec for the website team

The flood inference pipeline already works (`POST /api/flood` returns the 7-key JSON). This doc covers the **scenario picker** that drives it from preloaded data, and the **alert publishing + polling** layer that closes the loop with the desktop app (`../../tauri/README.md`).

## The flow we want to demo

```
  ┌──────────────────────────── website /simulator ────────────────────────────┐
  │                                                                            │
  │  1. User picks a region    ▼                                               │
  │       la-mojana | putumayo                                                 │
  │  2. User picks a location  ▼                                               │
  │       san_jacinto_del_cauca | mocoa | san_marcos | …                       │
  │  3. User picks an event scenario  ▼                                        │
  │       cara_de_gato_2024 | la_mojana_peak_2022 | mocoa_avalancha_2017 | …   │
  │  4. User picks comparison windows ▼                                        │
  │       baseline = pre          current = event   ← default                  │
  │       (or "post" to demo recovery, "pre vs pre" to demo no-flood case)     │
  │                                                                            │
  │  → 4 PNGs preview side-by-side  (rgb-pre, swir-pre, rgb-cur, swir-cur)     │
  │                                                                            │
  │  [ Run inference ]  ──── POST /api/flood ──→  {7-key JSON labels, latency} │
  │                                                                            │
  │  Threshold check:                                                          │
  │       flood_present && populated_area_affected && !image_quality_limited   │
  │             ↓ true                              ↓ false                    │
  │       [ Publish alert ]                  "No alert — labels shown"         │
  │             │                                                              │
  │             ▼                                                              │
  │     POST /api/alerts                                                       │
  │     { region, location, severity, labels, recommended_qa_ids }             │
  │             │                                                              │
  └─────────────┼──────────────────────────────────────────────────────────────┘
                ▼
        Persist to Deno KV (or SQLite)
                │
                ▼
  ┌──────────────── desktop app polls every N min ────────────────┐
  │  GET /api/alerts?region=la-mojana&since=<iso>                  │
  │     → [ {alert with labels + recommended_qa_ids}, … ]          │
  │  Renders a notification + opens the matching KB rows.          │
  └────────────────────────────────────────────────────────────────┘
```

## What already exists (don't rebuild)

- `POST /api/flood` — runs the 4-image inference and returns the 7-key JSON. Spec in `../../finetune-flood/docs/06-deploy-website.md`. The simulator just needs to feed it the right files.
- `POST /api/qa` and `lib/qa.ts:qaSearch()` — Nomic + DuckDB cosine search. Reuse it for the `recommended_qa_ids` mapping below.
- 110 labeled tile pairs in `../../finetune-flood/data/raw/` covering 18 location × event × window combos in La Mojana + Putumayo. Each tile has `rgb.png`, `swir.png`, `capture_metadata.json`, and `annotation.json` (ground-truth labels). **Use these as the preloaded scenarios.**

## What's new — five things to build

### 1. Scenarios catalog (server-side)

A static manifest the simulator reads at boot. Easiest: write a `scripts/build_scenarios.ts` that walks `../finetune-flood/data/raw/` and emits `data/scenarios.json`:

```jsonc
[
  {
    "id": "san_jacinto_del_cauca__cara_de_gato_2024",
    "region": "la-mojana",
    "location": "san_jacinto_del_cauca",
    "location_label": "San Jacinto del Cauca",
    "event_id": "cara_de_gato_2024",
    "event_label": "Cara de Gato dike breach (May 2024)",
    "windows": {
      "pre":   { "rgb": "scenarios/san_jacinto_del_cauca__cara_de_gato_2024/pre/rgb.png",   "swir": ".../pre/swir.png",   "ground_truth": {...} },
      "event": { "rgb": "scenarios/.../event/rgb.png", "swir": ".../event/swir.png", "ground_truth": {...} },
      "post":  { "rgb": "scenarios/.../post/rgb.png",  "swir": ".../post/swir.png",  "ground_truth": {...} }
    }
  }
  // ... one entry per (location, event)
]
```

The script copies the chosen PNGs from `finetune-flood/data/raw/` into `website/static/scenarios/<id>/<window>/{rgb,swir}.png` so the bundle ships them. Keep the set small — say 6-8 hand-picked scenarios that demonstrate variety (severe flood, moderate flood, no-flood baseline, image-quality-limited, post-event recovery).

Suggested first set:

| scenario | expected outcome |
|---|---|
| san_jacinto_del_cauca · cara_de_gato_2024 (pre→event) | severe flood, alert publishes |
| mocoa · mocoa_avalancha_2017 (pre→event) | severe flood, populated area, alert publishes |
| san_marcos · cara_de_gato_2021 (pre→event) | no flood (chronic wetland baseline), no alert |
| san_jacinto_del_cauca · cara_de_gato_2024 (pre→post) | recovery — flood_present=false, no alert |
| ayapel · la_mojana_peak_2022 (pre→event) | moderate flood |
| puerto_asis · putumayo flood (pre→event) | demo a Putumayo case |

### 2. New routes

```
GET  /api/scenarios                   → scenarios.json (the catalog)
GET  /static/scenarios/<id>/...       → already free via existing static handler
POST /api/simulate                    → wraps /api/flood with scenario_id + window choice
                                        body: { scenario_id, baseline: "pre", current: "event" }
                                        loads the 4 PNGs server-side and reuses predictFlood()
POST /api/alerts                      → publish an alert
                                        body: { region, location, severity, labels, scenario_id? }
                                        server picks alert id + timestamp,
                                        computes recommended_qa_ids (see #4),
                                        persists, returns the stored object
GET  /api/alerts?region=&since=&limit= → list alerts ≥ since, newest first, capped
GET  /api/alerts/:id                   → one alert (for deep-link / re-fetch)
```

The `/api/simulate` shortcut is useful so the UI doesn't have to re-upload PNGs the server already has on disk. It's just sugar over `/api/flood`.

### 3. Simulator UI (new page)

`views/Simulator.tsx` (Hono JSX shell) + `client/simulator.tsx` (React client), wired into `main.tsx` on `GET /simulator`. Three cards stacked:

1. **Scenario picker** — three dependent dropdowns (region → location → event) populated from `/api/scenarios`. Window selector defaults to `pre → event`.
2. **Image preview** — show the 4 PNGs side-by-side in a 2×2 grid (baseline row + current row, RGB column + SWIR column). Helps demo what the model "sees".
3. **Inference + alert panel** — "Run inference" button calls `/api/simulate`. Displays the 7-key JSON in a readable table, the latency, and the threshold verdict ("would publish alert: yes/no"). If yes, show "[ Publish alert ]" — clicking calls `/api/alerts` and shows the resulting alert id + a copy-paste curl for the desktop app's polling endpoint.

### 4. The recommended_qa_ids mapping

When `/api/alerts` is called, before persisting, the server should attach the top-k KB rows that the desktop app should auto-open. Reuse the existing retrieval stack — no new model, no new code path:

```ts
// in main.tsx, inside POST /api/alerts handler
const synth = `Flood ${labels.flood_severity} severity in ${location_label}, ${region}.
${labels.populated_area_affected ? "Populated area affected." : ""}
${labels.infrastructure_at_risk ? "Infrastructure at risk." : ""}
${labels.river_overflow_visible ? "River overflow visible." : ""}`;

const matches = await qaSearch(synth, { region, phase: "event", limit: 5 });
const recommended_qa_ids = matches.map((m) => m.id);
```

Phase-filter to `event` (or `pre` if labels say `flood_present=false` but the rest looks risky). Region filter applies the location-aware bias. The desktop app already has those rows locally in its `kb.duckdb`, so it just needs the IDs — no body, just pointers.

### 5. Alert storage

Deno Deploy gives you **Deno KV** for free — no external dependency, primary-key + secondary-index in one. Schema:

```ts
// primary index, by id
["alert", alert.id]                          → AlertRecord

// secondary index, by region + timestamp (for polling)
["alert_by_region", region, alert.timestamp, alert.id] → alert.id
```

The polling query becomes a `kv.list({ prefix: ["alert_by_region", region], start: ["alert_by_region", region, since] })`. Keep alerts forever for the demo (storage is small). For a long-running deploy add a cron/TTL.

If Deno KV isn't available in your deployment, fall back to a JSON file on disk or DuckDB — same shape, easy swap. The simulator demo doesn't need durability across redeploys.

## The AlertRecord shape (canonical contract for desktop app)

This is the contract the Tauri team is already coding against — keep it stable:

```ts
type AlertRecord = {
  id: string;                  // server-assigned, e.g. "alert-2026-05-08-001"
  timestamp: string;           // ISO 8601, server-assigned
  region: "la-mojana" | "putumayo";
  location: string;            // slug, e.g. "san_jacinto_del_cauca"
  location_label: string;      // human-readable
  severity: "minor" | "moderate" | "severe";  // copied from labels.flood_severity
  labels: {
    flood_present: boolean;
    flood_severity: "none" | "minor" | "moderate" | "severe";
    water_coverage_pct_estimate: "<10%" | "10-30%" | "30-60%" | ">60%";
    populated_area_affected: boolean;
    infrastructure_at_risk: boolean;
    river_overflow_visible: boolean;
    image_quality_limited: boolean;
  };
  recommended_qa_ids: string[]; // ["qa-0042", ...]  — desktop app opens these locally
  source: {
    kind: "simulator" | "live_simsat";
    scenario_id?: string;       // present when kind=simulator
  };
};
```

## Threshold rule (single source of truth)

Hard-code this in one helper, both the simulator and any future live-pipeline use it:

```ts
function shouldPublishAlert(labels: FloodLabels): boolean {
  return labels.flood_present
      && labels.populated_area_affected
      && !labels.image_quality_limited;
}
```

Severity tier comes from `labels.flood_severity` directly.

## Out of scope for this milestone

- Authenticating who can publish. Demo is open.
- Multiple subscriber regions per polling client. One region per device for v1.
- Pushing alerts (websockets / SSE). Polling is fine for the demo, the desktop app already plans for it.
- Live SimSat fetch ("get current satellite tile and run inference"). Easy follow-up — `../../finetune-flood/src/simsat.ts` already supports it. Add it after the preloaded simulator works end-to-end.

## Reference files

- Existing inference handler: `../main.tsx` (POST /api/flood)
- Inference internals: `../lib/flood.ts`
- Retrieval to reuse for `recommended_qa_ids`: `../lib/qa.ts` (`qaSearch()`)
- Sample image library: `../../finetune-flood/data/raw/<run>/<location>/<event>_<window>/{rgb,swir,annotation}.{png,json}`
- Schema source of truth: `../lib/prompts.ts` (`FLOOD_LABEL_SCHEMA`)
- Desktop-app contract (the consumer of `/api/alerts`): `../../tauri/README.md`
