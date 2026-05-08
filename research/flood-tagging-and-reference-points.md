# Satellite flood tagging — schema + La Mojana/Putumayo reference points

Source review across `research/download-md/*.md` and the existing context notes. Pulls together (1) a flood-image expert tagging schema and (2) concrete temporal/spatial anchors so image acquisition can target the right places at the right dates.

---

## 1. Tagging schema for flood detection in satellite imagery

The starting schema you proposed is fine for a first pass, but it conflates a few things that experts typically want to keep separated. Below is a refined schema, organised in three blocks: **image-frame metadata** (about the tile being viewed), **flood evidence** (what the tagger observes), and **impact / context** (downstream signals). Items marked `★` are the highest-signal additions on top of your draft.

### A. Image-frame metadata (record, don't infer)

```json
{
  "image_id":            "S1A_IW_GRDH_20240531T100348_T018",
  "sensor_type":         "SAR",        // ★ SAR | optical_true_color | optical_false_color | NDWI/MNDWI
  "platform":            "Sentinel-1", // Sentinel-1 | Sentinel-2 | Landsat-8/9 | Planet | etc.
  "acquisition_date":    "2024-05-31",
  "tile_bbox":           [-75.20, 8.30, -74.85, 8.65],   // ★ lon_min, lat_min, lon_max, lat_max (WGS84)
  "admin1":              "Sucre",      // ★ department
  "admin2":              "San Benito Abad",                  // ★ municipality
  "baseline_pair":       "S1A_..._20240425T..."         // ★ pre-event reference image, if used
}
```

Why: the meaning of "water = dark" applies to **SAR** but breaks for **optical**; clouds are a problem for optical, not for SAR. Knowing the sensor up front prevents the tagger from being asked the wrong question. Pre/post pairing is essential — a single frame cannot distinguish "flooded" from "wetland" reliably.

### B. Flood evidence (what the tagger sees)

```json
{
  "flood_present":              true,
  "flood_type": "riverine_overflow",  // ★ riverine_overflow | flash_flood/avenida_torrencial | dike_levee_breach | urban_pluvial | coastal_storm_surge | unclear
  "flood_severity":             "moderate",  // none | minor | moderate | severe
  "water_coverage_pct_estimate":"30-60%",    // <10% | 10-30% | 30-60% | >60%
  "water_type": "new_flood",          // ★ new_flood | permanent_water | mixed | unsure
                                         //  distinguishes wetland baseline from emergency flood
  "river_overflow_visible":     true,
  "dike_or_levee_breach_visible":false,// ★ explicit yes/no — Cara de Gato / Los Arrastres signature
  "saturated_soil_visible":     true,  // ★ darkened bare soil / soggy fields adjacent to standing water
  "tagger_confidence":          0.8    // ★ 0.0–1.0
}
```

Why: distinguishing **dike breach** from generic riverine overflow is the difference between flagging a chronic structural hazard (La Mojana) and a seasonal pulse. **water_type** is the single most useful field for La Mojana because the area is naturally a wetland — taggers must say whether they think the water exceeds the wet-season baseline. **tagger_confidence** lets you weight labels in training.

### C. Impact / context

```json
{
  "land_cover_affected": ["cropland", "wetland"],  // ★ multi-select
                                                      //  cropland | grassland | wetland |
                                                      //  urban_settlement | rural_settlement |
                                                      //  forest | mangrove | bare | other
  "populated_area_affected":  true,
  "infrastructure_at_risk":   true,
  "infrastructure_types":     ["road", "bridge"],  // ★ road | bridge | building | aqueduct |
                                                      //  power_line | school | health_facility |
                                                      //  airstrip | port
  "isolation_visible":        true,                // ★ town/village cut off by water on all visible sides
  "known_recurrence_zone":    true                 // ★ overlap with UNGRD/IDEAM flood frequency map
}
```

### D. Image quality (separate from quality)

```json
{
  "cloud_cover_pct":          15,    // ★ numeric — only meaningful for optical
  "image_quality_limited":    false, // partial tile, sensor artifacts, noise
  "limitation_reasons":       ["clouds_partial"]  // ★ clouds_partial | clouds_total | speckle_noise |
                                                     //  partial_tile | shadow | sun_glint | other
}
```

### E. Workflow notes (good practice, not a schema field)

