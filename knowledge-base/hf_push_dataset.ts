// Push the humaid Knowledge-Base Q&A dataset to a public HuggingFace dataset repo.
//
// Pushes:
//   - qa-pairs-all.csv          merged (471 humanitarian + 118 project-meta = 589 rows)
//   - qa-pairs.csv              just the 471 humanitarian rows (committed source)
//   - project-qa/project-pairs.csv  just the 118 project-meta rows (committed source)
//   - kb.duckdb                 the prebuilt index w/ Nomic embeddings (FLOAT[768] inline)
//   - README.md                 generated dataset card
//
// Usage:
//   cd knowledge-base
//   deno run -A hf_push_dataset.ts
//   deno run -A hf_push_dataset.ts --repo "jpmarindiaz/humaid-kb-colombia" --private

import { parseArgs } from '@std/cli/parse-args'

const args = parseArgs(Deno.args, {
  string: ['repo'],
  boolean: ['private', 'skipCard', 'skipDuckdb'],
  default: {
    repo: 'jpmarindiaz/humaid-kb-colombia',
  },
})

async function exists(p: string): Promise<boolean> {
  try {
    await Deno.stat(p)
    return true
  } catch {
    return false
  }
}

async function commandExists(cmd: string): Promise<boolean> {
  const p = new Deno.Command('which', { args: [cmd], stdout: 'null', stderr: 'null' })
  const { code } = await p.output()
  return code === 0
}

async function run(cmd: string[]): Promise<void> {
  console.log(`$ ${cmd.join(' ')}`)
  const p = new Deno.Command(cmd[0], { args: cmd.slice(1), stdout: 'inherit', stderr: 'inherit' })
  const { code } = await p.output()
  if (code !== 0) {
    console.error(`✗ command exited ${code}`)
    Deno.exit(code)
  }
}

if (!(await commandExists('hf'))) {
  console.error('✗ hf CLI not found. Install: pipx install huggingface-hub')
  Deno.exit(1)
}

const humanCsv = 'qa-pairs.csv'
const metaCsv = 'project-qa/project-pairs.csv'
const duckdbPath = 'kb.duckdb'
const mergedCsv = 'qa-pairs-all.csv'

for (const p of [humanCsv, metaCsv]) {
  if (!(await exists(p))) {
    console.error(`✗ missing ${p}. Run \`deno task merge\` and \`deno task project-qa\` first.`)
    Deno.exit(1)
  }
}
const haveDuckdb = await exists(duckdbPath)
if (!haveDuckdb && !args.skipDuckdb) {
  console.warn(`⚠ ${duckdbPath} missing — run \`deno task build\` to create it (will skip in this run).`)
}

const whoami = new Deno.Command('hf', { args: ['auth', 'whoami'], stdout: 'piped', stderr: 'piped' })
const w = await whoami.output()
if (w.code !== 0) {
  console.error('✗ hf not authenticated. Run: hf auth login')
  Deno.exit(1)
}
console.log(`▶ HF user: ${new TextDecoder().decode(w.stdout).trim()}`)

// ============== Build merged CSV ==============

const humanText = await Deno.readTextFile(humanCsv)
const metaText = await Deno.readTextFile(metaCsv)
const humanLines = humanText.split('\n')
const metaLines = metaText.split('\n')
// Drop the header from the meta file; both share the same schema.
const merged = [...humanLines, ...metaLines.slice(1)].filter((l) => l.length > 0).join('\n') + '\n'
await Deno.writeTextFile(mergedCsv, merged)
const humanRows = humanLines.length - 1 - (humanLines[humanLines.length - 1] ? 0 : 1)
const metaRows = metaLines.length - 1 - (metaLines[metaLines.length - 1] ? 0 : 1)
const totalRows = humanRows + metaRows
console.log(`▶ merged ${humanRows} humanitarian + ${metaRows} project-meta = ${totalRows} rows → ${mergedCsv}`)
console.log(`▶ target repo: https://huggingface.co/datasets/${args.repo}  (${args.private ? 'private' : 'public'})`)

// ============== Generate dataset card ==============

