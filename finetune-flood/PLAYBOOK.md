# finetune-flood — playbook

End-to-end command sequence for fine-tuning `LiquidAI/LFM2.5-VL-450M` on Sentinel-2 flood imagery. Mirrors the structure of [`finetune-quixote`'s](https://github.com/jpmarindiaz/liquid-ai-in-space/tree/main/finetune-quixote) Quickstart, with the wildfire-style eval cycle bolted on.

> Status: pipeline complete, fine-tune currently paused. See [`REPORT.md`](REPORT.md) for findings + the case for switching to Sentinel-1 SAR before resuming. The commands below all work; you'll just hit a noise-floor ceiling around 0.66 with the current dataset.

## Quickstart (already-fetched data, fine-tune the rest)

If the data in `data/raw/<run>/` is already there and labeled (the case at the time we paused):

```bash
# 1. Build the JSONL training set + image tree
deno task build

# 2. Push to Modal volume
deno task upload

# 3. Train on Modal H100 (clones leap-finetune as a sibling dir)
cd ../leap-finetune
uv run leap-finetune ../finetune-flood/configs/flood_modal.yaml

# 4. Pull the checkpoint
cd ../finetune-flood
deno task pull
deno task pull --run "<run-name-from-step-above>"

# 5. Convert to backbone + mmproj GGUFs
deno task package

# 6. Serve the fine-tuned model
deno task serve         # outputs/lfm2-flood-Q4_0.gguf + mmproj

# 7. Eval (oracle, base, fine-tuned), all writing to evals/<ts>/
deno task eval --raw data/raw/<run> --backend anthropic --model claude-opus-4-6 --name "opus oracle"
deno task eval --raw data/raw/<run> --backend local --url http://localhost:8765 --model lfm2-flood --name "lfm2-flood ft"

# 8. Compare side-by-side (terminal table + MD report at evals/_compare_<ts>/report.md)
deno task eval:compare
```

## Full sequence (from scratch)

```bash
# 0. Clone the simulator (sibling dir)
cd ..
rm -rf simsat                                  # remove our stub
git clone https://github.com/DPhi-Space/SimSat.git simsat
cd simsat
docker compose --env-file ../.env up -d        # MAPBOX_ACCESS_TOKEN goes in humaid/.env
curl -sf http://localhost:9005/data/current/position && echo " · simsat is up"

cd ../finetune-flood
cp .env.example .env                           # then add ANTHROPIC_API_KEY

# 1. Fetch — no labels yet (--test means image-only, no Anthropic calls)
deno task fetch --test --concurrency 2
# Outputs: data/raw/<ts>/<location>/<event>_<window>/{rgb.png, swir.png, capture_metadata.json}

# 2. Label.  Two paths:

#    Path A — Claude Code agents (good for iteration / 100s of tiles)
deno task label:manifest --raw data/raw/<run> --mode pairs --slices 5
deno run -A src/agent_prompt_section.ts --manifest data/raw/<run>/label_manifest.json --slice 0
# (paste the section into a Claude Code Agent prompt; repeat for each slice)

#    Path B — Anthropic API directly (production scale, fully scripted)
deno task label:anthropic --raw data/raw/<run> --model claude-opus-4-6 --concurrency 4
# Idempotent. Skips already-labeled tiles. Writes annotation.json per pair.

# 3. Sanity-check the labels
deno task preview                              # 3 random rows from data/flood_train.jsonl

# 4. Build the leap-finetune dataset
deno task build
# Dedupes by (location, event, window) across all run dirs, splits temporally
# (latest 20% to eval), writes data/flood_train.jsonl + flood_eval.jsonl,
# mirrors images to data/images/

# 5. Push to Modal
deno task upload
# Creates volume "finetune-flood" if needed, uploads JSONLs + image tree

# 6. Fine-tune on Modal H100
cd ../leap-finetune     # clone separately: git clone https://github.com/Liquid4All/leap-finetune
uv sync                  # one-time
uv run leap-finetune ../finetune-flood/configs/flood_modal.yaml
# Streams logs. ~30-60 min on H100 for ~110 samples × 3 epochs.
# Trackio dashboard URL prints in the logs.

# 7. Pull the merged checkpoint
cd ../finetune-flood
deno task pull                                 # lists runs in the volume
deno task pull --run "<full-run-name>"         # downloads to outputs/<run-name>

# 8. Convert HF → backbone GGUF + mmproj GGUF
deno task package
# Default Q4_0 (~210 MB). Use --quant Q5_K_M or Q8_0 if you want better quality.
# Outputs: outputs/lfm2-flood-Q4_0.gguf + outputs/mmproj-lfm2-flood-F16.gguf

# 9. Serve
deno task serve
# Auto-detects the GGUFs from step 8.
# Or `deno task serve --base` to host the base (un-fine-tuned) model from HF.

# 10. Three-way eval (oracle, base, fine-tuned)
deno task eval --raw data/raw/<run> --backend anthropic --model claude-opus-4-6 --name "opus oracle"
deno task serve --base &                       # in another terminal
deno task eval --raw data/raw/<run> --backend local --url http://localhost:8765 --model lfm2.5-vl-450m-base --name "base"
# ... swap to the fine-tuned model:
kill %1 ; deno task serve &
deno task eval --raw data/raw/<run> --backend local --url http://localhost:8765 --model lfm2-flood --name "fine-tuned"

# 11. Compare
deno task eval:compare
# Terminal table + evals/_compare_<ts>/report.md with sample-level disagreements
# and embedded images of the worst tiles.

# 12. (Optional) Publish to HuggingFace Hub
deno task hf:push:model        # creates jpmarindiaz/lfm2-flood (public)
deno task hf:push:dataset      # creates jpmarindiaz/flood-detection-pair-colombia (public)
# Both scripts are idempotent (--exist-ok) and re-runnable; --skip-card preserves
# any manual edits to README.md. Needs `hf auth login` first.
```

## Live demo app

After steps 8 (package) + 9 (serve), open the demo UI:

```bash
deno task app          # http://localhost:8081
```

Two modes: upload 4 PNGs OR pick a location + dates and the app fetches the imagery from SimSat. See [`app/README.md`](app/README.md).

## What lives where

```
finetune-flood/
├── deno.json            tasks + import map
├── .env.example         ANTHROPIC_API_KEY, SIMSAT_BASE_URL
├── README.md            project status + how-it-fits-in-humaid
├── REPORT.md            wrap-up findings (oracle vs base, what's broken, why we paused)
├── PLAYBOOK.md          you are here
│
├── src/
│   ├── locations.ts     14 flood-prone locations (La Mojana + Putumayo)
│   ├── events.ts        9 documented events with pre/event/post candidate sweep
│   ├── prompts.ts       SYSTEM_PROMPT + USER_PROMPT + FLOOD_LABEL_SCHEMA
│   ├── simsat.ts        typed client for the SimSat data API
│   ├── pairs.ts         (location, event) → (pre, current) grouping
│   ├── generate.ts      candidate-sweep fetcher (deno task fetch)
│   ├── label_agents.ts  pair-manifest builder (deno task label:manifest)
│   ├── label_anthropic.ts  scripted labeler via Anthropic API (deno task label:anthropic)
│   ├── agent_prompt_section.ts  print per-pair prompt section from a manifest
│   ├── build_dataset.ts vlm_sft 4-image JSONL builder (deno task build)
│   ├── upload_to_modal.ts (deno task upload)
│   ├── pull_checkpoints.ts (deno task pull)
│   ├── package.ts       HF → backbone GGUF + mmproj GGUF (deno task package)
│   ├── serve.ts         convenience launcher for llama-server (deno task serve)
│   ├── evaluate.ts      anthropic + local backends (deno task eval)
│   ├── eval_compare.ts  terminal table + MD compare report (deno task eval:compare)
│   └── preview.ts       sanity-check the built dataset (deno task preview)
│
├── configs/
│   └── flood_modal.yaml leap-finetune config (vlm_sft, full FT not LoRA, H100)
│
├── docs/                full process docs (00-overview through 05-findings)
│
├── data/                generated, gitignored
│   ├── raw/<run>/<location>/<event>_<window>/{rgb,swir,capture_metadata,annotation}.json
│   ├── images/          flat copy of the images, referenced from JSONL
│   └── flood_*.jsonl    leap-finetune training set
│
├── outputs/             gitignored
│   ├── lfm2-flood-Q4_0.gguf       backbone
│   └── mmproj-lfm2-flood-F16.gguf vision tower
│
└── evals/               gitignored — one dir per eval run, plus _compare_<ts>/
    ├── <ts>/report.md   accuracy table + per-field disagreements + worst-sample images
    ├── <ts>/results.json
    └── <ts>/meta.json
```

## What "good" looks like

After step 10, your `eval:compare` table should look something like (target column is fine-tuned, after the actual training):

| field | opus oracle | base LFM2.5-VL | **fine-tuned target** |
|---|--:|--:|--:|
| valid_json | 1.00 | 1.00 | 1.00 |
| fields_present | 1.00 | 1.00 | 1.00 |
| flood_present | 0.67 | 0.66 | **≥0.80** |
| flood_severity | 0.43 | 0.29 | **≥0.50** |
| populated_area_affected | 0.73 | 0.51 | **≥0.65** |
| infrastructure_at_risk | 0.73 | 0.54 | **≥0.65** |
| river_overflow_visible | 0.67 | 0.60 | **≥0.65** |
| image_quality_limited | 0.83 | 0.10 | **≥0.70** |
| **overall** | **0.68** | 0.44 | **≥0.65** |
| latency (s) | 3.87 | 0.53 | 0.55 |

The hard ceiling for the student is **inter-labeler agreement on the ground truth** (~0.66–0.68). Beating that requires either better labelers or a tighter schema. See [`docs/05-findings.md`](docs/05-findings.md).

## What we actually ran (May 2026) — gotchas + fixes

The first time we ran the full pipeline end-to-end we hit five things worth flagging. None of them are blockers anymore — they're all fixed in this repo — but if you fork this and start over, here's what to expect.

### 1. Image paths in the JSONL need an `image_root`

Symptom: `leap-finetune` aborted with `Sample 0, message 0, content 0: image not loadable: images/.../rgb.png` during dataset validation.

Cause: `build_dataset.ts` writes image paths relative to the JSONL location (`images/...`). The validator calls `PIL.Image.open("images/...")` against the container's cwd, not the JSONL's directory, so the relative path fails to resolve.

Fix (already in `configs/flood_modal.yaml`):
```yaml
dataset:
  path: "/finetune-flood/data/flood_train.jsonl"
  image_root: "/finetune-flood/data"   # prepended to relative image paths
```

### 2. `convert_hf_to_gguf.py --mmproj` chokes on `lm_head.weight`

Symptom: `ValueError: Can not map tensor 'lm_head.weight'` during the mmproj conversion step of `deno task package`.

Cause: `leap-finetune`'s full-FT merged checkpoint un-ties `lm_head` from `embed_tokens` and saves it at the **top level** of `model.safetensors` (not under the `language_model.` prefix). The base `MmprojModel.filter_tensors` in `convert_hf_to_gguf.py` only filters out tensors with `language_model.` in the name, so the orphan `lm_head.weight` slips through and trips `map_tensor_name`.

Fix: [`scripts/convert_mmproj_lfm2vl.py`](scripts/convert_mmproj_lfm2vl.py) is a small Python wrapper that imports the brewed `convert_hf_to_gguf.py` as a module, monkeypatches `LFM2VLModel.filter_tensors` to also drop top-level `lm_head.*` tensors, then forwards `sys.argv` to the upstream `main()`. `package.ts` calls our wrapper instead of the brewed script directly. Survives `brew upgrade`.

### 3. OpenMP duplicate-library abort

Symptom: macOS dialog `"Python ... abort() called"` after running `deno task package`. Process trace points at `Python 3.14` from `uv run --with torch`. Console error before the crash: `OMP: Error #15: Initializing libomp.dylib, but found libomp.dylib already initialized.`

Cause: PyTorch's bundled `libomp.dylib` clashes with Apple's system `libomp.dylib` when both get loaded into the same Python process under `uv run`.

Fix: `convert_mmproj_lfm2vl.py` sets `KMP_DUPLICATE_LIB_OK=TRUE` before importing torch. Already in the script.

### 4. The base-LFM2.5 baseline reported 0.00 overall

Symptom: `deno task eval --backend local` returned `overall: 0.00` for the un-fine-tuned base model. Nothing wrong with the model — every per-field accuracy was 0.

Cause: `src/evaluate.ts:llamaServerBackend` was sending a prose system prompt and a "reply with JSON" instruction, but **nothing telling the model which JSON keys to emit**. The Anthropic backend forces the schema via `tool_use` with `input_schema=FLOOD_LABEL_SCHEMA`. The local backend wasn't doing the equivalent. The base LFM2.5 improvised key names like `tile_pair`, `current_window`, `swir_baseline` — all of which scored 0/7 against our schema.

Fix: `evaluate.ts:llamaServerBackend` now sends `response_format: {type: 'json_schema', ...}` (llama.cpp grammar-constrains the output) plus an explicit field list in the user prompt as a fallback. With this, the same base model scored 0.44 overall.

### 5. SimSat connection drops at high concurrency

Symptom: `deno task fetch --concurrency 4` hits `client error (SendRequest): connection closed before message completed` part-way through.

Cause: SimSat proxies to AWS Element84 STAC. With 4 concurrent windows × 4 parallel candidate probes per window = 16 simultaneous outbound requests, the Element84 endpoint occasionally drops connections.

Fix: Default fetcher concurrency is 2 (windows in flight). Probes within a window stay parallel. `fetchSentinelWithRetry` does 3 retries with linear backoff for any individual call.

### 6. Other known limitations (not bugs)

- **Mocoa 2017 has no usable Sentinel-2 pre tile.** The pipeline manually fetches a 2017-08-15 stand-in baseline; the annotation flags this with a `note` field. See `docs/03-labeling.md`.
- **mmproj + Ollama don't mix yet.** Ollama can't bundle the vision projector cleanly for LFM2-VL. Use `llama-server` (which `deno task serve` wraps) for vision inference.
- **Schema's hardest fields are inherently noisy.** `flood_severity` and `water_coverage_pct_estimate` are subjective enums — Opus self-consistency is 0.43 and 0.70 respectively. The student model's ceiling on these fields is the labeler's noise floor.

## Reference: what we got after one run

Numbers from May 2026, ~$0.50 of Modal H100 credits, ~70s of training on 88 paired samples × 3 epochs:

| field | opus oracle (n=30) | sonnet oracle (n=110) | LFM2.5-VL base (n=110) | **lfm2-flood ft + real mmproj (n=110)** |
|---|--:|--:|--:|--:|
| valid_json | 1.00 | 1.00 | 1.00 | 1.00 |
| fields_present | 1.00 | 1.00 | 1.00 | 1.00 |
| flood_present | 0.67 | 0.66 | 0.66 | 0.66 |
| flood_severity | 0.43 | 0.49 | 0.29 | 0.29 |
| water_coverage | 0.70 | 0.62 | 0.37 | 0.35 |
| populated_area | 0.73 | 0.69 | 0.51 | 0.51 |
| infrastructure | 0.73 | 0.69 | 0.54 | 0.54 |
| river_overflow | 0.67 | 0.65 | 0.60 | 0.60 |
| `image_quality_limited` | 0.83 | 0.84 | 0.10 | **0.90** |
| **overall** | **0.68** | 0.66 | 0.44 | **0.55** |
| latency (s) | 3.87 | 3.74 | 0.53 | 0.53 |

Key reading: **+11 points overall (0.44 → 0.55)** but the gain is concentrated in one field (`image_quality_limited`: 0.10 → 0.90). The other 6 fields essentially didn't move. With this much data the model learned the dataset's strong cloud prior, not the visual change-detection. To beat 0.55 you need 5–10× more data, ideally Sentinel-1 SAR (cloud-independent), or a tighter schema dropping the high-noise fields.
