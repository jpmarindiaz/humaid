// Push the training dataset (JSONL + image tree) to a public HuggingFace dataset repo.
//
// Pushes:
//   - data/flood_train.jsonl
//   - data/flood_eval.jsonl
//   - data/images/  (the deduped image tree referenced from the JSONL)
//   - a generated dataset card (README.md)
//
// Usage:
//   deno task hf:push:dataset
//   deno task hf:push:dataset --repo "jpmarindiaz/flood-detection-pair-colombia" --private

import { parseArgs } from '@std/cli/parse-args'

const args = parseArgs(Deno.args, {
  string: ['repo', 'dataDir'],
  boolean: ['private', 'skipCard'],
  default: {
    repo: 'jpmarindiaz/flood-detection-pair-colombia',
    dataDir: 'data',
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

const trainPath = `${args.dataDir}/flood_train.jsonl`
const evalPath = `${args.dataDir}/flood_eval.jsonl`
const imagesDir = `${args.dataDir}/images`
for (const p of [trainPath, evalPath, imagesDir]) {
  if (!(await exists(p))) {
    console.error(`✗ missing ${p}. Run \`deno task build\` first.`)
    Deno.exit(1)
  }
}

const whoami = new Deno.Command('hf', { args: ['auth', 'whoami'], stdout: 'piped', stderr: 'piped' })
const w = await whoami.output()
if (w.code !== 0) {
  console.error('✗ hf not authenticated. Run: hf auth login')
  Deno.exit(1)
}
console.log(`▶ HF user: ${new TextDecoder().decode(w.stdout).trim()}`)

// Stats for the dataset card.
const trainLines = (await Deno.readTextFile(trainPath)).split('\n').filter((l) => l.trim()).length
const evalLines = (await Deno.readTextFile(evalPath)).split('\n').filter((l) => l.trim()).length
console.log(`▶ ${trainLines} train + ${evalLines} eval pair samples`)
console.log(`▶ target repo: https://huggingface.co/datasets/${args.repo}  (${args.private ? 'private' : 'public'})`)

// ============== Generate dataset card ==============

const today = new Date().toISOString().slice(0, 10)
const card = `---
language:
- en
- es
license: cc-by-4.0
task_categories:
- image-text-to-text
- image-to-text
size_categories:
- n<1K
tags:
- flood
- sentinel-2
- colombia
- la-mojana
- putumayo
- humanitarian
- vision-language
- pair-comparison
configs:
- config_name: default
  data_files:
  - split: train
    path: flood_train.jsonl
  - split: eval
    path: flood_eval.jsonl
---

# flood-detection-pair-colombia

${trainLines + evalLines} paired Sentinel-2 satellite tile samples (4 PNGs per row) labeled for flood detection across 9 documented flood events in Colombia. Built for fine-tuning a small vision-language model that runs on a satellite or community ground station — see the [humaid project](https://github.com/jpmarindiaz/humaid).

## What's in each sample

Each row in \`flood_train.jsonl\` / \`flood_eval.jsonl\` is a 4-image \`vlm_sft\` example. The user message contains four image content blocks (in this order) followed by a text instruction; the assistant message is the structured JSON labels.

\`\`\`
user: [RGB-baseline] [SWIR-baseline] [RGB-current] [SWIR-current] "Label this tile pair..."
assistant: {"flood_present": ..., "flood_severity": ..., ...}
\`\`\`

The four images are Sentinel-2 tiles, ~5 km × 5 km:
- **RGB-baseline** (B4-B3-B2 true color) at a pre-event timestamp (typically 14–28 days before the event)
- **SWIR-baseline** (B12-B8-B4 false color) at the same timestamp — water absorbs SWIR strongly so flood water reads near-black, healthy vegetation as green, dry soil as pink/magenta
- **RGB-current** at the timestamp to assess
- **SWIR-current** at the same timestamp

## Why pair input

A town surrounded by chronic ciénaga (the La Mojana wetland baseline) looks identical to a flooded town in any single tile. With the baseline, the labeler can compare and decide whether water *increased* — well-defined. Without it, single-tile labeling on La Mojana sees ~25–37% labeler disagreement. See [the project's labeling docs](https://github.com/jpmarindiaz/humaid/blob/main/finetune-flood/docs/03-labeling.md).

## Schema (7 fields)

| field | type | meaning |
|---|---|---|
| \`flood_present\` | bool | new water on land vs baseline |
| \`flood_severity\` | none / minor / moderate / severe | newly inundated land vs baseline (0% / <5% / 5–20% / >20%) |
| \`water_coverage_pct_estimate\` | <10% / 10-30% / 30-60% / >60% | total water in the current view |
| \`populated_area_affected\` | bool | new water near settlements |
| \`infrastructure_at_risk\` | bool | roads / bridges / buildings inundated or threatened |
| \`river_overflow_visible\` | bool | river out of its banks vs baseline |
| \`image_quality_limited\` | bool | abstention signal — clouds / partial coverage |

## Locations (14)

**La Mojana / Depresión Momposina (8):** San Jacinto del Cauca, Ayapel, San Benito Abad, Guaranda, Majagual, Caimito, Sucre cabecera, San Marcos.

**Putumayo (6):** Mocoa, Puerto Asís, Puerto Guzmán, Colón, Santiago, Puerto Leguízamo.

## Events (9)

| id | date | region | source |
|---|---|---|---|
| \`cara_de_gato_2021\` | 2021-08-27 | La Mojana | dike breach #1 |
| \`la_mojana_peak_2022\` | 2022-04-17 | La Mojana | ~590,000 ha flooded |
| \`cara_de_gato_2024\` | 2024-05-06 | La Mojana | dike breach #2 |
| \`los_arrastres_2024\` | 2024-05-08 | La Mojana | second May 2024 breach |
| \`la_mojana_peak_2024\` | 2024-06-11 | La Mojana | ~860,000 ha — worst peak of 2024 |
| \`cara_de_gato_2025\` | 2025-08-27 | La Mojana | dike breach #3 |
| \`mocoa_avalancha_2017\` | 2017-04-01 | Putumayo | avalancha torrencial, 335 fatalities |
| \`puerto_leguizamo_calamidad_2025\` | 2025-04-10 | Putumayo | calamidad pública (Río Putumayo) |
| \`putumayo_decreto_0472_2025\` | 2025-07-23 | Putumayo | departmental calamidad — 16,975 damnificados |

For each \`(location, event)\` we generated up to 2 samples: \`(pre, event)\` and \`(pre, post)\`.

## Splits

- **train**: ${trainLines} samples
- **eval**: ${evalLines} samples (latest 20% by current-window timestamp — temporal split, not random, to avoid Sentinel-2's 5-day revisit leaking near-duplicates across train/eval)

## Labeling

Labels were produced by Claude Code agents (Opus class) reading the 4-image input pair and applying a system prompt that includes:
- color semantics for RGB and SWIR false-color views
- change-detection rules (water on land in current that was dry in baseline = flooding)
- severity bands anchored on land-area percentages
- regional context (La Mojana wetland baseline, Bajo Putumayo lowland river floodplains, Mocoa avalancha mechanism)

Inter-labeler agreement (Sonnet vs Opus on subsets) is 0.66–0.68 overall. The hardest fields (\`flood_severity\`, \`water_coverage_pct_estimate\`) have agreement of 0.43–0.70 — these are subjective enums where two readings of the same image disagree at the boundaries.

## Known limitations

1. **Mocoa avalancha 2017 has no true pre-event Sentinel-2 acquisitions.** S2 archive coverage over Mocoa was sparse before mid-2017. We use a 2017-08-15 stand-in baseline (post-recovery, terrain stable). Annotation flags this with a \`note\` field.
2. **High proportion of cloud-limited tiles.** ~70% of pairs have \`image_quality_limited=true\` because La Mojana wet-season cloud cover dominates Sentinel-2. The model is trained to abstain on these.
3. **No human verification.** Labels are model-generated. Inter-labeler agreement is the only validation signal. To turn this into operational ground truth, ~10% needs human (or remote-sensing-analyst) review.

## How it was built

The full data-collection pipeline is in the [humaid repo](https://github.com/jpmarindiaz/humaid):

- \`finetune-flood/src/locations.ts\`, \`events.ts\` — declarative locations + event anchors
- \`finetune-flood/src/generate.ts\` — Sentinel-2 candidate-date sweep + cloud-aware fetcher (via SimSat)
- \`finetune-flood/src/label_agents.ts\`, \`label_anthropic.ts\` — pair-aware labeling
- \`finetune-flood/src/build_dataset.ts\` — dedupes \`(location, event, window)\`, splits temporally, writes \`vlm_sft\` JSONL

Generated ${today} as part of the humaid project.

## License

CC-BY-4.0 for the labels and dataset structure. The underlying Sentinel-2 imagery is from the European Copernicus programme (free and open data, [terms](https://scihub.copernicus.eu/twiki/do/view/SciHubWebPortal/TermsConditions)).
`

if (!args.skipCard) {
  await Deno.writeTextFile('data/README.md', card)
  console.log(`▶ wrote dataset card → data/README.md`)
}

// ============== Create repo + push ==============

console.log(`\n=== 1. Ensure dataset repo exists (public) ===`)
const visFlag = args.private ? '--private' : '--public'
await run(['hf', 'repos', 'create', args.repo, '--type', 'dataset', visFlag, '--exist-ok'])

console.log(`\n=== 2. Push README + JSONLs ===`)
await run(['hf', 'upload', args.repo, 'data/README.md', 'README.md', '--repo-type', 'dataset'])
await run(['hf', 'upload', args.repo, trainPath, 'flood_train.jsonl', '--repo-type', 'dataset'])
await run(['hf', 'upload', args.repo, evalPath, 'flood_eval.jsonl', '--repo-type', 'dataset'])

console.log(`\n=== 3. Push image tree (~140 MB) ===`)
// `hf upload` handles folders too. Local `data/images` → repo `images/`.
await run(['hf', 'upload', args.repo, imagesDir, 'images', '--repo-type', 'dataset'])

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
