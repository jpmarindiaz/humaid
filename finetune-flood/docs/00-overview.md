# 00 · Overview

`finetune-flood` is the end-to-end pipeline we built to fine-tune `LiquidAI/LFM2.5-VL-450M` on Sentinel-2 satellite imagery for flood detection. The model is intended to run on a satellite (or any low-resource node) and downlink only a small JSON payload, not raw imagery — same premise as Pau Labarta Bajo's wildfire-prevention example.

## Why this project exists

- **Operational humanitarian use case.** Colombia's La Mojana region (Depresión Momposina) suffers chronic dike-failure flooding (Cara de Gato breaches 2021, 2024, 2025; Los Arrastres 2024; multiple peak inundations). Putumayo deals with both Andean-Amazon riverine flooding and the catastrophic Mocoa avalancha torrencial of 2017. Local authorities (UNGRD, Defensa Civil) and humanitarian responders (OCHA, ACAPS) need rapid post-event flood-extent assessments.
- **Frontier-model API-call latency + cost is the bottleneck.** Sending raw satellite imagery to Claude/GPT/Gemini for assessment is fine for one tile but breaks at scale. A 450M-parameter VLM running in-orbit on the satellite can produce the same JSON for ~zero marginal cost, and only the JSON downlinks.
- **Pau's wildfire example proved the recipe.** Same backend (Modal H100 + leap-finetune), same model. We swapped the domain.

## What's different from Pau's wildfire

| Wildfire example | This project |
|---|---|
| Single-tile input (RGB + SWIR for one timestamp) | **Pair input** (RGB+SWIR baseline + RGB+SWIR current) |
| Risk factors are visible in *current* tile (dry vegetation, urban interface) | Flood vs no-flood requires comparison against baseline (chronic wetlands look identical to floods) |
| Python orchestration in cookbook style | **Deno/TypeScript** orchestration, mirror of `finetune-quixote` shape |
| Anthropic API for labeling | **Claude Code agents** (in-conversation) for labeling, no API spend |
| Random spatial-tile + temporal-tile sampling | Event-anchored windows (pre/event/post triplets around documented dike breaches) |
| Concurrency 4, no retry | Concurrency 2 + parallel candidate probes + retry/backoff (SimSat is the bottleneck) |

## Outcome (May 2026)

We built the full pipeline, labeled 115 pair samples across 9 events, ran a base-model baseline + Opus oracle, and **decided not to fine-tune**. Reasons in [`05-findings.md`](05-findings.md). The data and code stay in the repo; the wrap-up report is at [`../REPORT.md`](../REPORT.md).

## Map of this docs folder

- [`00-overview.md`](00-overview.md) — you are here
- [`01-pipeline.md`](01-pipeline.md) — the architecture: SimSat → fetch → label → JSONL → Modal → GGUF → llama-server
- [`02-data-collection.md`](02-data-collection.md) — locations, events, SimSat client, candidate sweep, cloud handling
- [`03-labeling.md`](03-labeling.md) — pair structure, schema, why we use Claude Code agents
- [`04-evaluation.md`](04-evaluation.md) — eval methodology, the schema-injection bug we fixed, scoring
- [`05-findings.md`](05-findings.md) — the journey, the noise floor, the cloud problem, why we stopped
