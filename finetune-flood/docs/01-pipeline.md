# 01 · Pipeline

End-to-end architecture. The orchestration is Deno/TypeScript; the GPU work runs on Modal via `leap-finetune`; data comes from a local Docker (SimSat).

## Diagram

```
                   ┌────────────────────────────────────────────┐
                   │              FINETUNE-FLOOD                │
                   │  (Deno + TypeScript)                       │
                   │                                            │
   SimSat ──HTTP─► │  generate.ts                               │
   (Docker)        │     fetches RGB + SWIR pairs at            │
                   │     candidate dates, picks lowest-cloud,   │
                   │     writes data/raw/<run>/<loc>/<window>/  │
                   │                                            │
                   │      │                                     │
                   │      ▼                                     │
                   │  label_agents.ts                           │
                   │     scans data/raw/* for unlabeled         │
                   │     (pre, current) pairs, writes a         │
                   │     manifest.json with the paths           │
                   │                                            │
                   │      │ (manifest)                          │
                   │      ▼                                     │
   Claude Code ◄───┤  Agent dispatches (in-conversation)        │
                   │     each agent reads 4 PNGs + meta,        │
                   │     applies prompts.ts schema, writes      │
                   │     annotation.json next to current tile   │
                   │                                            │
                   │      │                                     │
                   │      ▼                                     │
                   │  build_dataset.ts                          │
                   │     dedupes (loc, event, window),          │
                   │     temporal train/eval split,             │
                   │     writes data/flood_train.jsonl + eval   │
                   │     mirrors images to data/images/         │
                   │                                            │
                   │      │                                     │
                   │      ▼                                     │
                   │  upload_to_modal.ts                        │
                   │     pushes JSONLs + image tree to Modal    │
                   │     volume "finetune-flood"                │
                   └─────────────────┼──────────────────────────┘
                                     │
                                     ▼
                   ┌────────────────────────────────────────────┐
                   │             leap-finetune                  │
                   │  (cloned separately, runs on Modal H100)   │
                   │     reads JSONL + images from volume,      │
                   │     vlm_sft full-fine-tune,                │
                   │     writes checkpoints to same volume      │
                   └─────────────────┼──────────────────────────┘
                                     │
                                     ▼
                   ┌────────────────────────────────────────────┐
                   │  pull_checkpoints.ts                       │
                   │     downloads merged HF model              │
                   │                                            │
                   │  package.ts                                │
                   │     convert_hf_to_gguf → backbone GGUF     │
                   │     convert_hf_to_gguf --mmproj → vision   │
                   │     llama-quantize → Q4_0 / Q5_K_M / etc.  │
                   │                                            │
                   │  llama-server -m backbone --mmproj mmproj  │
                   │     OpenAI-compatible API                  │
                   │                                            │
                   │  evaluate.ts                               │
                   │     compares predictions vs ground-truth   │
                   │     against agent labels in data/raw/      │
                   │     writes evals/<ts>/{report.md, ...}     │
                   └────────────────────────────────────────────┘
```

## Component summary

| Module | Purpose | LOC |
|---|---|--:|
| `simsat.ts` | Typed client for SimSat data API; retry + backoff | 90 |
| `locations.ts` | 14 curated flood-prone locations across La Mojana + Putumayo | 35 |
| `events.ts` | 9 event anchors with pre/event/post candidate-date sweep | 80 |
| `prompts.ts` | System prompt + USER_PROMPT + JSON schema | 95 |
| `generate.ts` | Per-window candidate sweep + best-cloud pick + RGB+SWIR fetch | 280 |
| `pairs.ts` | (location, event) → (pre, current) pair grouping | 110 |
| `label_agents.ts` | Build pair manifest (or singles) from raw dirs | 110 |
| `agent_prompt_section.ts` | Print per-pair prompt section from manifest slice | 45 |
| `build_dataset.ts` | Walk pair annotations → vlm_sft 4-image JSONL | 175 |
| `upload_to_modal.ts` | `modal volume create` + `put` for JSONL + image tree | 60 |
| `pull_checkpoints.ts` | `modal volume ls/get` for trained run | 55 |
| `package.ts` | HF → backbone GGUF + mmproj GGUF | 230 |
| `evaluate.ts` | anthropic + llama-server backends, schema-injected | 320 |
| `eval_compare.ts` | Side-by-side accuracy table across runs | 120 |
| `preview.ts` | Sanity-check built dataset | 30 |

## Why Deno

- The orchestration has a lot of small async tasks (HTTP fetches, file I/O, Anthropic API, modal CLI invocations, agent dispatch). All native in Deno.
- Single-file scripts with deno tasks instead of a Python project + venv.
- Same shape as `finetune-quixote` (Liquid AI's Spanish-style fine-tune example) so the orchestration is portable.
- Pau's wildfire example uses Python; this is the Deno equivalent.

## Why "agents" not Anthropic API for labeling

Initially the plan was direct Anthropic API for labeling (cheaper at scale than Claude Code agents). But for the development cycle — iterating on the schema, looking at edge cases, regional context — Claude Code agents in-conversation are faster:

- No API key management or env setup
- Each agent gets the same calibration prompt and dispatched in parallel from the conversation
- Cost flows through Claude Code subscription, not separate Anthropic API budget
- Agents can be cancelled and restarted instantly

For production-scale labeling (1000+ tiles), switch back to Anthropic API + `tool_use` enforcement. The code path is in `evaluate.ts:anthropicBackend()`.