const today = new Date().toISOString().slice(0, 10)
const card = `---
language:
- en
- es
license: cc-by-4.0
task_categories:
- question-answering
- text-retrieval
- sentence-similarity
size_categories:
- n<1K
tags:
- humanitarian
- disaster-response
- flood
- colombia
- la-mojana
- putumayo
- bilingual
- rag
- retrieval-augmented-generation
configs:
- config_name: default
  data_files:
  - split: all
    path: qa-pairs-all.csv
- config_name: humanitarian
  data_files:
  - split: train
    path: qa-pairs.csv
- config_name: project_meta
  data_files:
  - split: train
    path: project-qa/project-pairs.csv
---

# humaid-kb-colombia

Bilingual (English + Spanish) role-tagged Q&A dataset for **flood-disaster humanitarian response in Colombia**, with anchor regions in **La Mojana** (Caribbean wetlands) and **Putumayo** (Andean–Amazon basin). ${totalRows} pairs total. Built as the on-device knowledge base for [humaid](https://github.com/jpmarindiaz/humaid) — the offline-first response toolkit that pairs a satellite-side flood detector with a laptop-side Q&A assistant.

> **TL;DR.** ${humanRows} humanitarian Q&A about flood response, in 6 roles × 3 phases (\`pre\` / \`event\` / \`post\`) × 3 regions, plus ${metaRows} project-meta Q&A about humaid itself (\`phase = meta\`). All rows are bilingual EN+ES and source-cited. Ships with a DuckDB index of Nomic embeddings for plug-and-play retrieval.

## Configs

| config | rows | what |
|---|---|---|
| \`default\` | ${totalRows} | merged: humanitarian + project-meta |
| \`humanitarian\` | ${humanRows} | flood-response Q&A only (\`phase\` ∈ \`pre\`/\`event\`/\`post\`) |
| \`project_meta\` | ${metaRows} | "what is humaid?" / "who do I contact?" — \`phase = meta\` |

## Schema

Each row (UTF-8, all cells double-quoted):

| column | values |
|---|---|
| \`id\` | \`qa-NNNN\` (humanitarian) or \`proj-NNNN\` (project-meta) |
| \`role\` | \`local-community\`, \`local-authority\`, \`national-authorities\`, \`humanitarian-staff\`, \`ngos\`, \`first-respondants\`, or \`any\` (project-meta) |
| \`phase\` | \`pre\`, \`event\`, \`post\` — when the question is most actionable; or \`meta\` for project-meta rows |
| \`region\` | \`la-mojana\`, \`putumayo\`, \`generic\` |
| \`topic\` | free-tag slug (\`early-warning\`, \`wash\`, \`evacuation\`, \`dike-management\`, \`gbv\`, …) |
| \`question_en\` | English question, in the first person of the role |
| \`question_es\` | Spanish translation |
| \`answer_en\` | English answer, 2–6 sentences, concrete + actionable |
| \`answer_es\` | Spanish translation |
| \`references\` | pipe-separated source refs (local file paths or external URLs) |
| \`ref_types\` | pipe-separated, same length as \`references\`; values \`local\` or \`cloud\` |

The same question is allowed to appear at multiple phases — when the actionable answer changes between \`pre\` / \`event\` / \`post\`, both rows are kept.

## Coverage (humanitarian config)

**By role**

| role | rows |
|---|---|
| humanitarian-staff | 90 |
| local-community | 84 |
| ngos | 79 |
| local-authority | 78 |
| first-respondants | 70 |
| national-authorities | 70 |

**By phase**

| phase | rows |
|---|---|
| event | 196 |
| pre | 156 |
| post | 119 |

**By region**

| region | rows |
|---|---|
| generic | 249 |
| la-mojana | 132 |
| putumayo | 90 |

Top topics: \`coordination\` (61), \`data-information\` (18), \`recovery\` (17), \`early-warning\` (15), \`health\` (15), \`wash\` (12), \`food-security\` (12), \`preparedness\` (12), \`enso-forecast\` (11), \`mental-health\` (9), \`wetland-management\` (9).

## Bundled retrieval index

The repo also ships **\`kb.duckdb\`** (~2.9 MB) — the same file the [humaid](https://github.com/jpmarindiaz/humaid) Tauri client and Hono website read at runtime. It contains all ${totalRows} rows with a precomputed 768-dim \`nomic-embed-text\` embedding stored inline as \`FLOAT[768]\`. Cosine search is one SQL expression:

\`\`\`sql
SELECT id, role, phase, region, question_en, answer_en, …
     , array_cosine_similarity(embedding, $query_vec) AS similarity
FROM qa
WHERE role = $user_role AND region IN ('generic', $user_region)
ORDER BY similarity DESC
LIMIT $k;
\`\`\`

No HNSW index needed at this size — for ${totalRows} rows the sequential scan is ~1 ms.

To rebuild the index from the CSVs:

\`\`\`bash
git clone https://github.com/jpmarindiaz/humaid
cd humaid/knowledge-base
ollama pull nomic-embed-text   # 768-dim multilingual embeddings
deno task build                 # writes kb.duckdb
\`\`\`

## How it was built

Source corpus: 17 humanitarian-aid PDFs (UNGRD, OCHA, ACAPS, IDEAM, Copernicus EMS, Disasters Charter, IISD, etc.) plus synthesis notes in [\`research/\`](https://github.com/jpmarindiaz/humaid/tree/main/research).

1. **Briefing** — [\`AGENT_BRIEFING.md\`](https://github.com/jpmarindiaz/humaid/blob/main/knowledge-base/AGENT_BRIEFING.md) was distilled from the corpus.
2. **Six parallel agents** (general-purpose, one per role) read the briefing + a role-specific subset of source files and wrote per-role CSVs into [\`chunks/\`](https://github.com/jpmarindiaz/humaid/tree/main/knowledge-base/chunks). Total wall time: ≈16 minutes.
3. **Merge** — \`merge.ts\` validated the schema, renumbered ids globally, and emitted \`qa-pairs.csv\` (471 humanitarian rows).
4. **Project-meta** — \`project-qa/generate.ts\` produced the 118 \`phase = meta\` rows about humaid itself, schema-compatible with the humanitarian rows.
5. **Embed + index** — \`rag/build.ts\` calls Ollama \`nomic-embed-text\` on \`question_en + "\\n" + question_es\` per row (Nomic is multilingual; concat hits both languages) and writes the DuckDB.

Full details: [\`knowledge-base/README.md\`](https://github.com/jpmarindiaz/humaid/blob/main/knowledge-base/README.md).

## Things to keep in mind when consuming

- **Region matters.** Slow-onset wetland inundation in La Mojana ≠ flash flood / avenida torrencial in Mocoa ≠ riverine inundation in Bajo Putumayo. Filter by \`region\` first when the question is region-specific.
- **Phase is an attribute of the answer, not the question.** A "what about WASH?" question may be valid in all three phases; the actionable response differs. Same wording can appear in multiple rows.
- **Indigenous overlay.** Several Putumayo answers refer to autonomous response by Murui Muina, Inga, Kamëntsá, Siona, Kofán cabildos. La Mojana answers occasionally invoke Zenú and Afrocolombian community structures via the Alianza Común La Mojana.
- **Armed-conflict overlay.** Many Putumayo answers (and some La Mojana ones) explicitly account for AGC, ELN, EMC factions, Comandos de la Frontera presence and the access constraints they create.
- **Bilingual, not language-pair training data.** \`question_en\`/\`answer_en\` and \`question_es\`/\`answer_es\` are translations of the same Q&A. For MT training you'd want a different schema; this dataset is meant for retrieval and instruction-tuning, where one row = one Q&A in two languages.

## Companion artifacts

This is one of two datasets we built for humaid. The companion is the satellite-side flood-detection dataset:

- **Model**: [\`jpmarindiaz/lfm2-flood\`](https://huggingface.co/jpmarindiaz/lfm2-flood) — a fine-tune of LFM2.5-VL-450M for 4-image (RGB+SWIR baseline / current) → 7-key JSON flood labeling.
- **Vision dataset**: [\`jpmarindiaz/flood-detection-pair-colombia\`](https://huggingface.co/datasets/jpmarindiaz/flood-detection-pair-colombia) — the Sentinel-2 tile pairs that trained the model.

The two datasets are designed to work together: the vision model emits a JSON alert, the alert lands on a community station / desktop app, and *this* dataset provides the role-specific response procedures the user actually reads.

## License

CC-BY-4.0 for the Q&A content and dataset structure. Underlying source citations point to government / humanitarian / academic publications under their own licenses (mostly open / public-record); see the \`references\` column.

## Citation

\`\`\`bibtex
@dataset{humaid_kb_colombia_${today.replace(/-/g, '_')},
  author       = {Marin, JP and humaid contributors},
  title        = {humaid-kb-colombia: a bilingual role-tagged Q&A dataset for flood-disaster response in La Mojana and Putumayo},
  year         = {${today.slice(0, 4)}},
  publisher    = {Hugging Face},
  url          = {https://huggingface.co/datasets/${args.repo}},
}
\`\`\`

Generated ${today} as part of the [humaid](https://github.com/jpmarindiaz/humaid) project — offline-first humanitarian response toolkit for flood crises in Colombia.
`

