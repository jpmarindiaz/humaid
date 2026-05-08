# simsat (clone here)

This directory is intentionally **empty in the repo** — clone the upstream simulator into it.

## What goes here

[SimSat](https://github.com/DPhi-Space/SimSat) — DPhi Space's official satellite simulator for the AI-in-Space hackathon. It's a Docker service that proxies AWS Element84 STAC and serves Sentinel-2 imagery (and Mapbox imagery) for any (lon, lat, timestamp). [`finetune-flood/`](../finetune-flood/) calls into this simulator at `http://localhost:9005` to build the training set.

We don't bundle SimSat in this repo because:
- It's a third-party project with its own license and release cadence
- We don't want to drift from upstream
- The repo stays small (no third-party Docker images or assets)

## Clone it

From the `humaid/` repo root:

```bash
# (this directory is gitignored except for this README)
cd simsat/
rm -f README.md     # remove this stub, the upstream README replaces it
cd ..
rmdir simsat        # remove the empty dir
git clone https://github.com/DPhi-Space/SimSat.git simsat
```

Or if you'd rather keep this README:

```bash
git clone https://github.com/DPhi-Space/SimSat.git /tmp/SimSat
cp -R /tmp/SimSat/. simsat/
# overwrites README.md with the upstream one — that's fine
rm -rf /tmp/SimSat
```

## Run it

The upstream README has the full instructions. Quick version:

```bash
cd simsat
docker compose up
```

Open http://localhost:8000 (dashboard) and click Start. The data API is on http://localhost:9005.

If you put your Mapbox token in `humaid/.env` as `MAPBOX_ACCESS_TOKEN=...`, run with:

```bash
cd simsat
docker compose --env-file ../.env up
```

## Why this dir exists at all

The flood-detection finetuning pipeline ([`../finetune-flood/`](../finetune-flood/)) defaults to `SIMSAT_BASE_URL=http://localhost:9005` (configurable via `.env`). So as long as SimSat is running on port 9005, the rest of the project works regardless of where simsat is actually cloned. Putting it as a sibling directory just keeps everything together.

## Pointers

- Upstream: https://github.com/DPhi-Space/SimSat
- Hackathon page: https://luma.com/n9cw58h0
- How this project uses SimSat: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#stage-1--data-source-simsat)
