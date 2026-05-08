# humaid · Architecture

This document describes the humaid system end-to-end. humaid is built around **two distinct AI systems** running in two very different physical contexts, glued together by a community ground station and a desktop app:

| | runs on | runtime | model | context |
|---|---|---|---|---|
| **Flood detector** | satellite (CubeSat-class compute) | **llama.cpp** (`llama-server`) | LFM2.5-VL-450M fine-tune (vision) | one inference per orbit pass over a watched area; output is ~200 bytes JSON downlinked |
| **Knowledge-base assistant** | responder / volunteer laptop | **Ollama** | LFM2 (text-only) + `nomic-embed-text` for retrieval | runs offline at the user's side; surfaces what to do *given* an alert + a role |

**They use different runtimes on purpose.** llama.cpp is the only option for the satellite side because LFM2-VL needs the multimodal projector (`mmproj`) that Ollama can't load yet. Ollama is the right choice for the laptop side because it gives non-technical users a one-command install (`brew install ollama`), a stable HTTP server, and works the same on macOS/Linux/Windows. Don't conflate them.

The **client app** (single Tauri codebase, ships as a desktop binary on macOS/Linux/Windows and as an Android APK/AAB) is what the responder actually opens. On desktop it talks to a local Ollama for the KB. On Android it falls back to the website's `/api/qa` endpoint for chat (no local Ollama on phones) but still serves the KB browser fully offline from an embedded `kb.duckdb`. Both targets poll the website's alert endpoint and listen for pushes from a **community station** over the local network where one exists.

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
5. **The model that surfaces response knowledge has to run on whatever laptop the responder showed up with.** That's a CPU-only Ollama install — no GPU assumed. On a phone, where running a local model isn't realistic, the Android client degrades gracefully: KB browsing stays offline (the index is on-device); chat falls back to the website's hosted retrieval endpoint when there's a network.

```
                                          SPACE
                              ┌─────────────────────────────────┐
                              │ FLOOD DETECTOR                  │
                              │ llama-server + LFM2.5-VL-450M   │
                              │ fine-tune  (vision, ~245 MB)    │
                              │   image pair  →  JSON payload   │
                              └──────────────┬──────────────────┘
                                             │ ~200 bytes
                                             │ low-bandwidth ground link
                                             ▼
            ┌─────────────────────────── EARTH ─────────────────────────────┐
            │                                                               │
            │  ┌─────────────┐   ┌──────────────────┐   ┌────────────────┐  │
            │  │  humaid     │   │ Community        │   │ Client app     │  │
            │  │  website    │──▶│ station (LAN)    │──▶│ (Tauri)        │  │
            │  │  /api/      │   │  · thresholds    │   │                │  │
            │  │  alerts     │   │  · pushes alerts │   │  desktop       │  │
            │  │             │   │    over LAN/SSE  │   │  ──────────    │  │
            │  │  publishes  │   │  · serves KB     │   │  Ollama daemon │  │
            │  │  JSON       │───│    snapshot      │   │   + LFM2       │  │
            │  │  alerts     │ ◄─┴──────────────────┘   │   + nomic      │  │
            │  │  + KB       │   polled directly        │  KB browser,   │  │
            │  │  versions   │   when no station        │  chat, alerts  │  │
            │  └─────────────┘                          │                │  │
            │         ▲                                 │  Android       │  │
            │         │ also polls /api/alerts          │  ──────────    │  │
            │         └─────────────────────────────────│  embedded KB,  │  │
            │                                           │  /api/qa fall- │  │
            │                                           │  back for chat │  │
            │                                           └────────────────┘  │
            │                                                               │
            └───────────────────────────────────────────────────────────────┘
```

---

# Part 0 · System anatomy — three models, two runtimes, one index

Before walking the parts in detail, here's the runtime inventory.

## The three models