if (!args.skipCard) {
  await Deno.writeTextFile('HF_README.md', card)
  console.log(`▶ wrote dataset card → knowledge-base/HF_README.md`)
}

// ============== Create repo + push ==============

console.log(`\n=== 1. Ensure dataset repo exists ===`)
const visFlag = args.private ? '--private' : '--public'
await run(['hf', 'repos', 'create', args.repo, '--type', 'dataset', visFlag, '--exist-ok'])

console.log(`\n=== 2. Push README + CSVs ===`)
await run(['hf', 'upload', args.repo, 'HF_README.md', 'README.md', '--repo-type', 'dataset'])
await run(['hf', 'upload', args.repo, mergedCsv, 'qa-pairs-all.csv', '--repo-type', 'dataset'])
await run(['hf', 'upload', args.repo, humanCsv, 'qa-pairs.csv', '--repo-type', 'dataset'])
await run(['hf', 'upload', args.repo, metaCsv, 'project-qa/project-pairs.csv', '--repo-type', 'dataset'])

if (haveDuckdb && !args.skipDuckdb) {
  console.log(`\n=== 3. Push kb.duckdb (precomputed Nomic index) ===`)
  await run(['hf', 'upload', args.repo, duckdbPath, 'kb.duckdb', '--repo-type', 'dataset'])
} else {
  console.log(`\n=== 3. Skipping kb.duckdb (--skipDuckdb or file missing) ===`)
}

console.log(`\n=== 4. Verify visibility ===`)
const url = `https://huggingface.co/datasets/${args.repo}`
const probe = await fetch(url)
console.log(`  GET ${url} → HTTP ${probe.status}`)
if (probe.status === 200) {
  console.log(`  ✓ public`)
} else {
  console.log(`  check https://huggingface.co/datasets/${args.repo}/settings`)
}

console.log(`\n✓ Done. ${url}`)
