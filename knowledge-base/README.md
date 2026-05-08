# knowledge-base

Q&A dataset on water-management humanitarian crises in Colombia, with focus on **La Mojana** (Caribbean wetlands) and **Putumayo** (Andean–Amazon basin). Built by spawning six parallel agents (one per role) that read the markdown research corpus under `research/download-md/` and `research/*.md` and converted it into role-tagged, phase-tagged, region-tagged Q&A.

## Quick links

| | |
|---|---|
| 🌐 Live app (Try the KB chat + flood demo) | <https://humaid.app/app> |
| 💾 HuggingFace dataset (CC-BY-4.0) | [`jpmarindiaz/humaid-kb-colombia`](https://huggingface.co/datasets/jpmarindiaz/humaid-kb-colombia) |
| 🤖 Fine-tuned flood model | [`jpmarindiaz/lfm2-flood`](https://huggingface.co/jpmarindiaz/lfm2-flood) |
| 📦 Source repo | <https://github.com/jpmarindiaz/humaid> |
| 🧭 The problem we're solving | [`pitch/problem.md`](../pitch/problem.md) and [project README](../README.md) |
| 🏛 System architecture | [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) |
| 🖼 Demo slides + screenshots | [`docs/images/`](../docs/images/) |

> **Published publicly on HuggingFace 🤗** at [`jpmarindiaz/humaid-kb-colombia`](https://huggingface.co/datasets/jpmarindiaz/humaid-kb-colombia) (CC-BY-4.0). The HF repo bundles the merged CSV (589 rows = 471 humanitarian + 118 project-meta), both source CSVs as separate configs, and the prebuilt `kb.duckdb` index. Push a fresh build with `deno task hf:push:dataset`.

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

## Build it from scratch — for developers

If you want to reproduce the entire knowledge base on your own corpus (different region, different hazard, different language), here is the linear path. Everything is reproducible from this repo with no proprietary services in the loop.

### Prerequisites

```bash
# Toolchain
brew install deno         # or curl from deno.land
brew install ollama       # one-binary install on macOS / .deb / .msi for Win
ollama pull nomic-embed-text   # ~270 MB, the embedding model

# Optional — if you also want local synthesis
ollama pull jpmarindiaz/lfm2.5-vl-450m   # ~219 MB

# Anthropic API key (for the multi-agent generation step)
export ANTHROPIC_API_KEY=sk-ant-...
```

### Step 1 — Drop your source corpus into `research/download-md/`

The agents read markdown. If you have PDFs, convert them first:

```bash
# We use Kreuzberg via the ds_to_markdown wrapper; any PDF→markdown tool works
# (marker, mistral OCR, marker-pdf, etc.). One markdown file per source.
ds_to_markdown research/download/*.pdf -o research/download-md/
```

The 17 PDFs that fed humaid are listed in [`research/download/`](../research/download/) and the curated markdown is in [`research/download-md/`](../research/download-md/) — use them as a template for what "good source material" looks like (OCHA SitReps, UNGRD plans, ACAPS briefings, FAO anticipatory action, IASC SOPs, peer-reviewed risk diagnostics).

### Step 2 — Write your `AGENT_BRIEFING.md`

Copy [`AGENT_BRIEFING.md`](AGENT_BRIEFING.md) and adapt:
- the role list (we use 6 — local-community, local-authority, national-authorities, humanitarian-staff, ngos, first-respondants — pick what's appropriate for your domain)
- the phase list (we use pre / event / post — works for most disaster contexts)
- the region list (we use la-mojana / putumayo / generic — replace with your geographies)
- the per-role mindset cheat sheet
- the source-file map (which agent reads what)

### Step 3 — Spawn the parallel agents

We did this with Claude Code agents (`Agent` tool from this conversation), but the same prompt works against the Anthropic API directly. Each agent gets:
- the briefing
- the role they're assigned
- the source-file paths to read
- the output path (`chunks/<role>.csv`)

Parallel dispatch — six agents in flight at once. Wall time on our run: **≈16 minutes** for all six. Total cost: a few dollars on Claude Code (cheaper than direct API).

### Step 4 — Merge + validate

```bash
cd knowledge-base
deno task merge          # validates each chunk, renumbers ids, emits qa-pairs.csv
```

`merge.ts` checks the schema of each `chunks/*.csv`, warns on role/phase/region values not in the allowed set, normalises ids globally as `qa-NNNN`, and writes a clean `qa-pairs.csv`.

### Step 5 — Generate the project-meta Q&A (optional but recommended)

If your tool will have its own users (it will), they'll ask "what is this?" and "who do I contact?" before they ever ask an operational question. Author those answers in `project-qa/source.ts` (typed TS — easy to maintain role × region variants), then:

```bash
deno task project-qa     # source.ts → project-qa/project-pairs.csv
```

### Step 6 — Embed + build the index

```bash
deno task build          # reads both CSVs, embeds via Ollama Nomic, writes kb.duckdb
```

What this does:
1. Reads `qa-pairs.csv` (humanitarian) + `project-qa/project-pairs.csv` (project-meta).
2. For each row, concatenates `question_en + "\n" + question_es` and embeds via Ollama's `/api/embeddings` endpoint (model: `nomic-embed-text`, 768-dim, multilingual).
3. Writes everything to `kb.duckdb` — one row per Q&A pair, with the embedding inline as a `FLOAT[768]` column. **No vector DB; DuckDB does the cosine search natively.**

Wall time: ~5 seconds for 589 rows (Nomic batches 32 at a time on commodity hardware).

### Step 7 — Test retrieval

```bash
deno task ask "How do I evacuate when the river rises overnight?" --text --k 3
deno task ask "What is humaid?" --text --k 3
deno task ask "¿quién es el contacto en Putumayo?" --text --k 3
```

If the top-k matches look right, you're done. The same `kb.duckdb` ships in the website (`website/data/`) and the Tauri client (via `include_bytes!` at build time).

### Step 8 — (Optional) Publish to HuggingFace

```bash
export HF_TOKEN=hf_...
deno task hf:push:dataset    # uploads CSVs + kb.duckdb to your HF dataset repo
```

We did this so other regions can fork our schema and content for their own basins.

## Build journey — how this came together

This codebase was built in roughly **24 hours** during the Liquid AI × DPhi Space AI-in-Space hackathon in May 2026. The build went, in order:

1. Got the LFM2.5-VL base model running locally under llama.cpp; published a text-only variant to Ollama as `jpmarindiaz/lfm2.5-vl-450m`.
2. Cloned SimSat (DPhi Space's Sentinel-2 simulator).
3. Built the flood-detection fine-tune pipeline (`finetune-flood/`) — paused it for Sentinel-1 SAR reasons we documented in `finetune-flood/REPORT.md`.
4. Built this knowledge base — six parallel role-agents, ~16 minutes wall time, 471 cited Q&A pairs.
5. Added project-meta Q&A (118 more pairs) so the same retrieval index answers questions about humaid itself, varying by user role + region.
6. Stood up the website (Hono + React on Deno Deploy) hosting both AI systems as live demos at <https://humaid.app/app>.
7. Bootstrapped the Tauri desktop + Android client polling the website for alerts.

Demo screenshots, the architecture slide, and a few model-prediction images — including a fun moment where a model fine-tuned only on Colombia floods correctly flagged a flood in Spain (the historical Valencia event) — live in [`docs/images/`](../docs/images/).

## Source conventions

Local file references look like `research/download-md/<file>.md` and are flagged `local`. External URLs (IDEAM, ReliefWeb, Copernicus EMS, OCHA web pages, Disasters Charter, etc.) are flagged `cloud`. A non-empty `references` cell with a matching-length `ref_types` cell is required when present; the merge script flags mismatches.

## Things to keep in mind when consuming

- **Region matters.** Slow-onset wetland inundation in La Mojana ≠ flash flood / avenida torrencial in Mocoa ≠ riverine inundation in Bajo Putumayo. The agents tried to keep these distinct, but if you build a retriever or fine-tuning loop, filter by `region` first when the question is region-specific.
- **Phase is not an attribute of the question — it's an attribute of the answer.** A "what do I do about WASH" question can be valid in all three phases; the actionable response differs.
- **Indigenous overlay.** Several Putumayo answers refer to autonomous response by Murui Muina, Inga, Kamëntsá, Siona, Kofán cabildos. La Mojana answers occasionally invoke Zenú and Afrocolombian community structures via the Alianza Común La Mojana.
- **Armed-conflict overlay.** Many Putumayo answers (and some La Mojana ones) explicitly account for AGC, ELN, EMC factions, Comandos de la Frontera presence and the access constraints they create.
- **Bilingual, not language-pair training data.** `question_en`/`answer_en` and `question_es`/`answer_es` are translations of the same Q&A. For MT training you'd want a different schema; this dataset is meant for retrieval and instruction-tuning, where one row = one Q&A in two languages.
