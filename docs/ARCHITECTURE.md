# humaid · Architecture

This document describes the humaid system end-to-end. It leads with the **fine-tuning process** because that's the sharp end — the small VLM that turns satellite imagery into JSON alerts is what makes the rest of the system viable. Then it covers the on-ground components that consume those alerts and serve actionable knowledge to people offline.

## Why this shape

humaid is **offline-first humanitarian response for flood crises**. The defining constraints:

- The user is already in the affected area when the crisis hits
- Cell towers, internet, sometimes power are down
- The decisions that matter happen in the first 6 hours
- Outside responders are hours-to-days away
- Whatever knowledge is going to help has to already be on the device

Everything else flows from those constraints:

1. **Detection has to come from somewhere that survives the outage.** Satellites do. Cell towers don't.
2. **Alerts have to be tiny.** Whatever ground link survives the storm is low bandwidth (satcom, mesh radio, an intermittent satellite phone). Sending raw imagery is impossible. Sending a JSON object the size of a tweet is fine.
3. **Knowledge has to be pre-synced.** SOPs, contact lists, evacuation routes, history of past events at this exact place — all locally present *before* the event.
4. **The model that does detection has to be small enough to run on a CubeSat-class compute node** so it can be in orbit, not on Earth. That's a 200–500 MB VLM, not a frontier model.

```
                                   SPACE
                       ┌─────────────────────────────┐
                       │  Fine-tuned VLM             │
                       │  (LFM2.5-VL-450M class)     │
                       │   image  →  JSON payload    │
                       └──────────────┬──────────────┘
                                      │ ~200 bytes
                                      │ over satcom
                                      ▼
            ┌────────────────────── EARTH ────────────────────────┐
            │                                                     │
            │  ┌───────────────┐         ┌─────────────────────┐  │
            │  │ Community     │ offline │ Local app           │  │
            │  │ station       │ ◄────►  │ (desktop / mobile)  │  │
            │  │ (sync hub)    │   LAN   │                     │  │
            │  └───────────────┘         │ - role-personalized │  │
            │                            │ - offline knowledge │  │
            │                            │   base              │  │
            │                            └─────────────────────┘  │
            └─────────────────────────────────────────────────────┘
```

---

# Part 1 · The fine-tuning process

The model is the sharp end. Everything below assumes a working "image → JSON alert" component running on the satellite. This section describes how we build that component.

## What the model does

Input: a Sentinel-2 satellite tile pair — RGB true color (B4-B3-B2) and SWIR false color (B12-B8-B4) at a baseline timestamp, plus the same two views at the current timestamp. Four PNGs, ~5km × 5km coverage each.

Output: a structured JSON object:

```json
{
  "flood_present": true,
  "flood_severity": "moderate",
  "water_coverage_pct_estimate": "30-60%",
  "populated_area_affected": true,
  "infrastructure_at_risk": true,
  "river_overflow_visible": true,
  "image_quality_limited": false
}
```

That's ~200 bytes. The whole point.

**Why pair input.** A town in the middle of a chronic ciénaga (La Mojana baseline) is visually identical to a flooded town in a single tile — both show wide dark patches of water. Single-tile labelers disagree on `flood_present` 25–37% of the time on La Mojana wetland tiles. Adding the pre-event baseline turns the question from "is this water normal?" into "did the water shape change?" — well-defined.

**Why SWIR not just RGB.** Water absorbs SWIR (~2.2 µm) almost completely, so it reads as near-black with extreme contrast against land. Sediment-laden flood water reads as brown — different from clear permanent water. Operational pipelines compute MNDWI (modified water-detection index) using SWIR for the same reason. We give the model SWIR raw rather than a precomputed index.

**Why a small model and not GPT-5/Claude/Gemini.** Three reasons:
- **Cost at scale**: hundreds to thousands of inferences per orbit pass × thousands of locations × continuous monitoring = unaffordable on a frontier API.
- **Latency**: ~3–5s per call on Anthropic API vs ~0.5s local on a 450M VLM. 7× speedup matters when you're trying to get an alert out in the first minutes of an event.
- **Bandwidth**: a frontier model lives in a data center on Earth. Putting it behind the satellite means downlinking the whole image (megabytes) to query it. A small in-orbit model downlinks only the JSON.