- **Ask for a pre/post pair, not a single tile.** Sentinel-1 reaches La Mojana every ~6 days; Sentinel-2 every 5 days when not cloudy. The CopernicusLAC / UNGRD operational pipeline is built on Sentinel-1 specifically because La Mojana is cloudy half the year.
- **Pre-event baseline window:** 2-4 weeks before the event date, dry-season if possible. Post-event window: 1-3 days after peak.
- **Tag ground-truth tiles together with control tiles** — show experts a mix of (clear event), (clear normal), (ambiguous) so the schema's enums get exercised. Pure positives produce models that hallucinate floods on every wet floodplain.
- **Cross-reference flood-frequency layer.** If you have UNGRD's flood frequency raster (Copernicus Sentinel-1 archive 2015-2025), `known_recurrence_zone` can be auto-filled.
- **Two-tagger consensus** for any tile that has `tagger_confidence < 0.7` or `water_type = unsure`.

---

## 2. La Mojana — temporal and spatial anchors

La Mojana is a **chronic, multi-year emergency** punctuated by discrete dike-failure events. For training data, the highest-value images are pre/post pairs around dike breaches plus seasonal contrasts (dry season ≈ Jan–Mar vs wet pulse ≈ Apr–Jun and Aug–Nov).

### Anchor location (region-level)

| Item | Value |
|---|---|
| Region | Depresión Momposina / La Mojana |
| Approx. center | ~8.5°N, 75.0°W |
| Bounding box (rough) | -75.6°W to -74.4°W, 7.7°N to 9.3°N |
| Departments | Sucre, Córdoba, Bolívar, Antioquia |
| Convergent rivers | Cauca, San Jorge, Magdalena |
| Critical hydraulic structures | Dique **Cara de Gato** (San Jacinto del Cauca, Bolívar); Dique **Los Arrastres** |
| Known infrastructure work | Ampliación del **Canal de La Esperanza** (UNGRD; redirects ~60% of Río Cauca) |

### Anchor municipalities (priority order)

| Municipality | Department | Why |
|---|---|---|
| **San Jacinto del Cauca** | Bolívar | Site of Cara de Gato dike — primary breach location |
| **Ayapel** | Córdoba | 2024: 23% of municipality + 44% of cropland flooded; large wetland (Ciénaga de Ayapel) |
| **San Benito Abad** | Sucre | 2024: 29% of municipality + 35% of cropland flooded; 32% of grassland |
| **Guaranda** | Sucre | Caño Rabón > 3.6 m in 2025; Alto San Matías, Humo Candelaria, Mamón communities |
| **Majagual** | Sucre | Sincelejito (Alianza Común La Mojana hub); Pumpuma, Los Ossas |
| **Caimito** | Sucre | Persistent encharcamientos; CMGRD reported ongoing impact 2025 |
| **Sucre** (cabecera) | Sucre | Urban impact + departmental seat |
| **San Marcos** | Sucre | Secondary impact zone |

Smaller communities to flag inside tiles: Camajón, Santa Helena (Sucre), Sincelejito (Majagual + Ayapel), Alto San Matías, Humo Candelaria, Mamón, Pumpuma, Los Ossas.

### Key event dates (use as image-acquisition anchors)

| Date | Event | Why useful |
|---|---|---|
| **27 Aug 2021** | Cara de Gato dike breach (initial) — La Niña 2021-2023 begins | Baseline-positive event, start of chronic crisis |
| **1 Aug 2021** | Official "fecha de inicio" of La Niña 2021-2023 (Decreto 2113/2022) | Pre-baseline cutoff for archival comparisons |
| **17 Apr 2022** | Prior peak — ~590,000 ha flooded nationwide; ~136,000 ha in La Mojana departments | Reference peak; great for severity calibration |
| **Feb 2024** | Cara de Gato rebuild completed | Pre-rupture baseline — short window |
| **21 Apr 2024** | Heavy rains begin; filtration in rebuilt dike | Onset signal |
| **6 May 2024** | Cara de Gato breach (again) | Event 1 — well-documented in OCHA, ACAPS |
| **8 May 2024** | Los Arrastres breach | Event 2 — second dike failure |
| **16 May 2024** | 766 houses destroyed cumulatively (ACAPS) | Mid-event impact |
| **27 May 2024** | ~850,000 ha flooded nationwide | Peak inundation snapshot |
| **31 May 2024** | Sentinel-1 post-event imagery used by FAO DIEM/WFP storymap | Direct sensor anchor for benchmarking |
| **11 Jun 2024** | ~860,000 ha flooded — peak | Final 2024 peak; recovery starts after |
| **12 Apr 2025** | 30,104 people affected (9,808 families) — official tally | New cycle begins |
| **19-22 May 2025** | OCHA inter-agency mission — registered impacts in 7 municipalities | Mission-quality ground truth |
| **27 Aug 2025** | New Cara de Gato breach | Recent training pair |
| **Feb 2026** | Severe flooding in Córdoba — Copernicus EMS activation **EMSR865** | Operational EO products available |

