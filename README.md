# humaid

**Offline-first humanitarian-response toolkit for flood crises.**

When a flood hits a remote community, two things break at once: the people on the ground need fast, specific information about *what to do* — and the internet that would normally deliver that information goes down with the power and the cell towers. humaid pre-syncs the response knowledge before the crisis, generates the alert from space, and runs the whole thing without a network once it's in your hands.

> **TL;DR.** Onboard inference ships answers, not images. Local retrieval grounds those answers in real PDFs. Two runtimes — llama.cpp in orbit, Ollama on the ground — because the physics is different, but the premise is the same: small, local, grounded. The cloud is never in the data path.

## Published on HuggingFace 🤗

Everything we built that's reusable outside this repo is public:

| Artifact | Repo | What |
|---|---|---|
| **Fine-tuned flood model** | [`jpmarindiaz/lfm2-flood`](https://huggingface.co/jpmarindiaz/lfm2-flood) | LFM2.5-VL-450M fine-tuned for 4-image flood detection. Q4_0 GGUF + F16 mmproj + merged HF checkpoint. |
| **Flood-detection training data** | [`jpmarindiaz/flood-detection-pair-colombia`](https://huggingface.co/datasets/jpmarindiaz/flood-detection-pair-colombia) | 88 train + 22 eval 4-image (RGB+SWIR baseline / current) pair samples across 9 La Mojana / Putumayo flood events, with the 7-key JSON labels. |
| **Knowledge-base Q&A** | [`jpmarindiaz/humaid-kb-colombia`](https://huggingface.co/datasets/jpmarindiaz/humaid-kb-colombia) | 589 bilingual (EN+ES) role-tagged Q&A pairs — 471 humanitarian + 118 project-meta — plus the prebuilt DuckDB index with Nomic embeddings inline. |

## Three models, two runtimes, one index

The heart of the system is three small, open-weights models, each picked for a specific job:

| Model | Size | Role | Why this one |
|---|---|---|---|
| **LFM2.5-VL-450M** (Liquid AI, vision) | ~450 MB → 245 MB Q4_0 GGUF + 50 MB mmproj | Satellite-side flood detection. 4 PNGs in (RGB + SWIR, baseline + current) → 7-key JSON out. | Small enough for CubeSat compute (5 W). Open-weights. Fine-tuned by us on La Mojana / Putumayo; published as [`jpmarindiaz/lfm2-flood`](https://huggingface.co/jpmarindiaz/lfm2-flood). |
| **LFM2** (Liquid AI, text) | ~1.2B class | Laptop-side answer synthesis (optional v1). Takes top-k retrieved Q&A and writes a single natural-language reply. | Same family as the satellite VLM. CPU-only inference. |
| **nomic-embed-text** (Nomic) | 137M, 768-dim, multilingual | Embeds Q&A questions and user queries for cosine retrieval. | Multilingual matters (EN + ES + indigenous overlay later). Runs locally in Ollama. |

The two runtimes follow from where the models physically live:

```
SATELLITE          ·  llama.cpp / llama-server
                   ·  the only runtime that loads LFM2-VL's mmproj (vision projector)
                   ·  OpenAI-compatible API on a local port; tiny, no daemon overhead

LAPTOP / STATION   ·  Ollama
                   ·  one-binary install for non-technical users (brew / .deb / .msi)
                   ·  one daemon hosts BOTH LFM2 (generation) and nomic-embed-text
                   ·  text-only path → mmproj limitation doesn't matter
```

Same architectural premise underneath — local + small + grounded — different runtime per physical context. **Don't conflate them.**

Retrieval lives in **one DuckDB file** (`knowledge-base/kb.duckdb`, ~2.9 MB, committed). 589 rows of bilingual Q&A — 471 humanitarian-response pairs (phase = `pre` / `event` / `post`) + 118 project-meta pairs (phase = `meta`, "what is humaid?") — with the 768-dim Nomic embedding stored inline as `FLOAT[768]`. Cosine search is a single SQL expression: `array_cosine_similarity(embedding, $query_vec) ORDER BY 1 DESC LIMIT k`. No vector database, no server, no cloud — DuckDB does the math in-process. Same file ships in the website bundle and in the Tauri client.

For the full data-flow diagram and the dev-time build pipelines that produce these artifacts, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What we're building

```
                                   SPACE
                       ┌─────────────────────────────┐
                       │ FLOOD DETECTOR              │
                       │ llama-server + LFM2.5-VL    │
                       │ fine-tune (~245 MB)         │
                       │   image pair → JSON alert   │
                       └──────────────┬──────────────┘
                                      │ ~200 bytes
                                      │ (low-bandwidth ground link)
                                      ▼
            ┌──────────────────────── EARTH ───────────────────────────┐
            │                                                          │
            │  ┌────────────────┐         ┌────────────────────────┐   │
            │  │ Community      │         │ Desktop app            │   │
            │  │ station        │ ◄─LAN─► │  - listens for alerts  │   │
            │  │ (sync hub)     │ offline │  - talks to local      │   │
            │  │                │         │    Ollama              │   │
            │  │ - receives     │         │                        │   │
            │  │   alerts       │         │ KB ASSISTANT (Ollama)  │   │
            │  │ - serves KB    │         │  + LFM2 (text)         │   │
            │  │   to laptops   │         │  + nomic-embed-text    │   │
            │  │   on LAN       │         │  + DuckDB index ~2.9MB │   │
            │  │                │         │  + 589 role-tagged Q&A │   │
            │  └────────────────┘         └────────────────────────┘   │
            │                                                          │
            └──────────────────────────────────────────────────────────┘
```

Four components, each at a different maturity:

1. **Flood-detection model (System A)** — small VLM that turns multispectral satellite imagery into a structured JSON alert. Cheap enough to run on a CubeSat, small enough to downlink only the JSON not the imagery. *Status: end-to-end pipeline built, model fine-tuned, both **weights** ([`jpmarindiaz/lfm2-flood`](https://huggingface.co/jpmarindiaz/lfm2-flood)) and **training dataset** ([`jpmarindiaz/flood-detection-pair-colombia`](https://huggingface.co/datasets/jpmarindiaz/flood-detection-pair-colombia)) published publicly on HF Hub. Operational fine-tune paused pending Sentinel-1 SAR — see [`finetune-flood/REPORT.md`](finetune-flood/REPORT.md).*

2. **Knowledge-base assistant (System B)** — Ollama-hosted LFM2 (text) + `nomic-embed-text` for retrieval over a curated, role-tagged Q&A corpus. Runs locally on the responder's laptop, fully offline. *Status: 589 Q&A pairs (471 humanitarian + 118 project-meta) indexed in DuckDB; retrieval working; generation step on top of retrieval not yet wired. **Dataset published publicly** at [`jpmarindiaz/humaid-kb-colombia`](https://huggingface.co/datasets/jpmarindiaz/humaid-kb-colombia). See [`knowledge-base/`](knowledge-base/).*

3. **Community station + sync layer** — low-power node (Raspberry Pi class) at a school, clinic, or town hall. Receives JSON alert payloads from the satellite link, pushes thresholded notifications to desktop apps on the LAN, and hosts the synced knowledge base. *Status: not yet built.*

4. **Client app — desktop + Android.** Single Tauri codebase that ships as a desktop binary (macOS / Linux / Windows) and as an Android APK. Pre-synced with the KB before the crisis, polls the website for alerts, personalizes by user role (community leader, farmer, parent, first responder, school director, NGO worker). Desktop hosts a local Ollama for chat; Android falls back to the website's `/api/qa` endpoint when chatting (KB browser stays fully offline either way). *Status: in progress — see [`tauri/`](tauri/).*

## Why offline-first

In a flood:
- Cell towers go down with the power
- Internet is intermittent at best, gone at worst
- Roads are cut — no way to deliver instructions on paper
- Outside responders take hours to days to arrive
- The first 6 hours are when most actionable decisions get made by **people already in the affected area**

So the design constraint is: **everything must work offline**, with knowledge that was synced *before* the event happened. The satellite alert is the trigger; the response runs on what's already on the device.

## Why on-satellite inference

Sending raw satellite imagery to a frontier model in a data center for assessment is fine for a single tile but:
- High bandwidth (each Sentinel-2 tile is megabytes, even compressed)
- Slow (single-digit seconds per inference at the API)
- Expensive at scale ($$$ per call)
- Defeats the purpose if the ground link is congested in a crisis

A 450M-parameter VLM running in-orbit on the satellite (DPhi Space puts compute on small sats) emits ~200 bytes of structured JSON instead of megabytes of imagery. That fits on any low-bandwidth ground link, including emergency satcom. The community station receives that, decides whether it triggers an alert based on local thresholds, and pushes a notification to the local app.

This was Liquid AI × DPhi Space's premise for the AI-in-Space hackathon: Pau Labarta Bajo proved it for wildfires; we're applying the same pattern to floods.

## This repo at a glance

```
humaid/
├── finetune-flood/       Flood-detection vision model — fine-tune pipeline,
│                         data, evals, deploy guide, and a standalone demo app
│                         on top of llama-server. Model published as
│                         huggingface.co/jpmarindiaz/lfm2-flood; dataset as
│                         huggingface.co/datasets/jpmarindiaz/flood-detection-
│                         pair-colombia. Details in finetune-flood/REPORT.md.
│
├── simsat/               DPhi Space Sentinel-2 simulator (cloned). Docker
│                         service that proxies AWS Element84 STAC and serves
│                         imagery for any (lon, lat, timestamp). Powers the
│                         training-data fetcher in finetune-flood/.
│
├── knowledge-base/       The KB AI system: 589 role-tagged Q&A pairs, a
│                         Nomic-embeddings DuckDB index (kb.duckdb, ~2.9 MB),
│                         and a Deno CLI for local retrieval. Used by both the
│                         website and the Tauri client.
│
├── website/              Public site — Hono + React on Deno. Hosts both AI
│                         systems side-by-side as demos (KB chat at /api/qa,
│                         flood inference at /api/flood) and is the alert
│                         publisher the Tauri client polls.
│
├── tauri/                Desktop + Android client. Single Rust + React tree
│                         (Tauri 2). KB browser, chat, and alert tab. Polls
│                         the website's /api/alerts for incoming flood events.
│
├── events-map/           Geographic + temporal index of historical flood
│                         events used to ground the labeling and the KB.
│
├── research/             Domain research that grounds the project:
│                         flood-sentinel-2.md, flood-tagging-and-reference-
│                         points.md, the Liquid AI cookbook clone, transcripts.
│
├── docs/                 Cross-cutting docs — ARCHITECTURE.md is the canonical
│                         system overview; dev_notes/ollama-publishing.md
│                         covers how we pushed the base model to Ollama Hub.
│
├── Modelfile             The Ollama Modelfile we built en route to the
│                         published lfm2.5-vl-450m model.
│
└── README.md             You are here.
```

## Run it locally

The two things you can stand up on a fresh laptop are the **website** (which is the live alert publisher and the public demo of both AI systems) and the **Tauri client** (which polls the website for alerts and hosts the on-device KB). They work independently — you don't need both to play with one.

### Prerequisites

Common to everything below:

- **[Deno 2.x](https://deno.land/)** — the toolchain for the website, the Tauri shell, the KB CLI, and the fine-tune pipeline.
- **[Ollama](https://ollama.com/)** with `nomic-embed-text` pulled (text-embedding model, ~270 MB):
  ```bash
  ollama pull nomic-embed-text
  ```

For the flood demo on the website you'll also want:

- **[`llama.cpp`](https://github.com/ggml-org/llama.cpp) / `llama-server`** — `website/scripts/fetch_binaries.ts` will download a Linux binary on demand; on macOS / Windows install via your package manager (`brew install llama.cpp`).
- **The fine-tuned flood GGUFs** from [HuggingFace `jpmarindiaz/lfm2-flood`](https://huggingface.co/jpmarindiaz/lfm2-flood) — `fetch_binaries.ts` pulls these into `website/bin/models/`. ~245 MB backbone + ~189 MB mmproj.
- **(Optional) the training dataset** if you want to reproduce / extend the fine-tune: [`jpmarindiaz/flood-detection-pair-colombia`](https://huggingface.co/datasets/jpmarindiaz/flood-detection-pair-colombia) — 88 train + 22 eval 4-image pair samples across 9 La Mojana / Putumayo flood events.

For Tauri development:

- **Rust** (`rustup`) and the platform-specific toolchain Tauri requires — see [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/).
- For Android only: **Android Studio** with SDK + NDK 25+, plus `JAVA_HOME` / `ANDROID_HOME` / `NDK_HOME` set, and the Rust Android targets (`rustup target add aarch64-linux-android …`). Full breakdown in [`tauri/README.md`](tauri/README.md#building-for-android).

### 1. Run the website

```bash
cd website
deno task build       # installs deps, builds kb.duckdb copy, fetches model + binaries
deno task start       # http://localhost:8000
```

You'll get the landing page at `/`, the demo app at `/app` (KB chat tab + flood-detection tab), and the JSON APIs (`/api/health`, `/api/kb`, `/api/qa`, `/api/flood`, `/api/chat`). On first start the cold start takes ~30–60 s while llama-server memory-maps the GGUFs; subsequent requests are fast.

For development with hot-reload:

```bash
deno task dev         # rebuilds the React client + watches main.tsx
```

The website's full layout, env vars, and Deno Deploy notes are in [`website/README.md`](website/README.md). The alert simulator that the Tauri client relies on is specced in [`website/docs/SIMULATOR.md`](website/docs/SIMULATOR.md).

### 2. Run the Tauri desktop app

```bash
cd tauri
deno install          # grabs the React + Vite + Tauri dependency tree
deno task tauri dev   # native window, hot reload, talks to local Ollama
```

The KB browser and chat work immediately against the bundled `kb.duckdb` and your local Ollama. The alerts tab needs the website's `/api/alerts` endpoint to be reachable (the website team is wiring it up — see [`website/docs/SIMULATOR.md`](website/docs/SIMULATOR.md)); until then it sits idle.

### 3. Run the Tauri Android app

```bash
# Prereqs: Android Studio, SDK + NDK, Rust Android targets, env vars set.
# See tauri/README.md for the full setup.
cd tauri
deno task tauri android dev   # cross-compiles to your emulator or USB device
```

First build cross-compiles DuckDB + ~400 crates — expect 5–10 min. Subsequent runs are fast. You can run the desktop and Android shells side-by-side; the Vite dev server is reused. See the **Building for Android** section in [`tauri/README.md`](tauri/README.md) for the full guide, including release APK / AAB builds and the common gotchas.

### 4. (Optional) Run the standalone flood-detection demo

The website hosts both demos, but `finetune-flood/app/` is a smaller, self-contained Hono app that talks directly to `llama-server`. Useful when you're iterating on the flood model itself.

```bash
cd finetune-flood
deno task serve       # spawns llama-server with our fine-tuned GGUFs on :8765
deno task app         # http://localhost:8081
```

Two terminals — `serve` is the model, `app` is the UI. Details in [`finetune-flood/app/README.md`](finetune-flood/app/README.md).

## Replicate the full pipeline from scratch

If you want to redo the fine-tune (or apply the same pipeline to a different domain), the canonical end-to-end documentation lives under [`finetune-flood/`](finetune-flood/):

- **[`finetune-flood/PLAYBOOK.md`](finetune-flood/PLAYBOOK.md)** — the canonical step-by-step walkthrough. Start here.
- **[`finetune-flood/docs/`](finetune-flood/docs/)** — pipeline overview, data collection, labeling protocol, evaluation methodology, findings, and the website-deploy guide.
- **[`finetune-flood/REPORT.md`](finetune-flood/REPORT.md)** — the wrap-up: what we learned, why we paused, what to change for a Sentinel-1 SAR re-attempt.

The compressed pipeline is:

1. Stand up SimSat (`docker compose up` in `simsat/`).
2. Generate training tile pairs (`deno task generate` in `finetune-flood/`).
3. Label with Claude Code agents (`deno task label-agents`).
4. Build the JSONL dataset (`deno task build-dataset`).
5. Push to Modal + run the H100 fine-tune (`deno task upload`, then `modal run …`).
6. Pull and quantize the merged checkpoint to GGUF (`deno task package`).
7. Evaluate with `deno task eval` and compare runs with `deno task eval:compare`.
8. Publish to HF Hub with `deno task hf:push:model` and `deno task hf:push:dataset`.

To rebuild the **knowledge-base index** after editing `knowledge-base/qa-pairs.csv`:

```bash
cd knowledge-base && deno task build           # rebuilds kb.duckdb in-place
cd ../website     && deno task build:kb        # copies it into website/data/
# tauri picks up the new file from knowledge-base/ via include_bytes! at build time
```

## Project journey

A linear log of how we got here. Useful context if you're picking up the work.

### 1. Got the base model running locally

- Pulled `LiquidAI/LFM2.5-VL-450M-GGUF` (Q4_0) via `llama-mtmd-cli`
- Stood it up under Ollama with a working ChatML chat template (the default `{{ .Prompt }}` passthrough emits an EOS token on the chat API — needed an explicit template; details in [`docs/dev_notes/ollama-publishing.md`](docs/dev_notes/ollama-publishing.md))
- Published the base model to Ollama Hub as [`jpmarindiaz/lfm2.5-vl-450m`](https://ollama.com/jpmarindiaz/lfm2.5-vl-450m). Text-only (Ollama can't bundle the mmproj cleanly for LFM2 yet); for vision use `llama-server` directly

### 2. Cloned the DPhi Space simulator

- `simsat/` is the official AI-in-Space hackathon simulator
- `docker compose up` brings up dashboard (port 8000) + data API (port 9005)
- Sentinel-2 imagery on demand for any (lon, lat, timestamp) — multispectral, 13 bands

### 3. Built the flood-detection pipeline (`finetune-flood/`)

End-to-end Deno/TypeScript orchestration mirroring Pau's wildfire example, but with two key differences:

- **Pair input** (RGB+SWIR baseline + RGB+SWIR current, 4 images per sample) instead of single-tile. La Mojana is a chronic wetland — single-tile labeling can't tell "town in normal ciénaga" from "town flooded". Pair input collapses that ambiguity.
- **Claude Code agents** for labeling instead of direct Anthropic API. Cheaper for iteration, and the schema/calibration prompt lives in `src/prompts.ts` so swapping to API is one function call.

The full pipeline (in dev order):

1. `simsat.ts` + retry/backoff — typed client for the SimSat data API
2. `locations.ts` (14 munis) + `events.ts` (9 anchored events) — La Mojana dike breaches + Putumayo riverine + Mocoa avalancha
3. `generate.ts` — for each (location × event × window): sweep 4 candidate dates at Sentinel-2 cadence, pick lowest-cloud, fetch RGB+SWIR
4. `pairs.ts` + `label_agents.ts` — group fetched tiles into (baseline → current) pairs, write a manifest
5. Agent dispatch from this conversation — each agent labels a slice of pairs via the schema in `prompts.ts`
6. `build_dataset.ts` — pack into `vlm_sft` JSONL (4 image content blocks per sample)
7. `evaluate.ts` — anthropic + llama-server backends, schema-injected, dynamic per-run reports

**Final dataset:** 115 pair samples across 9 events. **Final eval:** Opus oracle 0.68 / Sonnet oracle 0.66 / base LFM2.5-VL with schema injection 0.44.

Full findings and the case for stopping in [`finetune-flood/REPORT.md`](finetune-flood/REPORT.md). Process docs in [`finetune-flood/docs/`](finetune-flood/docs/).

### 4. Decided to pause the fine-tune

Three reasons (full discussion in `finetune-flood/REPORT.md`):

1. **Sentinel-2 alone is the wrong tool for La Mojana.** ~50% of acquisitions in the wet season are >50% cloud. The CopernicusLAC operational pipeline uses Sentinel-1 SAR (cloud-independent) for exactly this region. SimSat doesn't expose SAR.
2. **Labeler noise floor caps achievable accuracy at ~0.66.** Inter-labeler agreement on subjective enums (`flood_severity`, `water_coverage_pct_estimate`) is 0.43–0.70. The student model can't exceed that.
3. **Sentinel-2 cadence misses peak events.** The May 2024 Cara de Gato breach: closest cloud-tolerable Sentinel-2 acquisitions were 9 days before or 16 days after, both with extensive cloud cover.

The code is reusable. For a Sentinel-1 SAR re-attempt, only `simsat.ts` (data source) and the band selection change. Everything else — orchestration, pair labeling, evals — transfers.

## What's next

In rough priority order:

- **Wire up the website's `/api/alerts` endpoint** so the Tauri client can poll real (simulated) alerts. Spec in [`website/docs/SIMULATOR.md`](website/docs/SIMULATOR.md).
- **Knowledge-base SOP content.** Markdown-with-frontmatter chunks layered on top of the existing 589 Q&A pairs, indexed by location + role for a first pilot region.
- **Tauri client polish.** Role / region picker on first launch, KB-version sync against the website, OS-native notifications fully wired.
- **Community-station daemon.** Receives JSON alert payloads (over satcom or any low-bandwidth link), serves them + the synced knowledge base over a local network. Raspberry Pi class.
- **Better satellite data.** Sentinel-1 SAR pipeline (Copernicus Open Access Hub or Microsoft Planetary Computer) so the cloud problem stops blocking model training.

## Pointers

- **System architecture (canonical)** — [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Tauri client brief** — [`tauri/README.md`](tauri/README.md)
- **Website README** — [`website/README.md`](website/README.md)
- **Alert simulator spec** — [`website/docs/SIMULATOR.md`](website/docs/SIMULATOR.md)
- **Knowledge-base README** — [`knowledge-base/README.md`](knowledge-base/README.md)
- **Flood model report** — [`finetune-flood/REPORT.md`](finetune-flood/REPORT.md)
- **Flood model process docs** — [`finetune-flood/docs/`](finetune-flood/docs/) (overview, pipeline, data collection, labeling, evaluation, findings, deploy guide)
- **Flood model playbook** — [`finetune-flood/PLAYBOOK.md`](finetune-flood/PLAYBOOK.md)
- **Ollama publishing walkthrough** — [`docs/dev_notes/ollama-publishing.md`](docs/dev_notes/ollama-publishing.md)
- **Domain research** — [`research/`](research/), especially `flood-sentinel-2.md` and `flood-tagging-and-reference-points.md`
- **Liquid AI cookbook clone (wildfire reference)** — [`research/liquidai/cookbook/examples/wildfire-prevention/`](research/liquidai/cookbook/examples/wildfire-prevention/)
- **Sentinel-2 simulator** — [`simsat/`](simsat/)
