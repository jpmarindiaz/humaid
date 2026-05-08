# 04 · Evaluation

## What we measure

For each evaluation backend we send the same 4-image pair input the labelers saw, parse the predicted JSON, and compare it field-by-field against the ground-truth `annotation.json`. The 7 fields are:

```
flood_present, flood_severity, water_coverage_pct_estimate,
populated_area_affected, infrastructure_at_risk, river_overflow_visible,
image_quality_limited
```

Plus two structural metrics:

- `valid_json` — did the response parse as JSON at all
- `fields_present` — did all 7 keys exist in the parsed JSON

Per-field accuracy is exact match (booleans, enums, strings — no fuzzy matching). Overall is the macro-average across the 7 fields.

## Two backends

### Anthropic backend (oracle / labeler self-consistency)

Sends 4 images via the Anthropic API as `{type: "image", source: {type: "base64", ...}}` content blocks. Forces the model to emit our schema via `tool_use` with `input_schema = FLOOD_LABEL_SCHEMA`. The tool name is `report_flood_assessment`. The model's `tool_use` block's `input` is the prediction.

Use cases:
- **Self-consistency check.** Run with the same model class that did the labeling (Opus 4.6/4.7). Numbers below 1.00 quantify the labeler's intrinsic noise.
- **Cross-model comparison.** Sonnet vs Opus vs anything else.

### Local (llama-server) backend

Sends 4 images as `{type: "image_url", image_url: {url: "data:image/png;base64,..."}}` content blocks via OpenAI-compatible `/v1/chat/completions`. Uses llama.cpp's `response_format: {type: "json_schema", json_schema: ...}` for grammar-constrained generation, **plus** an explicit schema in the user prompt as backup.

Use cases:
- **Base model baseline** before fine-tune (host LFM2.5-VL-450M GGUF + mmproj on llama-server).
- **Fine-tuned model evaluation** after `package.ts` produces backbone + mmproj GGUFs.

## The bug we caught

The first base-model eval scored **0.00 overall** with `fields_present=0.00`. That's not because the model is bad — it's because **the prompt didn't tell the model what schema to emit**. The Anthropic backend gets the schema via `tool_use`. The local backend was getting only a prose system prompt and a "reply with JSON" instruction. The base LFM2.5-VL improvised key names like `tile_pair`, `current_window`, `swir_baseline`. The eval correctly scored those as 0/7.

After injecting the explicit schema into the user prompt and adding `response_format: json_schema` (which llama-cpp grammar-constrains), the score jumped to **0.44 overall, 0.66 on flood_present** — same ballpark as Pau's wildfire 0.38 baseline.

This is a real bug. If we'd fine-tuned without catching it, we'd have shipped a misleading "look how much fine-tuning improved things" claim. The fine-tuning vs base comparison would have been against a baseline crippled by missing schema info, not a fair zero-shot.

The fix is in `src/evaluate.ts:llamaServerBackend` — we now always send a `schemaInstruction` block plus `response_format`. For consistency, we should add the same prompt structure to `generate.ts` if it ever uses local backend, but currently `generate.ts` only labels via Anthropic.

## Output: `evals/<timestamp>/`

Each run gets a fresh dir (timestamp from `Date.now()`). Three artifacts:

- **`meta.json`** — run config and aggregated metrics. Stable schema, used by `eval_compare.ts` to build the comparison table.
- **`results.json`** — per-sample records: `id`, `ground_truth`, `prediction`, `error?`, `latency_s`, `matches.{valid_json, fields_present, per_field}`. Enough to debug any single sample.
- **`report.md`** — human-readable per-run report:
  - Accuracy table (same as before)
  - Most-disagreed fields with example mismatches (top 3 fields, top 5 samples each)
  - Worst samples (5 with the most mismatched fields), with paths to the source images so a human can judge whether the labeler or the predictor was wrong

The `report.md` enrichment makes it possible to read a single eval run and immediately see *where* the model is failing — not just the aggregate number.

## Running evals

```bash
# Anthropic oracle (full set)
deno task eval --raw data/raw/20260508_070216 \
  --backend anthropic --model claude-opus-4-6 --concurrency 3 \
  --name "opus oracle"

# Anthropic on a smaller subset (cost control)
deno task eval --raw data/raw/20260508_070216 \
  --backend anthropic --model claude-sonnet-4-6 --limit 30 \
  --name "sonnet quick"

# Local llama-server (base or fine-tuned LFM2.5-VL)
deno task eval --raw data/raw/20260508_070216 \
  --backend local --url http://localhost:8765 --model lfm2.5-vl-450m-base \
  --name "lfm2.5 base (Q4_0)"

# Compare runs side-by-side
deno task eval:compare
deno task eval:compare --run 20260508_121838 --run 20260508_123250
```

## Standing up llama-server for evals

```bash
llama-server \
  -m /path/to/LFM2.5-VL-450M-Q4_0.gguf \
  --mmproj /path/to/mmproj-LFM2.5-VL-450m-Q8_0.gguf \
  --host 127.0.0.1 --port 8765 \
  -c 8192 -t 4
```

Context window matters: 4 images × ~512–1024 visual tokens each = 2k–4k tokens of image content. The default 2048 will OOM. We use 8192.

## What "good" looks like at fine-tune eval time

Reasonable expectations after a successful full fine-tune (full FT not LoRA, per Pau's wildfire experience):

| metric | base (no FT) | post-FT target | rationale |
|---|---:|---:|---|
| valid_json | 1.00 | 1.00 | grammar-constrained |
| fields_present | 1.00 | 1.00 | constrained by schema |
| flood_present | 0.66 | ≥0.80 | binary, easiest to learn |
| flood_severity | 0.29 | ≥0.50 | hard enum, ceiling = oracle's 0.43 |
| water_coverage_pct_estimate | 0.37 | ≥0.55 | hard enum |
| populated/infra/overflow | 0.50–0.60 | ≥0.65 | binary, capped by labeler noise |
| image_quality_limited | 0.10 | ≥0.70 | abstention behavior |
| **overall** | **0.44** | **≥0.65** | match the oracle |
| latency | 0.53s | 0.55s | unchanged (same model size) |

The hard ceiling for the student is the labeler's self-consistency (0.66–0.68). Beating that requires either better labelers or a less ambiguous schema.