| Model | Size | Role | Why this one |
|---|---|---|---|
| **LFM2.5-VL-450M** (Liquid AI, vision) | ~450 MB → 245 MB Q4_0 GGUF + 50 MB mmproj | Satellite-side flood detection. 4 PNGs in (RGB + SWIR, baseline + current) → 7-key JSON out. | Small enough for CubeSat compute (5 W). Open-weights. We fine-tuned it on La Mojana / Putumayo events; weights at [`jpmarindiaz/lfm2-flood`](https://huggingface.co/jpmarindiaz/lfm2-flood), training data at [`jpmarindiaz/flood-detection-pair-colombia`](https://huggingface.co/datasets/jpmarindiaz/flood-detection-pair-colombia). |
| **LFM2** (Liquid AI, text) | ~1.2B class | Laptop-side answer synthesis (optional v1). Takes top-k retrieved Q&A and writes a single natural-language reply. | Same family as the satellite VLM. CPU-only inference. |
| **nomic-embed-text** (Nomic) | 137M, 768-dim, multilingual | Embeds Q&A questions and user queries for cosine retrieval. | Multilingual matters (EN + ES + indigenous overlay later). Runs locally in Ollama. |

## The two runtimes

```
SATELLITE          ·  llama.cpp / llama-server
                   ·  the only runtime that loads LFM2-VL's mmproj (vision projector)
                   ·  OpenAI-compatible API on a local port; tiny, no daemon overhead

LAPTOP / STATION   ·  Ollama
                   ·  one-binary install for non-technical users (brew / .deb / .msi)
                   ·  one daemon hosts BOTH LFM2 (generation) and nomic-embed-text
                   ·  text-only path → mmproj limitation doesn't matter
```

Same architectural premise underneath — local + small + grounded — different runtime per physical context.

## The one index — DuckDB

`knowledge-base/kb.duckdb` (~2.9 MB, committed to repo). 589 rows of bilingual Q&A — 471 humanitarian-response pairs (`phase` ∈ `pre` / `event` / `post`) + 118 project-meta pairs (`phase = meta`, "what is humaid?") — with the 768-dim Nomic embedding stored inline as `FLOAT[768]`. Cosine search is a single SQL expression:

```sql
SELECT id, role, phase, region, question_en, answer_en, …
FROM qa
WHERE role = $user_role AND region IN ('generic', $user_region)
ORDER BY array_cosine_similarity(embedding, $query_vec) DESC
LIMIT $k;
```

No vector database, no server, no cloud — DuckDB does the math in-process. Same file ships in the website bundle (`website/data/kb.duckdb`) and in the Tauri client (embedded via `include_bytes!` for Android, read directly from the bundle on desktop).

`qa` table schema:

```
id   role   phase   region   topic   question_en/es   answer_en/es
     references   ref_types   embedding FLOAT[768]
```

## On-device RAG flow

```
user query (EN or ES)
        │
        ▼
[ Ollama : nomic-embed-text ]  →  768-dim vector
        │
        ▼
[ DuckDB cosine : kb.duckdb ]
   WHERE role IN ('any', user.role)
   AND   region IN ('generic', user.region)
   AND   phase  IN ('pre','event','post')   -- or 'meta' for "what is humaid?"
        │
        ▼
top-k Q&A rows  →  shown directly  (v1)
        │                              ──or──
        ▼
[ Ollama : LFM2 text ]          →  synthesised answer with citations  (v2)
```

Everything in this loop is on-device. No outbound traffic to a third-party API, ever. (The Android client is the one exception — it falls back to the website's `/api/qa` endpoint for chat because it can't host Ollama. That endpoint runs the same retrieval code server-side, against the same `kb.duckdb`.)

## The build pipelines that feed it (dev-time, not on-device)

These are the offline pipelines that produce the model weights and the KB index. End users never run them — they just consume the artifacts.

**Flood model:**

```
SimSat (Docker) → generate.ts (S2 fetch) → label-agents (Claude Code)
   → build_dataset.ts → upload_to_modal.ts → leap-finetune on Modal H100
   → pull_checkpoints.ts → package.ts (Q4_0 GGUF + mmproj)
   → llama-server
```

Detail: Parts 1.1–1.8 below, plus [`finetune-flood/PLAYBOOK.md`](../finetune-flood/PLAYBOOK.md).

**Knowledge base:**

```
17 source PDFs → ds_to_markdown → 6 parallel role-agents
   → per-role CSV chunks → merge.ts (471 humanitarian)
   + project-qa/generate.ts (118 project-meta)
   → rag/build.ts (embed via Ollama, write DuckDB)
   → kb.duckdb
```

Detail: [`knowledge-base/README.md`](../knowledge-base/README.md) and [`knowledge-base/rag/README.md`](../knowledge-base/rag/README.md).

## The single line that ties it all

> Onboard inference ships answers, not images. Local retrieval grounds those answers in real PDFs. Two runtimes — llama.cpp in orbit, Ollama on the ground — because the physics is different, but the premise is the same: small, local, grounded. The cloud is never in the data path.

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

# Part 2 · The knowledge-base AI system (laptop side, Ollama)

This is the second AI system, distinct from the satellite-side flood detector. It runs on the responder's laptop after they've reached the affected area, and lets them ask the corpus things they need to act on.

## What it does

Free-form Q&A over a curated corpus of disaster-response procedures, filtered by the user's role (first responder, humanitarian staff, local authority, local community member, national authority, NGO). Examples:

- "How do I evacuate Barrio Miraflores when the river rises overnight?"
- "¿Qué hago durante un paro armado en Putumayo?"
- "What protocols apply for a Cara de Gato breach if I'm a community leader?"

Returns the relevant SOPs / Q&A pairs from the local index plus (eventually) a synthesized natural-language answer.

## Stack

| Component | What | Where |
|---|---|---|
| Generation model | LFM2 text (~1.2B class — sized for CPU-only laptops) | local Ollama daemon |
| Embedding model | `nomic-embed-text` (768-dim, multilingual) | local Ollama daemon |
| Index | DuckDB file (`knowledge-base/kb.duckdb`, ~2.3 MB, committed) | on disk |
| Corpus | 589 Q&A pairs (471 humanitarian in `knowledge-base/qa-pairs.csv` + 118 project-meta from `knowledge-base/project-qa/`) | on disk |
| Retrieval CLI | `cd knowledge-base && deno task ask "<question>"` | local |

**Why Ollama here, when the satellite side uses llama.cpp.** The KB stack is text-only — no vision, no `mmproj` — so Ollama's main limitation doesn't apply. Ollama is a single-binary install for non-technical users (`brew install ollama`, Windows installer, .deb package), it gives a stable HTTP server, and the same daemon can host both the generation model and the embedding model. The desktop user installs Ollama once and the app talks to it via `http://localhost:11434`. None of that fits the satellite (no operator to install anything, vision-only model, can't run Ollama for a VLM).

## Today's state

Implemented under [`knowledge-base/`](../knowledge-base/):

- 471 humanitarian Q&A pairs across 6 roles (first responder, humanitarian staff, local authority, local community, national authorities, NGOs), tagged by phase (`pre`/`event`/`post`) and region (La Mojana / Putumayo)
- 118 project-meta Q&A pairs (phase = `meta`) about humaid itself — "what is humaid?", "who do I contact?", etc. — generated by `knowledge-base/project-qa/`
- All 589 pairs + the prebuilt DuckDB index published publicly at [`jpmarindiaz/humaid-kb-colombia`](https://huggingface.co/datasets/jpmarindiaz/humaid-kb-colombia) (CC-BY-4.0)
- `rag/` — Deno-based retrieval: embeds with Nomic via Ollama, stores in DuckDB, cosine search
- `kb.duckdb` (2.3 MB) committed so consumers don't have to rebuild the index

Run it locally:

```bash
ollama pull nomic-embed-text       # one-time
cd knowledge-base
deno task ask "How do I evacuate when the river rises overnight?" --text --k 3
```

What's still to build: a generation step on top of retrieval (CLI currently returns top-k matches; doesn't yet synthesize a single answer), per-role profile filtering wired into the runtime, and a way to sync new chunks from a community station.

---

# Part 3 · Community station + sync layer

The on-ground node that bridges the satellite alert with the desktop app. Deliberately low-spec: Raspberry Pi class, runs on solar or a small battery, sits in a school, clinic, or town hall.

## Functions

1. **Receive alerts.** A satellite pass (or any low-bandwidth ground link) delivers the JSON payload to the station. The transport layer is intentionally pluggable — could be satcom, LoRaWAN, mesh radio, an intermittent cell connection, an SD card driven over by a courier. The protocol is whatever delivers ~200-byte payloads.

2. **Threshold and dispatch.** Not every JSON alert triggers an emergency notification. The station has a local rule set: "if `flood_present=true AND populated_area_affected=true AND not image_quality_limited`, push `severe` notifications to the desktop app over the LAN." Rules are editable per-region.

3. **Host the synced knowledge base.** The station serves a static-site-class HTTP endpoint over its local network (no internet needed). Desktop apps on the LAN pull KB updates from it.

4. **Sync the knowledge base when internet is available.** Whenever the station has a connection (after the storm, when batteries are recharging, during routine maintenance), it pulls the latest knowledge-base snapshot from the project's central repo. Between events, the station is mostly idle.

## Status

Not yet built. The data side (`knowledge-base/`) is in place; the station daemon — which would tie alert reception, threshold rules, and KB hosting together — is unwritten.

---

# Part 4 · Client apps (desktop + Android)

What the responder actually opens. Single Tauri codebase targeting two form factors:

- **Desktop** (macOS / Linux / Windows) — the primary client, lives on a laptop in the affected area.
- **Android** — same Rust core + same web UI, packaged for phones. Same code, different runtime constraints.

See [`tauri/README.md`](../tauri/README.md) for the implementation brief.

## Functions

1. **Pre-syncs the knowledge base** from the community station whenever it has LAN access to the station, or pulls directly from the central repo when the user has internet between events.
2. **Polls for alerts** from the website (and listens for pushes from the community station over the LAN, where applicable). When a flood alert arrives that exceeds the threshold for their region, surfaces an OS-native notification with the relevant procedures pre-fetched from the local KB.
3. **Personalizes by role.** A community leader sees triage / shelter coordination and SOPs for declaring local emergency. A farmer sees livestock evacuation and cropland actions. A parent sees school evacuation, child-specific protocols, contact list for the school director. A first responder sees the technical SOP and the chain of command. Same KB, filtered.
4. **Surfaces local history.** Past incidents at *this exact location* — what worked, what failed, who was the local point of contact, where the emergency shelter was set up. Sourced from a curated history corpus, not from rumor.
5. **Lives offline (desktop).** All inference and retrieval happen against the local DuckDB index and the local Ollama daemon. No assumption the network exists during the event.

## Shared stack (desktop + Android)

- **Framework:** Tauri 2.x. Single Rust core in `src-tauri/`, single web UI (React + Vite). Mobile target reuses ~95 % of the same code.
- **State:** local SQLite for user profile, role, region, sync cursor, alert history.
- **KB index:** the bundled `kb.duckdb` (~2.3 MB) — read via the Rust `duckdb` crate. On Android the file is embedded with `include_bytes!` and staged to `app_data_dir()` on first launch so `std::fs` and `duckdb` see a normal path.
- **Knowledge-base format:** Markdown + YAML frontmatter for SOPs, indexed by `(location, role, event_type)`. Q&A pairs already in CSV + DuckDB.
- **Sync mechanism:** HTTP fetch against the website (`/api/kb/version` + `/api/kb/download`) with content-addressed caching so partial updates work over flaky connections.
- **Alert intake:** polling against `GET /api/alerts?region=&since=` (canonical), plus SSE / mDNS pushes from a community station on the LAN where one exists.

## Desktop-specific bits

- **Inference runtime:** local Ollama daemon at `http://localhost:11434`, hosting `nomic-embed-text` (always) and `lfm2` text (optional, for synthesis). Tauri spawns/supervises the daemon as a sidecar.
- Why Ollama on desktop: see Part 2 — text-only stack, single-binary install for non-technical users, host both models on one daemon.

## Android-specific bits

- **No Ollama on Android.** Mobile platforms can't realistically supervise a long-running model daemon. The `qa_search` command tries the local Ollama daemon first (in case the user is on a tablet that has one) and **transparently falls back to `POST https://humaid.app/api/qa`** — same retrieval engine, server-side. Net effect for the user: KB browsing and document reading work fully offline (the index is on-device); chat needs a network connection.
- **Resources embedded, not bundled.** `kb.duckdb` and the `research/*.md` corpus are baked into the Rust binary via `include_bytes!` / `include_dir!` (sidesteps Android's AssetManager) and staged to app-data on first launch.
- **Mobile UI.** Layouts collapse to single-column with a bottom tab bar at `<768px`; list/detail views push-stack with a back arrow.
- **Notifications.** `tauri-plugin-notification`. Android prompts for the runtime `POST_NOTIFICATIONS` permission on first alert.

## Status

Tauri scaffolding live in [`tauri/`](../tauri/). The Tauri team is iterating on both targets in parallel — same Rust + React tree, two `tauri (android) dev` invocations during development. Outstanding work: alert-polling client wired to the `/api/alerts` endpoint (which the website team is building, see [`website/docs/SIMULATOR.md`](../website/docs/SIMULATOR.md)), KB sync against `/api/kb/version`, role / region picker UI on first launch, and a packaging story for the desktop sidecar Ollama daemon.

---

# Part 5 · Knowledge base content

The corpus that makes the desktop app useful. Content, not code.

## What's in it

| Layer | Examples |
|---|---|
| **Procedures (Q&A)** | 589 role-tagged Q&A pairs (471 humanitarian + 118 project-meta), indexed by Nomic embeddings in DuckDB. *Already in repo.* |
| **Procedures (SOPs)** | (Planned) Step-by-step SOPs by role: "If flood alert level = severe, do X. If you are within Y km of the riverbank, do Z." Markdown chunks. |
| **Maps** | (Planned) Static maps of evacuation routes, designated shelters, hospitals, water-distribution points. Ideally vector tiles, served offline. |
| **Contacts** | (Planned) Local first responders, regional coordinators, military, hospital admin. Phone numbers, radio frequencies, languages spoken. |
| **History** | (Planned) Past incidents at this location: dates, severity, what worked, what failed. Helps avoid repeating mistakes. |
| **Role profiles** | Each user has a profile (community leader, farmer, parent, teacher, responder). The profile filters which procedures, contacts, and maps surface first. Schema is in place; UI not yet. |

## Format

Source data for the implemented Q&A layer is `knowledge-base/qa-pairs.csv`; the schema is documented in [`knowledge-base/README.md`](../knowledge-base/README.md). Each row carries `role`, `phase`, `region`, `topic` tags. The DuckDB index (`kb.duckdb`) holds the precomputed Nomic embeddings so retrieval is one cosine query against an in-process database — no network, no cold start.

For chunked SOPs (planned, more structured than Q&A), the format will be Markdown with YAML frontmatter, one file per chunk:

```markdown
---
location: san_jacinto_del_cauca
event_type: flood
roles: [community_leader, first_responder]
languages: [es, embera]
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

Q&A corpus done (589 pairs total — 471 humanitarian × 6 roles × 3 phases, plus 118 project-meta). Markdown SOPs not yet written. The desktop-app side that surfaces these to users is not built.

---

# Part 6 · Cross-cutting concerns

## Languages

Colombia's affected regions speak Spanish and several indigenous languages (Embera, Siona, Inga, Kichwa). Procedures must be available in the operating language of the community. The knowledge base supports per-chunk language tagging; the desktop app filters by user-profile language.

## Disability and literacy

Some users won't read text. The desktop app must support audio-first content (voice playback of procedures). Sign-language video clips for deaf community members. Large-text mode and high-contrast mode for older users.

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
| **Flood detector** (System A — satellite, llama.cpp) | Pipeline built end-to-end, model fine-tuned, both published to HF Hub. Operational fine-tune paused pending Sentinel-1 SAR data source. |
| **Knowledge-base assistant** (System B — laptop, Ollama) | Retrieval working: 589 Q&A pairs (471 humanitarian + 118 project-meta) indexed in DuckDB via Nomic embeddings. Generation step on top of retrieval not yet wired. |
| Community station + sync layer | Not built. |
| Client app — desktop (Tauri, macOS/Linux/Windows) | In progress. Tauri shell scaffolded; KB browser + chat working against local Ollama. Alert polling pending the website's `/api/alerts` endpoint. |
| Client app — Android (same Tauri codebase) | In progress. Same shell, runs on emulator + device. KB embedded via `include_bytes!`; chat falls back to website `/api/qa` since Android can't host Ollama. |
| Website alert simulator + `/api/alerts` | Not built. Spec in [`website/docs/SIMULATOR.md`](../website/docs/SIMULATOR.md). |
| Knowledge-base SOP content (Markdown chunks) | Not started. |
| Role/profile UI | Schema in place, UI not built. |

The most reusable artifacts right now are:

- The Deno/TS orchestration in [`finetune-flood/`](../finetune-flood/) — usable for any pair-based VLM fine-tune
- The eval pipeline (`evaluate.ts` + dynamic per-run reports) — usable as-is for any structured-output VLM project
- The Ollama-based retrieval layer in [`knowledge-base/rag/`](../knowledge-base/rag/) — usable as-is for any role-tagged Q&A corpus
- The Ollama publishing path documented in [`dev_notes/ollama-publishing.md`](dev_notes/ollama-publishing.md)
