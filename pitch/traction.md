# Traction — what's already built *and* who's already aligned

humaid is not a slide deck. It's a working set of components with the implementing partners already at the table.

## Programme & partners — the part most projects are missing

| | |
|---|---|
| **NASA Lifelines program** | humaid is an affiliated project under the program |
| **United Nations in Colombia** | partnership on their data and AI governance strategy — humaid as reference case for AI-in-humanitarian-action governance |
| **Indigenous water-rights organisations (Putumayo)** | co-designing the local app and community stations on their territory; cultural and legal standing as *autoridades tradicionales* |
| **NGO implementing partners** | humanitarian organisations with active operational presence in La Mojana and Putumayo aligned for field deployment under existing donor frameworks (CERF, ECHO, USAID-BHA, SIDA, Colombia HRP) |

This is the part of the traction story that **changes how the rest of the deck reads**. See [partners.md](./partners.md) for the full picture.

## Built and committed

### Research corpus (60+ MB, 17 PDFs, fully indexed)

- 17 source PDFs from OCHA, UNGRD, ACAPS, CERF, FAO, IASC, UNICEF, IOM, IISD, SIDA, UNAL — covering La Mojana 2021-2025, Mocoa 2017, Putumayo 2025, ENSO contingency plans, anticipatory action SOPs.
- All 17 mirrored as searchable markdown (~1.5 MB) for grep / retrieval pipelines.
- Synthesis notes: `water-crisis-colombia.md`, `flood-tagging-and-reference-points.md`, `humanitarian-aid-context.md`.
- Curated link index of ~80 external sources by theme.

→ `research/` (committed)

### Knowledge base — 471 bilingual Q&A pairs

- Built by spawning **6 parallel agents** (one per role) over the research corpus.
- Each pair tagged by **role × phase × region × topic**, with citations back to source PDFs.
- English + Spanish, ready for retrieval and instruction-tuning.
- Validated, deduplicated, byte-stable build pipeline (Deno + DuckDB).
- Local semantic retrieval working — sub-second on a Raspberry-class device.

| Distribution | Count |
|---|---|
| Total rows | 471 |
| humanitarian-staff | 90 |
| local-community | 84 |
| ngos | 79 |
| local-authority | 78 |
| first-respondants | 70 |
| national-authorities | 70 |

→ `knowledge-base/` (committed)

### Satellite-resident detection model — pipeline complete

- Full Modal H100 fine-tuning pipeline for **LFM2.5-VL-450M** in Deno/TypeScript.
- SimSat satellite simulator integration for historical Sentinel-2 acquisition.
- Anthropic Claude Opus auto-labeller with structured-tool-use schema.
- 14 anchor locations, 9 events, ~115 labelled paired samples.
- Fine-tune currently paused — Sentinel-2 alone is the wrong tool for cloud-bound La Mojana; **the entire pipeline is reusable for Sentinel-1 SAR with one client-file swap.**
- Full eval framework + comparison reports written.

→ `finetune-flood/` (committed; see `finetune-flood/REPORT.md` for findings)

### Sample showcase: Mapbox events viewer

- Static viewer joining `events.ts × locations.ts` into a 55-row geo-database.
- 3 export formats (JSON, CSV, GeoJSON).
- Mapbox map with region filtering, event filtering, year filtering.
- Embeddable as-is in the project website.

→ `events-map/` (committed)

## Validated

| Hypothesis | Evidence |
|---|---|
| Small VLMs can ground-truth-match frontier labellers on flood detection | finetune-flood/ Opus self-consistency at 0.66-0.68 — bounds learnable from this data |
| The historical knowledge actually exists in the documents | 471 Q&A pairs distilled from 17 PDFs; every answer cites its source |
| Multi-agent generation of bilingual Q&A is fast | 6 agents × ~16 min wall time → 471 pairs |
| Local Q&A retrieval is feasible on commodity hardware | Nomic + DuckDB sub-second search demonstrated |
| Sentinel-1 SAR is the right primary sensor for La Mojana | CopernicusLAC + UNGRD already operational; our cloud-cover analysis confirms |

## Not yet built — concrete plan

| Component | Estimated effort | Blocker |
|---|---|---|
| Sentinel-1 swap in fine-tune pipeline | 2 weeks | None — code reusable |
| Actual model fine-tune run | 1 week | ~$500 Modal credits |
| Community station hardware spec & bring-up | 6 weeks | Funding for first pilot devices |
| Local app (mobile + desktop) | 12 weeks | Funding for design + dev |
| First production satellite payload | 9-12 months | Hosted-payload partnership |
| First field pilot (La Mojana) | 6 months from station-bring-up | UNGRD or NGO field partner |

## Quote-worthy

> "The lessons of Mocoa 2017 are written down. So are the lessons of La Mojana 2021. They are written down in **hundreds of pages of PDFs**. The same lessons get re-learned every cycle."
> — humaid problem statement

> "Process the flood in space. Answer the questions on the ground. Don't depend on the network the flood is destroying."
> — humaid solution statement