## Pipeline

The whole fine-tune pipeline is in [`finetune-flood/`](../finetune-flood/). Detailed component docs in [`finetune-flood/docs/`](../finetune-flood/docs/). High level:

```
1. SimSat (Docker)                          [data source]
       │
       │  Sentinel-2 imagery on demand
       ▼
2. generate.ts                              [fetch]
       │
       │  candidate-date sweep at S2 cadence,
       │  pick lowest-cloud, fetch RGB + SWIR
       ▼
3. label_agents.ts → Claude Code agents     [labeling]
       │
       │  pair grouping (baseline → current),
       │  agents read 4 PNGs per pair,
       │  apply schema in prompts.ts,
       │  write annotation.json
       ▼
4. build_dataset.ts                         [packaging]
       │
       │  vlm_sft 4-image JSONL,
       │  temporal train/eval split
       ▼
5. upload_to_modal.ts                       [transport]
       │
       │  push JSONL + image tree to
       │  Modal volume "finetune-flood"
       ▼
6. leap-finetune (Modal H100)               [training]
       │
       │  full fine-tune (not LoRA — vision
       │  projector must relearn satellite
       │  imagery), bf16, ~3 epochs
       ▼
7. pull_checkpoints.ts → package.ts         [deployment]
       │
       │  HF → backbone GGUF + mmproj GGUF,
       │  Q4_0 quantization for size,
       │  llama-server hosts both files
       ▼
8. evaluate.ts                              [validation]
           │
           │  anthropic + llama-server backends,
           │  schema-injected for fair baseline,
           │  dynamic per-run reports
           ▼
       Compare oracle vs base vs fine-tuned
```

### Stage 1 · Data source: SimSat

[`simsat/`](../simsat/) (you clone this yourself, see its README). Docker service that proxies AWS Element84 STAC and serves Sentinel-2 imagery for any (lon, lat, timestamp). Two endpoints we use:

- `/data/image/sentinel?lon=&lat=&timestamp=` — historical imagery for any location/time
- `/data/current/image/sentinel` — current sim position, for live deployment

