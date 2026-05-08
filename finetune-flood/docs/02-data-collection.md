# 02 · Data collection

## Source: SimSat (Sentinel-2 only)

We use the [DPhi-Space SimSat](https://github.com/DPhi-Space/SimSat) Docker simulator — it proxies AWS Element84 STAC and serves Sentinel-2 imagery from any (lon, lat, timestamp). It's the simulator used for the Liquid AI × DPhi Space hackathon.

The trade-off: SimSat exposes only **Sentinel-2** (optical, multispectral). For La Mojana flood detection, the operational tool is **Sentinel-1 SAR** (cloud-independent, what CopernicusLAC uses). Sentinel-2 is fine for clear-weather wildfires but loses ~50% of acquisitions to clouds in tropical wet seasons. This shapes everything that follows.

## Locations (14)

Two regions, with locations chosen from the project's `research/flood-tagging-and-reference-points.md`:

**La Mojana / Depresión Momposina** (chronic dike-failure flooding, ~8.5°N 75.0°W):

| id | Municipality | Why |
|---|---|---|
| `san_jacinto_del_cauca` | San Jacinto del Cauca, Bolívar | Site of Cara de Gato dike — primary breach location |
| `ayapel` | Ayapel, Córdoba | 2024: 23% muni + 44% cropland flooded |
| `san_benito_abad` | San Benito Abad, Sucre | 2024: 29% muni + 35% cropland flooded |
| `guaranda` | Guaranda, Sucre | Caño Rabón > 3.6m in 2025 |
| `majagual` | Majagual, Sucre | Sincelejito hub |
| `caimito` | Caimito, Sucre | Persistent encharcamientos |
| `sucre_cabecera` | Sucre cabecera | Departmental seat impact |
| `san_marcos` | San Marcos, Sucre | Secondary impact zone |

**Putumayo** (Andean–Amazon flash-flood + lowland riverine):

| id | Location | Why |
|---|---|---|
| `mocoa` | Mocoa | 2017 avalancha torrencial — 6 watercourses, 17 barrios destroyed |
| `puerto_asis` | Puerto Asís | 2025 calamidad pública |
| `puerto_guzman` | Puerto Guzmán | 2025 calamidad pública |
| `colon_putumayo` | Colón | Alto Putumayo, 2025 affected |
| `santiago_putumayo` | Santiago | Alto Putumayo, 2025 affected |
| `puerto_leguizamo` | Puerto Leguízamo | 2025-04-10 calamidad pública (Río Putumayo) |

Coordinates and notes are in `src/locations.ts`.

## Events (9)

We anchor temporal sampling on documented events rather than picking dates uniformly across a year. This concentrates labels around moments of high signal.

| id | Date | Region | Notes |
|---|---|---|---|
| `cara_de_gato_2021` | 2021-08-27 | La Mojana | Dike breach #1 — start of La Niña 2021–2023 chronic crisis |
| `la_mojana_peak_2022` | 2022-04-17 | La Mojana | ~590,000 ha flooded nationwide |
| `cara_de_gato_2024` | 2024-05-06 | La Mojana | Dike breach #2 (after Feb 2024 rebuild) |
| `los_arrastres_2024` | 2024-05-08 | La Mojana | Second May 2024 breach |
| `la_mojana_peak_2024` | 2024-06-11 | La Mojana | ~860,000 ha — worst peak of 2024 |
| `cara_de_gato_2025` | 2025-08-27 | La Mojana | Dike breach #3 |
| `mocoa_avalancha_2017` | 2017-04-01 | Putumayo | Avalancha torrencial, 335 fatalities |
| `puerto_leguizamo_calamidad_2025` | 2025-04-10 | Putumayo | Calamidad pública declaration |
| `putumayo_decreto_0472_2025` | 2025-07-23 | Putumayo | Decreto 0472, 16,975 damnificados |

Each event has a `scope` field: `'all'` (all locations in region) or a list of location IDs. See `src/events.ts`.

## The candidate sweep — handling Sentinel-2's cadence

For each (location × event), we generate **three windows**:

| Window | Offset from event | Purpose |
|---|---|---|
| `pre` | 14–28 days before | baseline — what does this place look like normally |
| `event` | ±5 days | the event itself |
| `post` | 14–32 days after | recovery / persistence check |

Each window has **4 candidate dates** spaced at Sentinel-2's ~5-day revisit cadence. The fetcher (`src/generate.ts:pickBestCandidate`) probes all 4 in parallel, gets each one's `cloud_cover` from the `sentinel_metadata` header, and picks the lowest-cloud candidate. **No hard filter on clouds** — the labeler is expected to set `image_quality_limited=true` and pick conservative severity, training the model to abstain.

Why no hard filter:

- The wet season *is* the flood season. Filtering >60% cloud would drop nearly every event-window tile in La Mojana May/June.
- Partial-cloud tiles still contain signal — the labeler can read the visible portions.
- Teaching the student model to recognize cloudy data and abstain is the right behavior. Hiding cloudy data from training breaks that.

## Band combos

Two PNGs per tile, each at full resolution:

- **`rgb`** = red + green + blue (B4-B3-B2): true color, visible imagery. Good for spatial context: cities, terrain, normal rivers.
- **`swir`** = SWIR2 + NIR + Red (B12-B8-B4): false color. Water absorbs SWIR strongly → near-black. Healthy vegetation glows green. Dry/bare soil reads as bright pink/magenta. Sediment-laden flood water is brown.

Why SWIR not NIR: water absorbs even more strongly in SWIR (~2.2 µm) than in NIR. SWIR also separates muddy/sediment-laden flood water from clear water — critical for the Cauca, Río Putumayo, Mocoa debris-flow cases. MNDWI (the modified water-detection index used in operational pipelines) uses SWIR for the same reason. The combo is identical to what Pau used for wildfires.

We do *not* embed band-math indices like NDWI/MNDWI as channels. The VLM consumes raw 3-channel PNGs.

## Idempotency

Re-running `deno task fetch` is safe: each tile dir's `rgb.png` is the idempotency marker. Already-fetched tiles are skipped. Running an interrupted fetch picks up where it left off.

## Robustness

`fetchSentinelWithRetry` (3 retries, 500ms backoff) wraps every SimSat call. Probes inside `pickBestCandidate` are individually try/caught — a single failed probe doesn't abandon the window. The outer `runWithConcurrency` worker also catches per-task errors so one bad tile can't crash the whole run.

## What we collected

165 windows planned across 9 events × matched locations. Final disposition:

- **148 windows successfully fetched** with rgb + swir + capture_metadata
- **115 pair samples** formed (`pre+event` and `pre+post` per location-event with the pre baseline available)
- Mocoa avalancha 2017 had **no usable Sentinel-2 acquisitions** in March 2017 — we manually fetched a 2017-08-15 stand-in baseline (4 months post-event, dry season; Mocoa terrain is stable) so the 2 Mocoa tiles could still be paired. The annotation flags this with a `note` field.

## Why concurrency = 2

We initially ran with concurrency=4 + parallel probes (4 per window) = up to 16 simultaneous SimSat requests. SimSat proxies to AWS Element84 STAC and started dropping connections under that load. Dropped to concurrency=2 with retries and the run completed cleanly. The probe parallelism inside each window stays at 4 — that's what makes the candidate sweep cheap.
