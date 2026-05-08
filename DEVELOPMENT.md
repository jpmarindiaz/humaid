# Development guide

Goal of this doc: someone who just landed on the repo can clone it and run the whole thing on their laptop in under an hour. Every command below is copy-paste runnable. Where something is fragile, the doc says so.

For *what* humaid is and *why* it's shaped this way, read [`README.md`](README.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). This file is just the operational manual.

---

## TL;DR — the fastest path

If you only want to see humaid running locally and don't care about reproducing the model training:

```bash
# 1. Clone
git clone https://github.com/jpmarindiaz/humaid.git
cd humaid

# 2. Install Deno + Ollama, pull the embedding model
brew install deno ollama          # or your platform's equivalent
ollama pull nomic-embed-text       # ~270 MB

# 3. Run the website (kb chat + flood demo)
cd website
deno task build                    # installs deps, fetches the flood GGUFs
deno task start                    # http://localhost:8000

# 4. (Separate terminal) run the Tauri desktop app
cd ../tauri
deno install
deno task tauri dev
```

That's enough to play with both AI systems. Read the rest of this doc when you want to (a) develop against the codebase, (b) train the flood model from scratch, or (c) deploy.

---

## What's in the repo

```
humaid/
├── README.md            project overview, status, pointers
├── DEVELOPMENT.md       this file
├── docs/                cross-cutting docs — ARCHITECTURE.md is canonical
├── pitch/               narrative materials (problem, solution, partners…)
│
├── website/             public site (Hono + React on Deno) — hosts both
│                        AI demos and is the alert publisher
├── tauri/               desktop + Android client — Tauri 2 (Rust + React)
│
├── finetune-flood/      satellite-side flood VLM: data, labeling, training,
│                        evals, deploy guide. Outputs published to HF Hub.
├── knowledge-base/      laptop-side KB: 589 bilingual Q&A pairs + DuckDB
│                        index. Published to HF Hub.
├── simsat/              cloned DPhi Space Sentinel-2 simulator (Docker)
│
├── events-map/          historical flood events index used to ground the
│                        labeling and the KB
├── research/            domain research (Sentinel-2, La Mojana / Putumayo,
│                        Liquid AI cookbook clone, transcripts)
├── leap-finetune/       (optional) local checkout of Liquid's training lib
└── Modelfile            the Ollama Modelfile we built en route to publishing
                         the base LFM2.5-VL to Ollama Hub
```

---

## Prerequisites

### Required for almost everything

