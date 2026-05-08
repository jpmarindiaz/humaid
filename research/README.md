# research

Research corpus on water-management humanitarian crises in Colombia, with focus on **La Mojana** (Caribbean wetlands / Depresión Momposina) and **Putumayo** (Andean–Amazon basin).

## What we did

1. **Mapped the problem.** Reviewed the actors, phases, and processes of humanitarian response in Colombia (UNGRD / SNGRD on the state side; OCHA / EHP / ELC / UN agencies / Cruz Roja / NGOs / first responders on the international and civil-society side) — see `humanitarian-aid-colombia/humanitarian-aid-context.md`.
2. **Pulled primary sources.** Downloaded 17 reference PDFs (~61 MB) into `download/` covering La Mojana 2021-2025, Mocoa 2017, the Putumayo / Amazonía-Orinoquía 2025 rainy season, ENSO contingency plans, anticipatory-action SOPs, and national HRP/CPRP frameworks. Sources include OCHA, ACAPS, CERF, UNGRD, IDEAM, FAO, IASC, UNICEF, IOM, IISD, SIDA, and academic notes (UNAL).
3. **Converted them to markdown.** All 17 PDFs are mirrored as searchable markdown in `download-md/` so they can be grepped, fed to retrieval pipelines, or cited inline.
4. **Synthesised the findings.** Two main outputs:
   - `water-crisis-colombia.md` — narrative synthesis: La Mojana chronic-flood timeline, Putumayo / Mocoa case + 2025 rainy season, ENSO architecture, satellite-imagery applications, response process map, gaps.
   - `flood-tagging-and-reference-points.md` — concrete temporal/spatial anchors and an expert-tagging schema for satellite-image flood detection, with priority municipalities, dates, rivers, and dikes.
5. **Curated the link index.** `links.md` aggregates ~80 sources by theme (La Mojana situation, Putumayo / Amazonía, ENSO contingency, SAT, satellite/EO, national frameworks). Local files are flagged where downloaded; everything else is a URL.

## The problem this corpus does *not* solve on its own

The historical knowledge on floods in Colombia exists. It is, in fact, abundant — UNGRD damage assessments, OCHA factsheets, ACAPS briefings, CERF allocation reports, IASC SOPs, IDEAM bulletins, peer-reviewed academic studies, municipal risk diagnostics. Together they describe what to do before, during, and after an event, with the necessary level of operational detail for every actor in the system.

**But that knowledge is locked inside hundreds of pages of PDFs.**

The people who actually need it — a JAC president whose neighbourhood is being evacuated, a municipal official deciding whether to declare *calamidad pública*, a Cruz Roja socorrista at a rescue point, a humanitarian officer triggering a CERF anticipatory-action allocation, an OCHA cluster lead trying to scale up WASH in 72 hours — do not have time to skim a 314-page risk diagnostic in the middle of a crisis. They need a specific, role-appropriate, phase-appropriate answer in seconds, not a reading list.

The result is that the same lessons get re-learned every cycle: WASH gaps after Mocoa 2017 were re-discovered after the 2021 Cara de Gato breach, and again after the 2024 dual breach, and again in the 2025 Putumayo rainy season. The knowledge was always there; the retrieval was not.

## How the knowledge-base bridges the gap

To turn this static research corpus into something usable in real time, we built `../knowledge-base/`. It contains **471 bilingual (English / Spanish) Q&A pairs**, each:

- Tagged by **role** — local community, local authority, national authorities, humanitarian staff, NGOs, first responders.
- Tagged by **phase** — pre, event, post.
- Tagged by **region** — La Mojana (slow-onset wetland), Putumayo (flash-flood + lowland Amazon), or generic.
- Linked back to the source documents that ground the answer (local files in `download-md/` flagged `local`, external URLs flagged `cloud`).

The same question can appear at multiple phases when the actionable answer changes between them, and many questions are framed in the first person of the role so a retrieval system can match on intent.

See **[`../knowledge-base/README.md`](../knowledge-base/README.md)** for the full schema, build pipeline, coverage statistics, and notes on consuming the dataset.

## Layout

```
research/
├── README.md                                    this file
├── water-crisis-colombia.md                     narrative synthesis
├── flood-tagging-and-reference-points.md        anchors + tagging schema
├── links.md                                     ~80 curated links by theme
├── humanitarian-aid-colombia/
│   └── humanitarian-aid-context.md              actors, HPC phases, Mocoa case
├── download/                                    17 source PDFs (~61 MB)
└── download-md/                                 same docs as searchable markdown
```