### Image acquisition recipe — La Mojana

```
For each event date E above:
  pre_window  = E − 14 days … E − 21 days  (dry-ish baseline)
  event_window= E − 1 day  … E + 3 days    (peak)
  post_window = E + 14 days … E + 30 days  (recession)

Sentinel-1 SAR (recommended primary; cloud-independent)
  - VV polarisation for water masking
  - VH for vegetation/structure context
  - 6-day revisit at the equator

Sentinel-2 (optional, NDWI/MNDWI)
  - Use only when cloud_cover_pct < 30
  - 5-day revisit; in La Mojana clouds dominate Apr-Jun & Aug-Nov

Reference layers to overlay
  - ESA WorldCover 2021 (cropland, grassland, wetland masks)
  - UNGRD/CopernicusLAC flood frequency raster 2015-2025 (if accessible)
  - OSM admin boundaries + roads
```

---

## 3. Putumayo — temporal and spatial anchors

Putumayo is a different problem from La Mojana. The two characteristic events are (a) the **Mocoa avalancha de 2017** — flash flood / avenida torrencial in mountainous Andean–Amazon foothills, where flow is rocks + mud + water, not ponded water; and (b) **chronic riverine flooding** in the lowland Amazonian rivers (Putumayo, Caquetá) affecting Bajo Putumayo and Puerto Leguízamo.

### Anchor locations

| Item | Value |
|---|---|
| Department | Putumayo |
| Capital | Mocoa (~1.146°N, 76.654°W) |
| Subregions | **Alto Putumayo** (Sibundoy, Santiago, San Francisco, Colón); **Medio Putumayo** (Mocoa, Villagarzón, Puerto Guzmán); **Bajo Putumayo** (Puerto Asís, Orito, Valle del Guamuez, San Miguel, Puerto Leguízamo, Puerto Caicedo) |
| 13 municipalities total | — |
| Major rivers | **Putumayo**, **Caquetá**, **Mocoa**, **Sangoyaco** (a.k.a. Sancoyaco), **Mulato**, **Guamuéz**, **Orito**, **Guineo**, Río Negro |
| Major quebradas (Mocoa) | **Taruca**, **Taruquita**, **San Antonio**, **Conejo**, **Almorzadero**, El Carmen |
| Critical infrastructure | Vía Mocoa–Pasto (landslides 2025); Puente sobre Río Negro (lost 2025); Puerto Asís albergue |

### Anchor location — Mocoa avalancha (2017)

| Item | Value |
|---|---|
| Date/time | Night of **31 March 2017 → 01 April 2017**, ~midnight local |
| Mechanism | Convective precipitation → mass movement → mudflow/avenida torrencial via 6 watercourses |
| Watercourses involved | Quebradas Taruca, Taruquita, San Antonio, Conejo, Almorzadero + Ríos Sangoyaco and Mulato |
| Urban barrios affected | **17 barrios** (UNAL); **36 barrios + 13 veredas** in OCHA tally; 6 barrios totally destroyed |
| Specific barrios cited | San Miguel, Miraflores, El Progreso, Puente Mulato, Jorge Eliécer Gaitán, Los Laureles |
| Predios affected | 1,673 rural + 1,035 urban (per Mocoa 2023 risk diagnostic) |
| Casualties | 335 fatal, 57 disappeared, 400+ injured, 15,500+ damnificados |
| Post-event resolutions | CORPOAMAZONIA Resolución 447 de 2017 (avenida-torrencial delimitation) |
| Pre-event imagery | Sentinel-1 + Sentinel-2 archive available from late 2014 onwards |

Other Mocoa events (smaller, useful as low-severity training): 17 Jul 2017 (Sangoyaco breach in Barrio Progreso), 2021 creciente (figure 41 of Mocoa diagnostic).

### Anchor dates — 2025 rainy season (Putumayo + Amazonia/Orinoquía)

OCHA SitRep No. 01 (29 Jul 2025) gives a full multi-department picture. Putumayo-specific:

| Date | Event |
|---|---|
| Mar–Aug 2025 | Putumayo rainy season; intensifies in **July** |
| **10 Apr 2025** | Puerto Leguízamo declares calamidad pública (Decreto) |
| **23 Jul 2025** | Gobernación del Putumayo emits Decreto 0472 — calamidad pública departamental |
| Cumulative (to 29 Jul 2025) | 16,975 damnificados (6,068 families); 1,670 viviendas; 4 acueductos; ~3,000 ha cultivos |
| Most affected munis | **Puerto Asís, Puerto Guzmán, Colón, Santiago** |
| Rivers at critical levels | **Río Putumayo at 11.5 m** (red alert; record 12.5 m); **Río Caquetá** |
| Adjacent infrastructure | Vía Mocoa–Pasto closed by landslides; Puente sobre Río Negro lost |

