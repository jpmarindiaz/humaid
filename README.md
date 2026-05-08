# humaid

**Offline-first humanitarian-response toolkit for flood crises.**

When a flood hits a remote community, two things break at once: the people on the ground need fast, specific information about *what to do* — and the internet that would normally deliver that information goes down with the power and the cell towers. humaid pre-syncs the response knowledge before the crisis, generates the alert from space, and runs the whole thing without a network once it's in your hands.

## What we're building

```
                                   SPACE
                       ┌─────────────────────────────┐
                       │  small VLM on satellite     │
                       │  (LFM2.5-VL-450M, ~450 MB)  │
                       │   Sentinel-2 / Sentinel-1   │
                       │   image  →  small JSON      │
                       │   payload (~200 bytes)      │
                       └──────────────┬──────────────┘
                                      │ tiny payload
                                      │ (low-bandwidth ground link)
                                      ▼
            ┌──────────────────────── EARTH ───────────────────────────┐
            │                                                          │
            │  ┌────────────────┐         ┌────────────────────────┐   │
            │  │ Community      │         │  Local app             │   │
            │  │ station        │ ◄────►  │  (desktop / mobile)    │   │
            │  │ (sync hub)     │ offline │  - role-personalized   │   │
            │  │                │  LAN    │  - SOPs, evac routes,  │   │
            │  │ - receives     │         │    contacts, history   │   │
            │  │   payloads     │         │  - past incidents at   │   │
            │  │ - serves       │         │    THIS location       │   │
            │  │   knowledge    │         │  - works offline once  │   │
            │  │   base         │         │    pre-synced          │   │
            │  └────────────────┘         └────────────────────────┘   │
            │                                                          │
            └──────────────────────────────────────────────────────────┘
```

Three components, each currently at a different maturity:

1. **Satellite-resident detection model** — small VLM that turns multispectral satellite imagery into a structured JSON alert. Cheap enough to run on a CubeSat, small enough to downlink only the JSON not the imagery. *Status: pipeline built, fine-tune paused — see [`finetune-flood/REPORT.md`](finetune-flood/REPORT.md).*

2. **Community station + sync layer** — a low-power node (Raspberry Pi class) at a school, clinic, or town hall. Receives JSON alert payloads, hosts the synced knowledge base on its local network. *Status: not yet built.*

3. **Local app** — desktop/mobile client that gets pre-synced before the crisis with: standard operating procedures (SOPs), past incidents at this exact location, evacuation routes, contact lists for first responders. Personalized by the user's role: a community leader sees triage and shelter coordination; a farmer sees livestock and cropland actions; a parent sees school evacuation and child-specific protocols. Works offline once synced. *Status: not yet built.*

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

## What this repo contains

```
humaid/
├── finetune-flood/       The flood-detection model: data + labeling + eval pipeline.
│                         End-to-end Deno/TS orchestration around SimSat (data),
│                         Claude Code agents (labeling), and leap-finetune
│                         (training, on Modal H100). Currently paused — see
│                         finetune-flood/REPORT.md for findings + the case for
│                         switching to Sentinel-1 SAR before resuming.
│
├── simsat/               The DPhi Space Sentinel-2 simulator (cloned).
│                         Docker service that proxies AWS Element84 STAC and
│                         serves Sentinel-2 imagery from any (lon, lat, timestamp).
│                         Used by finetune-flood/src/generate.ts to build the
│                         training set without burning live satellite quota.
│
├── knowledge-base/       Local-app knowledge base (SOPs, past incidents,
│                         evacuation routes, role-specific actions).
│                         Status: skeleton only.
│
├── events-map/           Geographic + temporal index of historical flood events
│                         used to ground the labeling and the knowledge base.
│                         Status: skeleton only.
│
├── research/             Domain research that grounds the project:
│                         - Sentinel-2 capabilities (flood-sentinel-2.md)
│                         - Tagging schema + La Mojana / Putumayo anchor
│                           points (flood-tagging-and-reference-points.md)
│                         - Liquid AI cookbook clone (liquidai/cookbook/)
│                         - Talk transcripts (videos/)
│
├── docs/                 Cross-cutting docs:
│                         - ollama-publishing.md (how we pushed the base
│                           LFM2.5-VL to Ollama Hub for community-station fallback)
│
├── Modelfile             The Ollama Modelfile we built en route to the
│                         published lfm2.5-vl-450m model.
│
└── README.md             You are here.
```

## What we've done so far

A linear log of the project journey:

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

## What we're going to build next

In rough priority order:

- **`knowledge-base/` content + format.** Markdown-with-frontmatter SOPs, indexed by location + role. The skeleton dir exists; needs structure spec and seed content for a first pilot region.
- **Local app shell.** Desktop (Tauri or Electron) + offline-capable mobile (Flutter or React Native). Bundles the knowledge base, listens for alerts on the LAN.
- **Community-station daemon.** Receives JSON alert payloads (over satcom or any low-bandwidth link), serves them + the synced knowledge base over a local network. Raspberry Pi class.
- **Role/profile system.** Each user's identity decides what subset of the knowledge base they see — community leader, farmer, parent, first responder, school director. Triggered actions are role-specific.
- **Better satellite data.** Sentinel-1 SAR pipeline (Copernicus Open Access Hub or Microsoft Planetary Computer) so the cloud problem stops blocking model training.

## Pointers

- **Flood model report** — [`finetune-flood/REPORT.md`](finetune-flood/REPORT.md)
- **Flood model process docs** — [`finetune-flood/docs/`](finetune-flood/docs/) (overview, pipeline, data collection, labeling, evaluation, findings)
- **Ollama publishing walkthrough** — [`docs/dev_notes/ollama-publishing.md`](docs/dev_notes/ollama-publishing.md)
- **Domain research** — [`research/`](research/), especially `flood-sentinel-2.md` and `flood-tagging-and-reference-points.md`
- **Liquid AI cookbook clone (wildfire reference)** — [`research/liquidai/cookbook/examples/wildfire-prevention/`](research/liquidai/cookbook/examples/wildfire-prevention/)
- **Simulator** — [`simsat/`](simsat/)
