# knowledge-base

Q&A dataset on water-management humanitarian crises in Colombia, with focus on **La Mojana** (Caribbean wetlands) and **Putumayo** (Andean–Amazon basin). Built by spawning six parallel agents (one per role) that read the markdown research corpus under `research/download-md/` and `research/*.md` and converted it into role-tagged, phase-tagged, region-tagged Q&A.

## Files

```
knowledge-base/
├── AGENT_BRIEFING.md       Shared briefing the agents worked from
├── chunks/                 Raw per-role CSVs as written by each agent
│   ├── first-respondants.csv
│   ├── humanitarian-staff.csv
│   ├── local-authority.csv
│   ├── local-community.csv
│   ├── national-authorities.csv
│   └── ngos.csv
├── merge.ts                Validates + concatenates chunks into qa-pairs.csv
├── qa-pairs.csv            Humanitarian Q&A — 471 rows
├── qa-stats.json           Counts by role, phase, region, topic
├── project-qa/             Project-meta Q&A about humaid itself (118 rows)
│   ├── source.ts           Structured TS source-of-truth
│   ├── generate.ts         Builds project-pairs.csv
│   ├── project-pairs.csv   Generated, committed
│   └── README.md
├── rag/                    Local semantic search (Nomic via Ollama → DuckDB)
├── kb.duckdb               Pre-built embedding index (committed; ~2.3 MB)
│                           — merged: 471 humanitarian + 118 project-meta = 589
├── deno.json               Tasks: merge, project-qa, build, ask
└── README.md               This file
```

## Retrieval

A simple Q&A retriever lives under `rag/`. It embeds each pair once into
`kb.duckdb` (committed so nothing needs to be rebuilt) and runs cosine
similarity in DuckDB. The same index covers humanitarian operational Q&A
*and* project-meta Q&A. See `rag/README.md` for details.

```bash
# Humanitarian operational query (matches qa-pairs.csv rows; phase=pre|event|post)
deno task ask "How do I evacuate when the river rises overnight?" --text --k 3

# Project-meta query (matches project-qa/project-pairs.csv rows; phase=meta)
deno task ask "What is humaid?" --text --k 3
```

Clients can filter by `phase = 'meta'` to surface project-meta only (e.g.
an "About" tab) or by `phase IN ('pre', 'event', 'post')` to surface
humanitarian only.

## Schema

Each row in `qa-pairs.csv` (UTF-8, all cells double-quoted):

| column | values |
|---|---|
| `id` | `qa-NNNN`, sequential after merge |
| `role` | `local-community`, `local-authority`, `national-authorities`, `humanitarian-staff`, `ngos`, `first-respondants` |
| `phase` | `pre`, `event`, `post` — when the question is most actionable |
| `region` | `la-mojana`, `putumayo`, `generic` — `generic` = applies equally everywhere |
| `topic` | free-tag slug (`early-warning`, `wash`, `evacuation`, `dike-management`, `gbv`, …) |
| `question_en` | English question, in the first person of the role |
| `question_es` | Spanish translation |
| `answer_en` | English answer, 2-6 sentences, concrete and actionable |
| `answer_es` | Spanish translation |
| `references` | Pipe-separated list of source refs (local file paths or external URLs) |
| `ref_types` | Pipe-separated list, same length as `references`, each value `local` or `cloud` |

The same question is allowed to appear at multiple phases — when the actionable answer changes between pre / event / post, both rows are kept.

## Coverage

**471 Q&A pairs** distributed as:

| role | rows |
|---|---|
| humanitarian-staff | 90 |
| local-community | 84 |
| ngos | 79 |
| local-authority | 78 |
| first-respondants | 70 |
| national-authorities | 70 |

| phase | rows |
|---|---|
| event | 196 |
| pre | 156 |
| post | 119 |

| region | rows |
|---|---|
| generic | 249 |
| la-mojana | 132 |
| putumayo | 90 |

Top topics: `coordination` (61), `data-information` (18), `recovery` (17), `early-warning` (15), `health` (15), `wash` (12), `food-security` (12), `preparedness` (12), `enso-forecast` (11), `mental-health` (9), `wetland-management` (9). See `qa-stats.json` for the full distribution.

## How it was built

1. `AGENT_BRIEFING.md` was written from the research corpus (`research/water-crisis-colombia.md`, `research/flood-tagging-and-reference-points.md`, `research/humanitarian-aid-colombia/humanitarian-aid-context.md`, and 17 PDFs in `research/download-md/`).
2. Six general-purpose agents were spawned **in parallel**, one per role. Each agent received a custom prompt with: (i) a pointer to the briefing, (ii) the role-specific mindset and the most relevant subset of source files, (iii) the output path. Total wall time: ≈16 minutes for all six.
3. Each agent wrote a per-role CSV under `chunks/`.
4. `merge.ts` validated the schema, renumbered ids globally, and emitted `qa-pairs.csv`.

To rebuild from existing chunks (Deno ≥ 2.0):

```bash
cd knowledge-base
deno run -A merge.ts
```

To regenerate a single role (e.g. after editing the briefing), launch a fresh agent pointed at this folder; the merge script tolerates re-runs.

## Source conventions

Local file references look like `research/download-md/<file>.md` and are flagged `local`. External URLs (IDEAM, ReliefWeb, Copernicus EMS, OCHA web pages, Disasters Charter, etc.) are flagged `cloud`. A non-empty `references` cell with a matching-length `ref_types` cell is required when present; the merge script flags mismatches.

## Things to keep in mind when consuming

- **Region matters.** Slow-onset wetland inundation in La Mojana ≠ flash flood / avenida torrencial in Mocoa ≠ riverine inundation in Bajo Putumayo. The agents tried to keep these distinct, but if you build a retriever or fine-tuning loop, filter by `region` first when the question is region-specific.
- **Phase is not an attribute of the question — it's an attribute of the answer.** A "what do I do about WASH" question can be valid in all three phases; the actionable response differs.
- **Indigenous overlay.** Several Putumayo answers refer to autonomous response by Murui Muina, Inga, Kamëntsá, Siona, Kofán cabildos. La Mojana answers occasionally invoke Zenú and Afrocolombian community structures via the Alianza Común La Mojana.
- **Armed-conflict overlay.** Many Putumayo answers (and some La Mojana ones) explicitly account for AGC, ELN, EMC factions, Comandos de la Frontera presence and the access constraints they create.
- **Bilingual, not language-pair training data.** `question_en`/`answer_en` and `question_es`/`answer_es` are translations of the same Q&A. For MT training you'd want a different schema; this dataset is meant for retrieval and instruction-tuning, where one row = one Q&A in two languages.
