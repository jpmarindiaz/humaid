# app/ — live demo for the fine-tuned flood model

Tiny single-file Hono app for testing the fine-tuned model interactively. Mirrors the [`deno-deploy-llamacpp`](https://github.com/jpmarindiaz/liquid-ai-in-space/tree/main/deno-deploy-llamacpp) pattern but doesn't bundle or spawn `llama-server` — it just connects to the one you've already started locally.

## What it does

Two modes, one page:

1. **Fetch from SimSat** — pick a location (one of the 14 in `src/locations.ts`) and two dates (baseline + current). The app fetches RGB + SWIR for each date from the running SimSat (port 9005), sends the 4 images to the running llama-server (port 8765), and renders the JSON labels.

2. **Upload images** — drop in 4 PNGs (baseline RGB, baseline SWIR, current RGB, current SWIR) and get the same labels.

The result panel shows:
- The 7 schema fields as colored badges (green = no flood, yellow = quality-limited or moderate, red = severe / population affected)
- The four input images side-by-side (when fetched from SimSat)
- Capture metadata (source satellite, capture datetime, cloud cover) for both timestamps
- Inference latency
- The raw JSON for inspection

## Running it

Three things need to be up:

```bash
# 1. SimSat (in simsat/, separate terminal)
docker compose --env-file ../.env up -d

# 2. llama-server with the fine-tuned GGUFs (in finetune-flood/, separate terminal)
deno task serve

# 3. The app (in finetune-flood/, this terminal)
deno task app
```

Open http://localhost:8081.

The header shows live status of both backends — if either is down it says so, and the SimSat fetch tab will fail gracefully with the actual error.

## Configuration

Env vars (read from `finetune-flood/.env` via `deno task app`):

| var | default | purpose |
|---|---|---|
| `PORT` | `8081` | port the app listens on |
| `LLAMA_URL` | `http://localhost:8765` | where the GGUF is hosted |
| `SIMSAT_BASE_URL` | `http://localhost:9005` | where the satellite simulator is |

## Endpoints

| method + path | what |
|---|---|
| `GET /` | the HTML page |
| `GET /health` | JSON: llama-server status + simsat reachability |
| `GET /locations` | JSON: the 14 curated flood-prone locations from `src/locations.ts` |
| `POST /predict` | multipart with `pre_rgb`, `pre_swir`, `cur_rgb`, `cur_swir` PNG files → JSON labels + latency |
| `POST /fetch-and-predict` | JSON `{location_id, baseline_date, current_date}` (or `lon, lat, baseline_date, current_date`) → JSON labels + 4 base64 images + capture metadata |

The app is deliberately uncomplicated — single 500-line file, no bundler, no React, no Tailwind. Inline `<style>` and `<script>` in one HTML template. Hono handles the routing, `src/simsat.ts` does the SimSat client, `src/prompts.ts` provides the schema, and llama-server does the inference.

## Caveats

- **The fine-tuned model is paused.** It scores 0.55 overall on our pair-labeled eval set vs an oracle ceiling of 0.68 — better than the base 0.44 but not deployable. See [`../REPORT.md`](../REPORT.md) and [`../docs/05-findings.md`](../docs/05-findings.md). The app exists to interactively probe model behavior, not to be a flood-alert system.

- **The model has a strong cloud prior** because most training tiles were cloud-limited. It tends to set `image_quality_limited=true` and conservatively label `flood_severity=none` even when the visible imagery clearly shows flooding. Try San Jacinto del Cauca with `2024-04-19 → 2024-05-07` (the Cara de Gato breach) for the cleanest qualitative behavior.

- **No spawning, just connecting.** The app does not start `llama-server` itself (unlike `deno-deploy-llamacpp`). You must run `deno task serve` separately first.
