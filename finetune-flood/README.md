# finetune-flood

Fine-tune `LiquidAI/LFM2.5-VL-450M` to output a structured flood-risk JSON profile from a Sentinel-2 satellite tile **pair** (baseline + current, RGB + SWIR each). Same backend as the [Liquid AI wildfire-prevention cookbook example](https://github.com/Liquid4All/cookbook/tree/main/examples/wildfire-prevention) (Modal H100 + leap-finetune), but with all orchestration in Deno/TypeScript and the labeling pipeline driven directly by the [SimSat](https://github.com/DPhi-Space/SimSat) satellite simulator.

The published model is intended to run on a satellite (or any low-resource node) and downlink only a small JSON payload, not raw imagery.

## Published artifacts (May 2026 run)

- **Model** — [`jpmarindiaz/lfm2-flood`](https://huggingface.co/jpmarindiaz/lfm2-flood) (public). Merged HF checkpoint + Q4_0 backbone GGUF (~245 MB) + F16 mmproj GGUF (~189 MB). Model card has the full eval scoreboard.
- **Dataset** — [`jpmarindiaz/flood-detection-pair-colombia`](https://huggingface.co/datasets/jpmarindiaz/flood-detection-pair-colombia) (public). 88 train + 22 eval 4-image pair samples across 9 La Mojana / Putumayo flood events. Built from Sentinel-2 imagery via SimSat, labeled by Claude Code agents using the schema in [`src/prompts.ts`](src/prompts.ts).

Both are reproducible with `deno task hf:push:model` and `deno task hf:push:dataset` once you've run the full pipeline through `package`.

> ## ⚠ Status: pipeline built, fine-tune paused
>
> We built the full pipeline and labeled 115 pair samples across 9 La Mojana / Putumayo events. We **decided not to run the actual fine-tune yet.** Three reasons:
>
> 1. Sentinel-2 alone is the wrong tool for La Mojana — ~50% of wet-season acquisitions are >50% cloud. CopernicusLAC's operational pipeline uses Sentinel-1 SAR (cloud-independent) for this region; SimSat doesn't expose SAR.
> 2. Labeler noise floor is 0.66–0.68 overall (Opus self-consistency) — that's our ceiling, the student model can't exceed inter-labeler agreement.
> 3. Sentinel-2's 5-day revisit + cloud cover means the closest available imagery often misses the actual event by days.
>
> Full findings: [`REPORT.md`](REPORT.md). Process docs: [`docs/`](docs/). The code is reusable — for a Sentinel-1 SAR re-attempt only `src/simsat.ts` (the data-source client) and the band selection change. Everything else — orchestration, pair labeling, evals, packaging — transfers.

## How this fits into humaid

`finetune-flood/` is the **fine-tuning component** of the humaid project (see [`../README.md`](../README.md) and [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)). The fine-tuned model is meant to run on a satellite, ingest Sentinel-2/Sentinel-1 imagery, and emit ~200-byte JSON alerts to community ground stations. This sub-project is just the model-training half; the community station and offline-first local app are separate components, not yet built.

## What we built (summary)

**Domain:** flood detection in Colombia — La Mojana (Depresión Momposina dike-failure events) and Putumayo (Andean–Amazon riverine + Mocoa avalancha torrencial).

**Locations (14):** 8 La Mojana municipalities (San Jacinto del Cauca, Ayapel, San Benito Abad, Guaranda, Majagual, Caimito, Sucre cabecera, San Marcos) + 6 Putumayo (Mocoa, Puerto Asís, Puerto Guzmán, Colón, Santiago, Puerto Leguízamo).

**Events (9):** anchored on documented dike breaches and emergencies — Cara de Gato 2021/2024/2025, Los Arrastres 2024, La Mojana peak 2022, La Mojana peak 2024, Mocoa avalancha 2017, Putumayo Decreto 0472 (Jul 2025), Puerto Leguízamo calamidad (Apr 2025).

**Image inputs per sample (4):**
- RGB true color (B4-B3-B2) at the **baseline** (pre-event) timestamp
- SWIR false color (B12-B8-B4) at the **baseline** timestamp
- RGB at the **current** (event or post) timestamp
- SWIR at the **current** timestamp

**Why pair input:** single-tile labeling cannot distinguish "town in chronic ciénaga (La Mojana baseline)" from "flooded town" — the visible water is identical. The model needs the baseline to do change detection. We saw this empirically: the same SYSTEM_PROMPT applied by two labelers to the same single tile disagreed on `flood_present` for 25–37% of La Mojana wetland tiles. Adding the pair structure resolves the wetland-baseline ambiguity.

**Cloud handling:** for each event window we sweep 4 candidate dates at Sentinel-2's ~5-day cadence, pick the one with lowest cloud_cover, fetch RGB+SWIR for that timestamp. We do *not* hard-filter on clouds — the labeler sets `image_quality_limited=true` and chooses conservative severity for cloudy tiles. We're training the model to **abstain** on bad imagery, not to hallucinate floods.

**Labeling backend:** Claude Code agents (not direct Anthropic API) — agents read RGB+SWIR pairs via the Read tool, apply the schema in `src/prompts.ts`, write `annotation.json` per tile dir.

**Resulting dataset:**
- ~115 labeled pair samples across 9 events × ~12 (location, window) groups
- Mocoa avalancha needed a non-standard baseline (Sentinel-2 had no usable pre-event acquisitions in March 2017; we used 2017-08-15 as a stand-in "stable Mocoa" reference)
- Annotation files at `data/raw/<run-ts>/<location>/<event>_<window>/annotation.json`, each carrying its current capture metadata + a `baseline` reference + the 7-field labels JSON

## Pipeline

```
                 ┌────────────────────────────────────────────┐
                 │                  THIS REPO                 │
                 │  (Deno + TS — no GPU, no Python needed)    │
                 │                                            │
   SimSat API    │  generate.ts ──► data/raw/<run>/...        │
   (Docker)      │      │                                     │
   Anthropic API │      ▼                                     │
                 │  build_dataset.ts ──► data/flood_*.jsonl   │
                 │                       data/images/...      │
                 │      │                                     │
                 │      ▼                                     │
                 │  upload_to_modal.ts ──► Modal volume       │
                 └─────────────────┼──────────────────────────┘
                                   │
                                   ▼
                 ┌────────────────────────────────────────────┐
                 │              leap-finetune                 │
                 │   (cloned separately, runs on Modal GPU)   │
                 │   reads from volume, writes checkpoints    │
                 └─────────────────┼──────────────────────────┘
                                   │
                                   ▼
                 ┌────────────────────────────────────────────┐
                 │   pull_checkpoints.ts ──► outputs/         │
                 │   package.ts ──► backbone GGUF + mmproj    │
                 │   serve via llama-server                   │
                 └────────────────────────────────────────────┘
```

## Prerequisites

- [Deno](https://deno.com) ≥ 2.0
- [`uv`](https://docs.astral.sh/uv/) (`brew install uv`)
- [`llama.cpp`](https://github.com/ggerganov/llama.cpp) (`brew install llama.cpp`) — for GGUF conversion + quantization + serving
- [Docker](https://docs.docker.com/get-docker/) — to run SimSat
- [Modal](https://modal.com) account with credit (`uv tool install modal`, then `modal setup`)
- HuggingFace account, authenticated with `hf auth login`
- Anthropic API key (teacher model for vision labeling)

```bash
cp .env.example .env
# fill in ANTHROPIC_API_KEY
```

## 1. Start SimSat

In a separate terminal, from the cloned `simsat/` directory:

```bash
docker compose up
```

Open http://localhost:8000, click **Start** to launch the orbit simulation. The data API is on http://localhost:9005.

The historical endpoint we use (`/data/image/sentinel?lon=&lat=&timestamp=`) does not actually require the simulation to be running, but Docker has to be up.

## Why pair labeling

Pau's wildfire example labels each tile independently — RGB + SWIR for a single timestamp → JSON risk profile. That works for fire because risk factors (dry vegetation, urban interface, steep terrain) are properties of the *current* tile, not changes.

**Floods need before/after comparison.** A town surrounded by chronic ciénaga (La Mojana wetland baseline) is visually identical to a town surrounded by flood water. We saw this in early eval: with single-tile labels, two labelers using the same prompt disagreed on whether normal wetland was a "moderate flood" — the schema fundamentally cannot distinguish without baseline information.

So each sample is a 4-image **pair**: RGB-pre + SWIR-pre + RGB-current + SWIR-current. The labels describe the *current* timestamp's flood state *relative to the baseline*. The student model learns to do change detection, not single-frame appearance matching.

For each (location × event) we generate up to 2 pairs: (pre, event) and (pre, post). The post-event pair gives recovery/recession signal that's also useful training data.

## 2. Generate the labeled dataset

```bash
deno task fetch                                    # all locations, default 12 samples each
deno task fetch --location dhaka_bangladesh        # smoke test on one location
deno task fetch --samplesPerLocation 4 --dryRun    # check fetch logic without paying for labels
```

For each `(location, timestamp)` pair the script:

1. Fetches the **RGB** (red-green-blue) Sentinel-2 tile from SimSat.
2. Fetches the **SWIR false color** (B12-B8-B4 = SWIR2 / NIR / Red) tile from SimSat.
3. Skips if either tile is unavailable (over ocean) or if cloud cover > 60%.
4. Sends both PNGs to `claude-opus-4-6` (configurable via `--model`) with a constrained tool-use schema.
5. Writes `rgb.png`, `swir.png`, and `annotation.json` into `data/raw/<run-ts>/<location>/<YYYY-MM-DD>/`.

Re-runs are idempotent — already-labeled tiles are skipped.

20 locations × 12 timestamps = 240 candidate tiles, of which roughly 60–70% are usable after the cloud filter. ~150–200 labeled tiles costs a few dollars on Opus.

> **Why a separate SWIR tile?** Water absorbs SWIR (~2.2 µm) even more strongly than NIR, so flood water reads as near-black with very high contrast in B12-B8-B4 false color. SWIR also separates muddy/sediment-laden floodwater (key for the Cauca, Río Putumayo, Mocoa debris-flow cases) from clear water — that's what MNDWI-style indices exploit. The model needs *both* views: RGB for context (where are the cities/rivers/terrain?), SWIR for the actual water + sediment signal. Same combo Pau Labarta Bajo used for the wildfire cookbook example.

## 3. Build the leap-finetune dataset

```bash
deno task build
deno task preview
```

Walks every `data/raw/<run>/<location>/<day>/annotation.json`, dedupes by `(location, day)`, sorts by timestamp, and splits **temporally** (latest 20% to eval) — *not* randomly. Sentinel-2 revisits the same location every 2–5 days, so adjacent observations are near-duplicates; a random split would leak across train/eval and silently inflate metrics.

Outputs:

- `data/flood_train.jsonl`, `data/flood_eval.jsonl` — leap-finetune `vlm_sft` JSONL
- `data/images/<location>/<day>/{rgb,swir}.png` — flat image tree referenced by the JSONLs

Each row is a two-image VLM SFT example:

```json
{
  "messages": [
    {"role": "user", "content": [
      {"type": "image", "image": "images/dhaka_bangladesh/2024-08-15/rgb.png"},
      {"type": "image", "image": "images/dhaka_bangladesh/2024-08-15/swir.png"},
      {"type": "text", "text": "Label this tile..."}
    ]},
    {"role": "assistant", "content": [
      {"type": "text", "text": "{\"flood_present\": true, \"flood_severity\": \"moderate\", ...}"}
    ]}
  ]
}
```

## 4. Upload to Modal

```bash
deno task upload
```

Creates the Modal volume `finetune-flood` (idempotent), then uploads:

- both JSONLs to `/data/`
- the `data/images/` tree to `/data/images/`

Re-run after every `build` — Modal stores immutable snapshots.

## 5. Fine-tune on Modal

Clone leap-finetune *next to* this directory (just like `finetune-quixote`):

```bash
cd ..
git clone https://github.com/Liquid4All/leap-finetune
cd leap-finetune
uv sync
uv run leap-finetune ../finetune-flood/configs/flood_modal.yaml
```

### Why full fine-tune, not LoRA

`peft_config.use_peft: false` in the YAML. Pau's wildfire experience: the multimodal projector has to genuinely re-learn how to map satellite multispectral patches to useful tokens because they're so far out of distribution from the base VLM's pretraining mix. LoRA on top of a frozen projector is not enough. At 450M, full FT fits comfortably on a single H100.

### Watching the run

| Where | What it shows |
|---|---|
| Original `uv run leap-finetune` terminal | CLI output, full logs streaming live |
| Modal dashboard → app → **Logs** | Same logs, persisted, searchable |
| Trackio URL printed in the logs | Live `train/loss`, `eval/loss`, learning rate |

Expect ~30–60 min wall time on H100 for ~200 samples × 3 epochs.

## 6. Pull the merged model

```bash
deno task pull                       # list runs at the volume root
deno task pull --run <run-name>      # download
```

With full fine-tuning the merged weights live directly under the run dir (no nested `-lora_m-`, unlike LoRA training).

## 7. Evaluate

Before *and* after training, run the eval pipeline against the labeled data so you know whether the schema, the labeler, and (later) the fine-tuned model actually work.

```bash
# Sanity check: re-run the labeler on its own ground truth.
# Should be ≥0.95 overall — anything lower means the schema is too noisy
# or the labeler is non-deterministic in a way that hurts training.
deno task eval --raw data/raw/<run-ts> --backend anthropic --model claude-opus-4-6

# Eval base LFM2.5-VL-450M before fine-tuning (run llama-server first):
#   llama-server -hf LiquidAI/LFM2.5-VL-450M-GGUF:Q8_0 --port 8080
deno task eval --raw data/raw/<run-ts> --backend local --url http://localhost:8080 --name "lfm2.5-vl-450m base"

# Eval the fine-tuned model after package step 8:
#   llama-server -m outputs/lfm2-flood-Q4_0.gguf --mmproj outputs/mmproj-lfm2-flood-F16.gguf --port 8080
deno task eval --raw data/raw/<run-ts> --backend local --url http://localhost:8080 --name "lfm2-flood Q4_0"

# Compare every saved run side-by-side.
deno task eval:compare
```

Each eval writes `evals/<run-ts>/{report.md,results.json,meta.json}`. The expected progression matches Pau Labarta Bajo's wildfire pattern:

| | claude-opus-4-6 (oracle) | LFM2.5-VL-450M base | LFM2.5-VL-450M fine-tuned |
|---|---|---|---|
| valid_json | ~1.00 | ~1.00 | ~1.00 |
| fields_present | ~1.00 | ~1.00 | ~1.00 |
| overall | ~0.95 (sanity floor, non-determinism) | ~0.30–0.50 (zero-shot on satellite) | target ≥0.80 |

If the base model's `overall` is unexpectedly *high*, the schema is too easy (e.g. all tiles are non-flood). Add more event-window samples. If it's near 0 even after fine-tuning, check that `valid_json` is high — the model may be returning prose instead of JSON, in which case generation parameters or the prompt suffix need attention.

## 8. Package: backbone + mmproj GGUF

```bash
deno task package
```

Produces both pieces a VLM needs for inference:

- `outputs/lfm2-flood-Q4_0.gguf` — quantized language-model backbone (~210 MB)
- `outputs/mmproj-lfm2-flood-F16.gguf` — vision tower + projector, always F16

Useful flags:

```bash
deno task package --quant Q5_K_M     # better quality, ~280 MB
deno task package --quant Q8_0       # near-lossless, ~530 MB
deno task package --keepF16          # keep the f16 backbone
deno task package --force            # rebuild even if files exist
```

## 9. Run inference

Ollama can't currently bundle the mmproj cleanly for LFM2-VL, so we use `llama-server` directly:

```bash
llama-server \
  -m outputs/lfm2-flood-Q4_0.gguf \
  --mmproj outputs/mmproj-lfm2-flood-F16.gguf \
  --port 8080
```

The web UI is at http://localhost:8080. The OpenAI-compatible API:

```bash
curl -s http://localhost:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "lfm2-flood",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,<rgb_b64>"}},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,<swir_b64>"}},
        {"type": "text", "text": "Label this tile."}
      ]
    }]
  }'
```

## File map

```
finetune-flood/
├── deno.json              tasks + import map
├── .env.example           ANTHROPIC_API_KEY, SIMSAT_BASE_URL
├── src/
│   ├── locations.ts       curated flood-prone locations (deltas, monsoon belts, hurricane coasts)
│   ├── prompts.ts         labeler system prompt + flood JSON schema
│   ├── simsat.ts          SimSat HTTP client (RGB + NIR fetch)
│   ├── generate.ts        SimSat fetch → Claude vision label → tile dirs
│   ├── build_dataset.ts   walk tile dirs → vlm_sft JSONL with image content blocks
│   ├── upload_to_modal.ts modal volume create + put (JSONLs + images tree)
│   ├── pull_checkpoints.ts modal volume ls / get
│   ├── package.ts         convert HF → backbone GGUF + mmproj GGUF
│   ├── evaluate.ts        run a backend (anthropic | llama-server) against labeled tiles
│   ├── eval_compare.ts    side-by-side accuracy table across saved eval runs
│   └── preview.ts         sanity-check the built dataset
├── configs/
│   └── flood_modal.yaml   leap-finetune config (vlm_sft, full fine-tune, Modal H100)
├── data/                  generated, gitignored
└── outputs/               GGUF pair + merged model, gitignored
```