| Tool | Why | Install |
|---|---|---|
| **[Deno 2.x](https://deno.land)** | toolchain for the website, Tauri shell, KB CLI, fine-tune pipeline | `brew install deno` / `curl -fsSL https://deno.land/install.sh \| sh` |
| **[Ollama](https://ollama.com)** | hosts the embedding + text models for the KB system | `brew install ollama` / Windows installer / `.deb` |

After installing Ollama, pull the embedding model:

```bash
ollama pull nomic-embed-text       # 137M, 768-dim multilingual
```

That's the *minimum* to run the website's KB demo and the Tauri client's KB browser.

### For the flood-detection demo (vision model)

| Tool | Why | Install |
|---|---|---|
| **[`llama.cpp`](https://github.com/ggml-org/llama.cpp)** | the only runtime that loads LFM2-VL's `mmproj` | `brew install llama.cpp` (macOS) — for Linux, `website/scripts/fetch_binaries.ts` will download a binary |
| **The fine-tuned GGUFs** | the actual flood model | auto-fetched from [`jpmarindiaz/lfm2-flood`](https://huggingface.co/jpmarindiaz/lfm2-flood) by `deno task fetch-binaries` |

### For Tauri development

| Tool | Why | Install |
|---|---|---|
| **Rust** (`rustup`) | Tauri's core | <https://rustup.rs> |
| **Platform toolchain** | macOS Xcode CLT / Linux build essentials / Windows MSVC | see [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/) |

For Android only:

| Tool | Why |
|---|---|
| **Android Studio** with SDK + NDK 25+ | Android build target |
| Rust Android targets | `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android` |
| Env vars | `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME` set in your shell — see [`tauri/README.md`](tauri/README.md#building-for-android) |

### For replicating the model fine-tune

| Tool | Why |
|---|---|
| **[Modal](https://modal.com)** account | H100 cross-rental for the actual training step (~$0.50 per run) |
| **Anthropic API key** | only if you want to label with the Anthropic backend instead of Claude Code agents |
| **[`hf` CLI](https://huggingface.co/docs/huggingface_hub/guides/cli)** | publishing model + datasets back to HF Hub (`pipx install huggingface-hub`) |
| **Docker** | running the SimSat Sentinel-2 simulator |

---

## Run the website

The website hosts both AI systems side-by-side as demos and is the alert publisher the Tauri client polls. Routes: `/` (landing), `/app` (chat + flood demo), `/api/*` (JSON APIs).

### Cold start

```bash
cd website

# All-in-one: install deps, copy kb.duckdb, fetch model GGUFs + llama-server bin
deno task build

# Run the server
deno task start                    # http://localhost:8000
```

`deno task build` does four things:

1. `deno install` — pulls JS/TS deps
2. `deno task build:kb` — copies `../knowledge-base/kb.duckdb` into `website/data/`
3. `deno task fetch-binaries` — downloads `lfm2-flood-Q4_0.gguf` + `mmproj-lfm2-flood-F16.gguf` from HF Hub into `website/bin/models/`, plus a Linux `llama-server` binary into `website/bin/llama-cpp/` (skipped on macOS — install via brew)
4. `deno task build:client` — bundles the React chat client to `static/chat.js`

First request to `/api/qa` cold-starts Ollama (~30 s if `nomic-embed-text` not yet pulled). First request to `/api/flood` cold-starts `llama-server` (~30–60 s while it mmaps the GGUFs). After that everything's <100 ms (KB) / ~1–2 s (flood).

### Iterating

```bash
deno task dev                      # watch + hot reload main.tsx + client/chat.tsx
```

### What works

- `GET /api/health` — both subsystems' status
- `GET /api/kb` — KB stats
- `POST /api/qa` — `{ query, role?, phase?, region? }` → top-k matches
- `POST /api/flood` — multipart 4 PNGs → 7-key JSON
- `POST /api/chat` — JSON ⇒ KB; multipart ⇒ flood
- `POST /api/alerts` + `GET /api/alerts` — flood-alert simulator (in progress; spec at [`website/docs/SIMULATOR.md`](website/docs/SIMULATOR.md))

### Common gotchas

- **`llama-server unreachable`** in `/api/flood` — check `bin/llama-cpp/llama-server` exists and is executable. On macOS `fetch-binaries` skips it; install via `brew install llama.cpp` and the website auto-detects it on `$PATH`.
- **Ollama port conflict** — if you already have Ollama running on `:11434`, the website reuses it. Otherwise it spawns its own.
- **`@duckdb/node-api` FFI errors** — Deno needs `--allow-ffi` (already in the task definition). Make sure `nodeModulesDir: "auto"` is in `deno.json`.

Full doc: [`website/README.md`](website/README.md).

---

## Run the Tauri desktop app

```bash
cd tauri
deno install                       # React + Vite + Tauri deps
deno task tauri dev                # native window with hot reload
```

The KB browser and chat work immediately against the bundled `kb.duckdb` and your local Ollama at `http://localhost:11434`. The Alerts tab needs the website's `/api/alerts` reachable (run the website too, on `:8000`, and configure the Tauri app to point at it).

### What works

- KB browser — faceted view of the 589 Q&A rows by role / phase / region
- Chat — Nomic embed (via Ollama) + DuckDB cosine search; top-k matches displayed
- Document viewer — bundled research markdown opens in-app

### What's in progress

- Polling `/api/alerts` and surfacing OS notifications
- Role / region picker on first launch
- KB-version sync against `/api/kb/version`

Full brief: [`tauri/README.md`](tauri/README.md).

---

## Run the Tauri Android app

```bash
cd tauri
deno task tauri android dev        # → emulator or USB-debugging device
```

First build cross-compiles DuckDB + ~400 crates and takes 5–10 min. Subsequent runs are fast.

### Important difference from desktop

- **No Ollama on Android.** Mobile can't supervise a local model daemon. The `qa_search` command tries `localhost:11434` first; if that fails (always, on Android) it falls back to `POST https://humaid.app/api/qa`. Net effect: KB browser + document viewer are fully offline; chat needs a network.
- **Resources are embedded**, not bundled. `kb.duckdb` and `research/*.md` are baked into the Rust binary via `include_bytes!` and staged to `app_data_dir()` on first launch.

Full Android setup (env vars, release APK / AAB builds, gotchas): [`tauri/README.md`](tauri/README.md#building-for-android).

### Running desktop + Android side-by-side

Both `tauri dev` invocations would normally fight over Vite's port 1420. The `beforeDevCommand` is wired through `scripts/dev-or-skip.ts` which only starts Vite if it's not already up, so the second session reuses the first's. Two-terminal pattern:

```bash
# Terminal 1 — spawns Vite + the desktop window
deno task tauri dev

# Terminal 2 — Vite is already up, this just attaches
deno task tauri android dev
```

---

## Run the standalone flood-detection demo

The website hosts the flood demo, but `finetune-flood/app/` is a smaller self-contained Hono app that talks directly to `llama-server`. Useful when iterating on the flood model itself.

```bash
cd finetune-flood

# Terminal 1: model
deno task serve                    # spawns llama-server with our GGUFs on :8765

# Terminal 2: UI
deno task app                      # http://localhost:8081
```

If you don't have the GGUFs locally, `serve.ts` will fetch them from HF Hub on first run.

Full doc: [`finetune-flood/app/README.md`](finetune-flood/app/README.md).

---

## Run the KB CLI

For quick KB queries without standing up the website or Tauri shell:

```bash
cd knowledge-base
ollama pull nomic-embed-text       # one-time

# Ask a question — JSON output by default
deno task ask "How do I evacuate when the river rises overnight?"

# Human-readable output, top 3
deno task ask "what should i pack in my go-bag" --text --k 3

# With filters
deno task ask "¿Qué hago durante un paro armado?" \
  --role local-community --region putumayo --text
```

Full doc: [`knowledge-base/rag/README.md`](knowledge-base/rag/README.md).

---

## Replicate the full pipeline from scratch

If you want to redo the fine-tune (or apply the same pipeline to a different domain), the canonical step-by-step is [`finetune-flood/PLAYBOOK.md`](finetune-flood/PLAYBOOK.md). Compressed version below.

### Prerequisites for this section

- Deno 2.x (already covered above)
- Docker (for SimSat)
- Modal account + `modal token new` configured
- Optional: Anthropic API key if you want to label via the API
- Optional: HF account + `hf auth login` if you want to publish the result

### 1. Bring SimSat up

```bash
cd simsat
docker compose --env-file ../.env up -d
# dashboard at http://localhost:8000, data API at http://localhost:9005
```

### 2. Fetch training imagery

```bash
cd ../finetune-flood
cp .env.example .env               # set SIMSAT_BASE_URL, etc.
deno task fetch                    # sweeps candidate dates, fetches RGB+SWIR pairs
```

This walks `src/locations.ts` × `src/events.ts`, hits SimSat's `/data/image/sentinel` endpoint, and writes `data/raw/<run>/<location>/<event>_<window>/{rgb.png, swir.png, capture_metadata.json}`.

### 3. Label the pairs

Two options.

**(a) Claude Code agents** — what we used. Cheap, conversational. From inside Claude Code:

```bash
deno task label:manifest           # writes data/raw/<run>/manifest.json
# Then dispatch parallel agents from the conversation reading the manifest.
```

**(b) Anthropic API** — for unattended runs at scale.

```bash
ANTHROPIC_API_KEY=sk-... deno task label:anthropic
```

Either way, each tile dir gets an `annotation.json` with the 7-key labels.

### 4. Build the dataset

```bash
deno task build                    # writes data/flood_train.jsonl + data/flood_eval.jsonl
deno task preview                  # sanity-check a few rows
```

Temporal split: latest 20% by current-window timestamp goes to eval (no random splits — Sentinel-2's 5-day revisit would leak near-duplicates).

### 5. Push to Modal + train

```bash
deno task upload                   # rsyncs JSONL + image tree to Modal volume
modal run leap-finetune/path/to/runner.py --config configs/flood_modal.yaml
```

H100 single-node, full fine-tune (not LoRA), bf16, ~3 epochs. ~70 s wall time, ~$0.50.

### 6. Pull, quantize, and serve

```bash
deno task pull                     # rsyncs the merged checkpoint back from Modal
deno task package                  # converts to Q4_0 GGUF + F16 mmproj
deno task serve                    # local llama-server on :8765
```

`package.ts` calls `scripts/convert_mmproj_lfm2vl.py`, which patches a known `lm_head.weight` issue in leap-finetune's checkpoint export (see [`finetune-flood/PLAYBOOK.md`](finetune-flood/PLAYBOOK.md) for context).

### 7. Evaluate

```bash
ANTHROPIC_API_KEY=sk-... deno task eval --backend anthropic --oracle  # oracle baseline
deno task eval --backend llama --base                                  # base LFM2.5-VL
deno task eval --backend llama                                         # fine-tuned (default)

deno task eval:compare                                                  # side-by-side report
```

Each run writes `evals/<timestamp>/{meta.json, results.json, report.md}`. The compare CLI builds an accuracy table across runs.

### 8. Publish to HF Hub

```bash
hf auth login
deno task hf:push:model            # → jpmarindiaz/lfm2-flood
deno task hf:push:dataset          # → jpmarindiaz/flood-detection-pair-colombia
```

Override the `--repo` flag if you want to push to a different namespace.

### 9. (Bonus) Rebuild the KB index

If you've edited `knowledge-base/qa-pairs.csv` or added project-meta rows:

```bash
cd ../knowledge-base
deno task merge                    # if you re-built the chunks
deno task project-qa               # if you edited project-qa/source.ts
deno task build                    # embed via Ollama, write kb.duckdb
deno task hf:push:dataset          # → jpmarindiaz/humaid-kb-colombia

cd ../website
deno task build:kb                 # copy the new kb.duckdb into website/data/
```

The Tauri client picks up the new DB at next build via `include_bytes!`.

---

## Published artifacts (ready to use without rebuilding)

| Artifact | URL |
|---|---|
| Fine-tuned flood model | https://huggingface.co/jpmarindiaz/lfm2-flood |
| Flood-detection training data | https://huggingface.co/datasets/jpmarindiaz/flood-detection-pair-colombia |
| Knowledge-base Q&A | https://huggingface.co/datasets/jpmarindiaz/humaid-kb-colombia |

You can pull all of them with:

```bash
hf download jpmarindiaz/lfm2-flood
hf download jpmarindiaz/flood-detection-pair-colombia --repo-type dataset
hf download jpmarindiaz/humaid-kb-colombia --repo-type dataset
```

Or just let the various `fetch-binaries` / `build:kb` / `serve` tasks pull what they need on demand.

---

## Common cross-component gotchas

- **Two Ollama instances.** If you run the website (which can spawn its own Ollama) and the Tauri app (which talks to a system Ollama), make sure both end up at `localhost:11434` — they'll happily share the daemon.
- **`llama-server` and Ollama on the same box.** They live on different ports (`:8765` and `:11434`) so they coexist. The flood path uses `llama-server`; the KB path uses Ollama. Don't try to load LFM2-VL into Ollama — it can't bundle the `mmproj` cleanly.
- **kb.duckdb committed.** All three consumers (CLI, website, Tauri) read the *same* committed file. After you regenerate, update them in this order: `knowledge-base/kb.duckdb` → `website/data/kb.duckdb` (via `deno task build:kb`) → Tauri picks it up at next build.
- **Don't commit `outputs/`.** The merged HF checkpoint (~1 GB) and DeepSpeed shards (~5 GB) live there and are gitignored. They're on HF Hub already.
- **Apple silicon: PyTorch / OMP crash** during `convert_mmproj_lfm2vl.py`. The wrapper sets `KMP_DUPLICATE_LIB_OK=TRUE` before any torch import — keep it that way.
- **Schema in the prompt is load-bearing.** Without `response_format: {type: 'json_schema'}` AND the schema text in the user prompt, the local model improvises field names. Both layers together get you from 0.00 → 0.44 baseline accuracy.

---

## Where to read next

- [`README.md`](README.md) — what humaid is and why
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — canonical system overview
- [`finetune-flood/PLAYBOOK.md`](finetune-flood/PLAYBOOK.md) — full fine-tune recipe
- [`finetune-flood/REPORT.md`](finetune-flood/REPORT.md) — what we learned, why operational fine-tune is paused
- [`finetune-flood/docs/`](finetune-flood/docs/) — pipeline / data / labeling / eval / findings / website-deploy
- [`tauri/README.md`](tauri/README.md) — desktop + Android client design brief
- [`website/README.md`](website/README.md) and [`website/docs/SIMULATOR.md`](website/docs/SIMULATOR.md) — public site + alert simulator
- [`knowledge-base/README.md`](knowledge-base/README.md) — KB schema, build process, coverage