Adjacent departments worth tagging (same ENSO trigger, comparable hydrology):

| Date | Department | Event |
|---|---|---|
| **24 May 2025** | Caquetá | First creciente súbita del Río Caquetá |
| **4 Jul 2025** | Caquetá | Second event — desbordamientos in Caquetá, Caguán, Orteguaza, Pescado, Guayas; 11/16 munis affected; 13,820 people |
| May 2025 | Guaviare | San José del Guaviare calamidad pública (Río Guaviare) |
| Jun 2025 | Guaviare | 4,485 people affected |
| 15 Jun 2025 | Arauca | Compounding floods; 30,759 + 5,800 refugees; rivers Arauca, Bojabá, Madre Vieja, Banadía, Satoca, Caranal, Ele, Casanare, El Lipa |
| May–Jul 2025 | Vichada | Río Meta + Río Orinoco; 11,500+ affected |

### Image acquisition recipe — Putumayo

```
Mocoa avalancha (2017):
  pre_event   = 2017-03-01 … 2017-03-30
  event_proxy = 2017-04-01 … 2017-04-04   (cloud-permitting)
  post_event  = 2017-04-15 … 2017-05-15
  Note: Sentinel-1 acquisitions over Mocoa exist but the 2017
        avenida torrencial is hard to map post-hoc with SAR alone
        because flow was sediment-dominated. Use Sentinel-2 cloud-free
        composites + DEM to delineate the impacted fan.

2025 Bajo Putumayo flooding:
  pre   = 2025-02-15 … 2025-03-15  (dry-ish baseline)
  peak  = 2025-07-15 … 2025-07-31  (around Decreto 0472)
  post  = 2025-09-01 … 2025-09-30

Reference layers
  - SGC 2017 movement-in-mass zonification of Taruca-Taruquita
  - CORPOAMAZONIA Resolución 447/2017 polygons
  - Mocoa 2023 risk diagnostic — amenaza alta polygons (urbano + 13 núcleos poblados)
```

---

## 4. Cross-cutting: where to source the actual images

| Source | Coverage | Cost | Use |
|---|---|---|---|
| **Sentinel-1 SAR** (Copernicus) | global, 6-12 day revisit | free | primary water-extent layer; cloud-independent |
| **Sentinel-2 MSI** (Copernicus) | global, 5-day revisit | free | optical context, NDWI/MNDWI |
| **Copernicus EMS Rapid Mapping** (EMSR286, EMSR847, EMSR865) | event-triggered | free | already-tagged ground truth for Colombia events |
| **UNOSAT** products 4022, 4210 | event-triggered | free | already-tagged ground truth |
| **CopernicusLAC Panama Centre** (Use Case 2) | Colombia, near-real-time | gated to authorised entities | UNGRD-validated flood-extent / frequency / depth |
| **NASA Worldview** (MODIS, VIIRS) | daily, coarse | free | rapid coarse-scale visual check |
| **Planet Labs** (commercial, daily 3 m) | global daily | paid (humanitarian licences exist via Disasters Charter) | high-res post-event |
| **Landsat 8/9** | 16-day revisit, 30 m | free | longer historical baseline (since 2013) |

---

## 5. Quick reference — fields to add to your existing schema

If the goal is a minimal change, here's the smallest delta on top of your draft that gives you the biggest analytical lift:

```json
{
  "flood_present": true,
  "flood_severity": "moderate",
  "flood_type": "dike_levee_breach",      // ADD
  "water_coverage_pct_estimate": "30-60%",
  "water_type": "new_flood",              // ADD — distinguishes from wetland baseline
  "populated_area_affected": true,
  "infrastructure_at_risk": true,
  "infrastructure_types": ["road"],       // ADD — replaces vague boolean with typed list
  "river_overflow_visible": true,
  "dike_or_levee_breach_visible": false,  // ADD — high-value for La Mojana
  "land_cover_affected": ["cropland"],    // ADD
  "image_quality_limited": false,
  "cloud_cover_pct": 15,                  // ADD — numeric, optical only
  "sensor_type": "SAR",                   // ADD — at minimum SAR vs optical
  "tagger_confidence": 0.8                // ADD
}
```