Sentinel-2 limitation: optical only, ~50% cloud cover in tropical wet seasons. The CopernicusLAC operational pipeline uses Sentinel-1 SAR for La Mojana for exactly this reason. SimSat doesn't expose SAR yet — that's a known limitation of this experiment. See [Findings](#findings--why-the-flood-fine-tune-is-currently-paused).

### Stage 2 · Fetching

[`finetune-flood/src/generate.ts`](../finetune-flood/src/generate.ts) handles per-window fetching:

- **Candidate sweep at Sentinel-2 cadence.** Each event window probes 4 candidate dates spaced ~5 days apart (S2 revisit). Probes run concurrently (4 parallel HTTP calls per window), each grabs only metadata + the cloud_cover field. The lowest-cloud candidate wins.
- **No hard cloud filter.** Filtering tiles >60% cloud loses every wet-season acquisition — exactly when floods happen. Instead, the labeler is expected to set `image_quality_limited=true` on poor tiles and the model learns to abstain.
- **Retry + backoff.** SimSat is bursty; transient connection drops are common. `fetchSentinelWithRetry` does 3 retries with linear backoff before giving up on a single fetch.
- **Concurrency = 2 windows in flight.** 4 parallel probes × 2 in-flight windows = 8 concurrent SimSat hits, which it can sustain. Higher concurrency caused connection drops.

Idempotent: `rgb.png` is the marker. Re-running picks up where it left off.

### Stage 3 · Labeling — Claude Code agents

This is the single decision that diverged most from Pau Labarta Bajo's wildfire example. Pau labels via direct Anthropic API. We dispatch **Claude Code agents** from the conversation:

- `label_agents.ts` scans `data/raw/<run>/` for unlabeled (pre, current) pairs, writes a manifest
- The manifest is sliced into N chunks
- Each chunk goes to a parallel Agent invocation in the conversation
- Each agent reads its 4 PNGs + 2 capture_metadata files per pair (using the Read tool's image support), applies the calibration in [`prompts.ts`](../finetune-flood/src/prompts.ts), writes `annotation.json` to the current tile's directory

Why agents not direct API:
- Cost flows through Claude Code subscription, not Anthropic API budget
- No env/key management
- Visible reasoning per tile (each agent reports back what it labeled)
- Easy parallel dispatch from a single tool call

For production-scale labeling (1000+ samples), switch to direct Anthropic API with `tool_use` enforcement — that path lives in `evaluate.ts:anthropicBackend()`.

### Stage 4 · Schema and the labeling spec

The schema is 7 fields (in `prompts.ts:FLOOD_LABEL_SCHEMA`):

| field | type | what it captures |
|---|---|---|
| `flood_present` | bool | new water on land vs baseline |
| `flood_severity` | none/minor/moderate/severe | <0% / <5% / 5-20% / >20% of land newly inundated |
| `water_coverage_pct_estimate` | <10% / 10-30% / 30-60% / >60% | total water in the current view |
| `populated_area_affected` | bool | new water adjacent to settlements |
| `infrastructure_at_risk` | bool | roads/bridges/buildings inundated or threatened |
| `river_overflow_visible` | bool | river out of its banks vs baseline |
| `image_quality_limited` | bool | cloud cover or partial coverage prevents reliable assessment — abstention signal |

The system prompt explicitly instructs labelers on:
- Color semantics (RGB vs SWIR: water is near-black in SWIR, healthy vegetation is green, dry soil is pink/magenta)
- Change-detection rules ("water on land in current that was dry in baseline = flooding")
- Severity bands anchored on land-area percentages
- Regional context — La Mojana's chronic-wetland baseline, Bajo Putumayo's wide river floodplains, Mocoa's avalancha torrencial mechanism

### Stage 5 · Packaging for training

[`build_dataset.ts`](../finetune-flood/src/build_dataset.ts):
- Walks all annotated tile dirs across all run directories, dedupes by `(location, event, window)`
- Sorts by current-window timestamp, splits temporally — latest 20% to eval. Temporal split prevents Sentinel-2's 2–5 day revisit from leaking near-duplicate tiles across train/eval.
- Mirrors images into a flat `data/images/<location>/<event>/<window>/{baseline,current}/{rgb,swir}.png` tree
- Writes `data/flood_train.jsonl` + `data/flood_eval.jsonl` in `vlm_sft` format, four image content blocks per row in baseline-then-current order:

```json
{"messages":[
  {"role":"user","content":[
    {"type":"image","image":"images/<loc>/<event>/<window>/baseline/rgb.png"},
    {"type":"image","image":"images/<loc>/<event>/<window>/baseline/swir.png"},
    {"type":"image","image":"images/<loc>/<event>/<window>/current/rgb.png"},
    {"type":"image","image":"images/<loc>/<event>/<window>/current/swir.png"},
    {"type":"text","text":"Label this tile pair..."}
  ]},
  {"role":"assistant","content":[{"type":"text","text":"{...labels JSON...}"}]}
]}
```

### Stage 6 · Training on Modal

`leap-finetune` is Liquid AI's open-source library for fine-tuning LFM models. We point it at our config (`configs/flood_modal.yaml`). Modal H100, ~3 epochs, ~30–60 min wall time.

Key choice: **full fine-tune, not LoRA** (`use_peft: false`). Pau's experience: satellite multispectral imagery is severely underrepresented in the base VLM's pretraining mix, so the multimodal projector has to genuinely re-learn how to map these tiles into useful tokens. LoRA on a frozen projector isn't enough. At 450M parameters, full FT fits on a single H100.

### Stage 7 · Quantize and serve

`package.ts` produces both pieces a VLM needs for inference:
- backbone GGUF (Q4_0 quantization, ~210 MB)
- mmproj GGUF (vision tower + projector, F16, ~50 MB)

Together: ~260 MB. Small enough for a CubeSat node. Hosted via `llama-server`:

```bash
llama-server -m backbone.gguf --mmproj mmproj.gguf -c 8192 --port 8765
```

OpenAI-compatible chat completions API. Same wire format as Anthropic's, so the inference client doesn't care if it's talking to Claude or our local model.

### Stage 8 · Evaluation

Two backends in [`evaluate.ts`](../finetune-flood/src/evaluate.ts):

- **Anthropic backend** — `tool_use` with the schema as `input_schema`. The model is *forced* to emit our 7 fields. Used for oracle/self-consistency checks.
- **Local backend (llama-server)** — OpenAI-compatible `/v1/chat/completions`. Critically, this backend **also gets the schema**: we inject it into the user prompt and use llama-cpp's `response_format: {type: 'json_schema', ...}` for grammar-constrained generation. Without that injection the base model improvises key names and scores 0/7 — see [Findings](#findings--why-the-flood-fine-tune-is-currently-paused).

Each eval run writes a fresh `evals/<timestamp>/`:
- `meta.json` — run config + aggregated metrics
- `results.json` — per-sample records (id, ground_truth, prediction, latency, per-field match)
- `report.md` — per-run human-readable report including top-disagreed fields and worst samples with image paths

`deno task eval:compare` builds a side-by-side accuracy table across runs.

## Findings — why the flood fine-tune is currently paused

We built the pipeline end-to-end, labeled 115 pair samples across 9 La Mojana / Putumayo events, ran the eval, and **decided not to fine-tune the flood model with this data**. Three reasons:

1. **Sentinel-2 alone is the wrong tool for La Mojana.** ~50% of acquisitions in the wet season are >50% cloud. Operational systems use Sentinel-1 SAR (cloud-independent) for this exact reason.
2. **Labeler noise floor caps achievable accuracy.** Opus self-consistency on subjective enums (`flood_severity`, `water_coverage_pct_estimate`) is 0.43–0.70. The student model cannot exceed inter-labeler agreement. So the practical fine-tune ceiling is ~0.66 overall — not enough for an operational alert system.
3. **Sentinel-2 cadence misses peak events.** The May 2024 Cara de Gato breach: closest cloud-tolerable Sentinel-2 acquisitions were 9 days before or 16 days after, both heavily clouded. The training data is temporally adjacent to events but doesn't capture them.

The full report is at [`finetune-flood/REPORT.md`](../finetune-flood/REPORT.md).

The code is reusable. For a re-attempt with Sentinel-1 SAR (cloud-independent), only `simsat.ts` (data source) and the band selection in `simsat.ts:BAND_COMBOS` change. Everything else — orchestration, pair labeling, evals, packaging — transfers.

---

# Part 2 · Community station + sync layer

The community station is the on-ground node that bridges the satellite alert with the local app. It's deliberately low-spec: Raspberry Pi class, runs on solar or a small battery, sits in a school, clinic, or town hall.

## Functions

1. **Receive alerts.** A satellite pass (or any low-bandwidth ground link) delivers the JSON payload to the station. The transport layer is intentionally pluggable — could be satcom, LoRaWAN, mesh radio, an intermittent cell connection, an SD card driven over by a courier. The protocol is whatever delivers ~200-byte payloads.

2. **Threshold and dispatch.** Not every JSON alert triggers an emergency notification. The station has a local rule set: "if `flood_present=true AND populated_area_affected=true AND not image_quality_limited`, push `severe` notifications to the local app." Rules are editable per-region.

3. **Host the synced knowledge base.** The station serves a static-site-class HTTP endpoint over its local network (no internet needed). The local app talks to it.

4. **Sync the knowledge base when internet is available.** Whenever the station has a connection (after the storm, when batteries are recharging, during routine maintenance), it pulls the latest knowledge-base snapshot from the project's central repo. Between events, the station is mostly idle.

## Status

Not yet built. The skeleton in `knowledge-base/` is a placeholder for content; the station daemon is unwritten.

---

# Part 3 · Local app (desktop / mobile)

The thing the human actually uses during a crisis.

## Functions

1. **Pre-syncs the knowledge base** from the community station whenever it has LAN access to the station.
2. **Lives offline** during the event. No assumption that the network exists.
3. **Receives alert pushes** from the station over the LAN.
4. **Personalizes by role.** A community leader sees triage/shelter coordination and SOPs for declaring local emergency. A farmer sees livestock evacuation and cropland actions. A parent sees school evacuation, child-specific protocols, contact list for the school director. A first responder sees the technical SOP and the chain of command. Same data, filtered.
5. **Surfaces local history.** Past incidents at *this exact location* — what worked, what failed, who was the local point of contact, where the emergency shelter was set up. Sourced from a curated history corpus, not from rumor.

## Status

Not built. Open design questions:

- Desktop framework: Tauri (small, Rust, good offline story) vs Electron (larger, JS, more familiar). Leaning Tauri.
- Mobile: Flutter or React Native. Flutter has better offline-first stories.
- Knowledge-base format: Markdown + frontmatter, indexed by `(location, role, event_type)`.
- Sync mechanism: HTTP fetch with content-addressed caching (CAS) so partial updates work over flaky connections.

---

# Part 4 · Knowledge base

The corpus that makes the local app useful. Content, not code.

## What goes in

| Layer | Examples |
|---|---|
| **Procedures** | "If flood alert level = severe, do X. If you are within Y km of the riverbank, do Z." Step-by-step SOPs by role. |
| **Maps** | Static maps of evacuation routes, designated shelters, hospitals, water-distribution points. Ideally vector tiles, served offline. |
| **Contacts** | Local first responders, regional coordinators, military, hospital admin. Phone numbers, radio frequencies, languages spoken. |
| **History** | Past incidents at this location: dates, severity, what worked, what failed. Helps avoid repeating mistakes. |
| **Role profiles** | Each user has a profile (community leader, farmer, parent, teacher, responder). The profile filters which procedures, contacts, and maps surface first. |

## Format

Plain-text Markdown with YAML frontmatter, one file per "chunk":

```markdown
---
location: san_jacinto_del_cauca
event_type: flood
roles: [community_leader, first_responder]
languages: [es, none]
severity: ["moderate", "severe"]
priority: 1
last_reviewed: 2026-04-15
---

# Activate Cara de Gato emergency protocol

If you are the community leader on duty when a Cara de Gato breach alert arrives:

1. Confirm via secondary signal (river level gauge at ...)
2. Sound the alarm at ...
3. Shelter assignments:
   - Barrio A → escuela primaria
   - Barrio B → iglesia central
   ...
```

Each chunk is independently syncable, content-addressed, and indexed by `(location, role, event_type, severity)`.

## Status

Not yet built — only the empty `knowledge-base/` skeleton exists.

---

# Part 5 · Cross-cutting concerns

## Languages

Colombia's affected regions speak Spanish and several indigenous languages (Embera, Siona, Inga, Kichwa). Procedures must be available in the operating language of the community. The knowledge base supports per-chunk language tagging; the local app filters by user-profile language.

## Disability and literacy

Some users won't read text. The local app must support audio-first content (voice playback of procedures). Sign-language video clips for deaf community members. Large-text mode and high-contrast mode for older users.

## Trust and authority

Procedures must be **authored** by a credible source (UNGRD, OCHA, regional defensa civil, named local responders). The frontmatter records authorship. The app shows it. People won't follow instructions from an unaccountable source during a crisis.

## Privacy

User profiles (role, location, language) live on the device only. They never sync upstream. No telemetry by default.

## Update cadence

The knowledge base updates infrequently — weeks to months — not in real time. Real time updates are alerts. The system's superpower is that it works without real-time anything.

---

# Status snapshot

| Component | Status |
|---|---|
| Satellite-resident detection model | **Pipeline built, fine-tune paused.** Code reusable; needs Sentinel-1 SAR data source. |
| Community station + sync layer | Not built. |
| Local app (desktop / mobile) | Not built. Design questions open. |
| Knowledge-base format + content | Skeleton only. |
| Role/profile system | Not built. |

The most reusable artifacts right now are:

- The Deno/TS orchestration in [`finetune-flood/`](../finetune-flood/) — usable for any pair-based VLM fine-tune
- The eval pipeline (`evaluate.ts` + dynamic per-run reports) — usable as-is for any structured-output VLM project
- The Ollama publishing path documented in [`dev_notes/ollama-publishing.md`](dev_notes/ollama-publishing.md)
