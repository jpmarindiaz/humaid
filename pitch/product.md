# Product

Three components. Each one usable on its own. Together, a closed loop from satellite to family.

## Component 1 — Satellite-resident detection model

**What it is.** A fine-tuned LFM2.5-VL-450M VLM running on a CubeSat or hosted-payload satellite. Ingests a Sentinel-1 SAR or Sentinel-2 multispectral tile + a baseline (pre-event) tile. Emits a structured JSON payload.

**The payload schema** (see `research/flood-tagging-and-reference-points.md`):

```json
{
  "flood_present": true,
  "flood_type": "dike_levee_breach",
  "flood_severity": "severe",
  "water_coverage_pct_estimate": "30-60%",
  "water_type": "new_flood",
  "populated_area_affected": true,
  "infrastructure_at_risk": true,
  "infrastructure_types": ["road", "bridge"],
  "river_overflow_visible": true,
  "dike_or_levee_breach_visible": true,
  "land_cover_affected": ["cropland", "wetland"],
  "tile_bbox": [-74.85, 8.10, -74.55, 8.40],
  "admin1": "Bolívar",
  "admin2": "San Jacinto del Cauca",
  "sensor_type": "SAR",
  "platform": "Sentinel-1",
  "acquisition_date": "2026-08-27",
  "tagger_confidence": 0.84
}
```

~200 bytes of payload that **uniquely identifies a flood event in space and time** with enough metadata for downstream automation. The full satellite tile is megabytes; this is a tweet.

**Status.** Pipeline built. 115 labelled pair samples across 9 La Mojana / Putumayo events. Fine-tune currently paused — Sentinel-2 alone proved too cloud-bound; Sentinel-1 SAR re-attempt is a ~2-week swap of one client file. Code reusable. ([finetune-flood/REPORT.md](../finetune-flood/REPORT.md))

## Component 2 — Community station + sync layer

**What it is.** A solar-tolerant low-power node (Raspberry Pi 5 class) at a community focal point — JAC, school, clinic, alcaldía, *casa de la cultura*. Receives JSON alerts via radio, satellite uplink, or SMS gateway. Hosts the local-network sync service.

**What runs on it:**
- DuckDB-based knowledge base with the 471 Q&A pairs
- Nomic embedding index for semantic retrieval
- Pre-synced past-incident archive for the catchment
- Local-first sync protocol for laptops and phones connecting via Wi-Fi

**Why a station rather than just an app.** Battery and storage. A community station charged when the grid worked can serve dozens of devices for days during the outage. It's the offline analog of the cell tower.

**Status.** Not yet built. Hardware spec drafted. The knowledge base + retrieval that runs on it is built and committed (`knowledge-base/`).

## Component 3 — Local app

**What it is.** Desktop / mobile / web client. Connects to the community station or runs entirely standalone with a pre-synced bundle.

**Personalisation axes:**

| Axis | Values |
|---|---|
| Role | local-community, local-authority, national-authorities, humanitarian-staff, ngos, first-respondants |
| Phase | pre, event, post |
| Region | la-mojana, putumayo, generic — adjustable per location |

So a parent in Mocoa during an active landslide alert sees a different first screen than a Cruz Roja socorrista in San Benito Abad post-event. Same underlying knowledge base. Different default queries, different prioritised cards, different language register.

**Sample queries the local app answers in <1 second, offline:**

- "Cómo evacúo si el río sube de noche?"
- "Quién es el coordinador de WASH para Sucre?"
- "Cuántos niños hay en la vereda Sincelejito según el censo?"
- "Cuándo declarar Calamidad Pública?" (local-authority view)
- "What triage protocol do I use when there are 100+ injured?" (first-responder view)
- "Where is the nearest *albergue* with capacity?" (community view)

Every answer comes with **citations back to the source PDFs in the research corpus** — accountability stays intact. No hallucinated content, no broken trust.

**Status.** Knowledge base ready. App not yet built — figma stage.

## How the three talk to each other

```
[Satellite]
  └── ~200-byte JSON alert
        └── radio / sat link / SMS gateway
              └── [Community station]
                    ├── stores the alert
                    ├── matches it against pre-synced playbooks
                    │   for this lon/lat × this region × this severity
                    ├── pushes a notification to nearby devices
                    └── serves Q&A retrieval over LAN
                          └── [Local app on user's phone]
                                ├── shows the alert + map context
                                ├── shows next-action cards by role/phase
                                └── allows free-text Q&A → grounded answers
```

Every link can fail without taking the next one down. That's the design.

## The events-map sample showcase

[`events-map/`](../events-map/) is the **first user-facing artefact**: a static Mapbox viewer that turns the historical event record into something legible at a glance. Same database that the local app's "past incidents at this location" view will consume. Already deployable to a static site for the public-facing version of the website. ([events-map/README.md](../events-map/README.md))
