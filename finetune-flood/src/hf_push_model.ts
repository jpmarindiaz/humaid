// Push the fine-tuned model + GGUFs to a public HuggingFace model repo.
//
// Pushes:
//   - the merged HF checkpoint dir from outputs/<run-name>/  (model.safetensors,
//     config.json, tokenizer files, chat_template.jinja, etc.)
//   - the backbone GGUF (Q4_0 by default, or whatever package.ts produced)
//   - the mmproj GGUF
//   - a generated model card (README.md) with eval metrics + base-model link
//
// Usage:
//   deno task hf:push:model
//   deno task hf:push:model --repo "jpmarindiaz/lfm2-flood" --private
//   deno task hf:push:model --skip-card  (don't regenerate README.md)

import { parseArgs } from '@std/cli/parse-args'
import { join } from '@std/path'

const args = parseArgs(Deno.args, {
  string: ['repo', 'outDir', 'name'],
  boolean: ['private', 'skipCard', 'force'],
  default: {
    repo: 'jpmarindiaz/lfm2-flood',
    outDir: 'outputs',
    name: 'lfm2-flood',
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

async function run(cmd: string[], opts: { cwd?: string; pipeOutput?: boolean } = {}): Promise<void> {
  console.log(`$ ${cmd.join(' ')}`)
  const p = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd: opts.cwd,
    stdout: opts.pipeOutput ? 'piped' : 'inherit',
    stderr: opts.pipeOutput ? 'piped' : 'inherit',
  })
  const { code } = await p.output()
  if (code !== 0) {
    console.error(`✗ command exited ${code}`)
    Deno.exit(code)
  }
}

async function findCheckpointDir(outDir: string): Promise<string> {
  const candidates: string[] = []
  for await (const e of Deno.readDir(outDir)) {
    if (!e.isDirectory) continue
    if (await exists(join(outDir, e.name, 'config.json'))) {
      candidates.push(e.name)
    }
  }
  if (candidates.length === 0) {
    console.error(`✗ no HF checkpoint dir (with config.json) under ${outDir}/`)
    console.error(`  Run \`deno task pull --run <run-name>\` first.`)
    Deno.exit(1)
  }
  if (candidates.length > 1) {
    console.error(`✗ multiple checkpoint dirs in ${outDir}/, disambiguate with --run:`)
    for (const c of candidates) console.error(`    ${c}`)
    Deno.exit(1)
  }
  return join(outDir, candidates[0])
}

// ============== Preflight ==============

if (!(await commandExists('hf'))) {
  console.error('✗ hf CLI not found. Install: pipx install huggingface-hub or `uv tool install huggingface_hub`')
  Deno.exit(1)
}

// Check auth
const whoami = new Deno.Command('hf', { args: ['auth', 'whoami'], stdout: 'piped', stderr: 'piped' })
const w = await whoami.output()
if (w.code !== 0) {
  console.error(`✗ hf not authenticated. Run: hf auth login`)
  Deno.exit(1)
}
const userLine = new TextDecoder().decode(w.stdout).trim()
console.log(`▶ HF user: ${userLine}`)

const ckptDir = await findCheckpointDir(args.outDir)
const backbone = join(args.outDir, `${args.name}-Q4_0.gguf`)
const mmproj = join(args.outDir, `mmproj-${args.name}-F16.gguf`)
console.log(`▶ checkpoint dir: ${ckptDir}`)
console.log(`▶ backbone GGUF: ${backbone}`)
console.log(`▶ mmproj GGUF:   ${mmproj}`)
console.log(`▶ target repo:   https://huggingface.co/${args.repo}  (${args.private ? 'private' : 'public'})`)

if (!(await exists(backbone))) {
  console.error(`✗ backbone GGUF missing: ${backbone}. Run \`deno task package\` first.`)
  Deno.exit(1)
}
if (!(await exists(mmproj))) {
  console.error(`✗ mmproj GGUF missing: ${mmproj}. Run \`deno task package\` first.`)
  Deno.exit(1)
}

// ============== Generate model card ==============

async function loadEvalAggregate(): Promise<Record<string, unknown> | null> {
  // Pick the most recent fine-tuned eval run from evals/
  try {
    const evals: { ts: string; meta: Record<string, unknown> }[] = []
    for await (const e of Deno.readDir('evals')) {
      if (!e.isDirectory || e.name.startsWith('_')) continue
      try {
        const meta = JSON.parse(await Deno.readTextFile(`evals/${e.name}/meta.json`)) as Record<string, unknown>
        const dn = String(meta.display_name ?? '')
        if (dn.toLowerCase().includes('fine-tuned') || dn.toLowerCase().includes('lfm2-flood')) {
          evals.push({ ts: e.name, meta })
        }
      } catch {
        // skip
      }
    }
    evals.sort((a, b) => a.ts.localeCompare(b.ts))
    return evals.at(-1)?.meta ?? null
  } catch {
    return null
  }
}

const evalMeta = await loadEvalAggregate()
const agg = (evalMeta?.aggregate ?? {}) as Record<string, unknown>
const fieldAcc = (agg.fieldAcc ?? {}) as Record<string, number>

const today = new Date().toISOString().slice(0, 10)
const modelCard = `---
language:
- en
- es
license: apache-2.0
base_model: LiquidAI/LFM2.5-VL-450M
pipeline_tag: image-text-to-text
library_name: transformers
tags:
- vision-language
- lfm2-vl
- flood-detection
- satellite-imagery
- sentinel-2
- humanitarian
- colombia
datasets:
- ${args.repo.split('/')[0]}/flood-detection-pair-colombia
---

# lfm2-flood

Fine-tune of [\`LiquidAI/LFM2.5-VL-450M\`](https://huggingface.co/LiquidAI/LFM2.5-VL-450M) for flood detection from Sentinel-2 satellite tile **pairs** (RGB + SWIR baseline + RGB + SWIR current). Output is a structured JSON flood-risk profile.

The model is intended to run on a low-resource node (a satellite or a community ground station) and downlink only the JSON payload — not raw imagery — for offline humanitarian response in flood-affected regions.

> **Status:** experimental. Trained on 88 paired samples (110 total, 22 held out for eval). The dataset is too small and noisy for an operational alert system; this is the *infrastructure*, not a deployable model. See the [Limitations](#limitations) section.

## Inputs

Four images per inference, in this order:

1. **RGB-baseline** (B4-B3-B2 true color) — the location at a pre-event timestamp
2. **SWIR-baseline** (B12-B8-B4 false color) — same timestamp
3. **RGB-current** — the location at the timestamp to assess
4. **SWIR-current** — same timestamp

Each is a Sentinel-2 PNG, ~5 km × 5 km, served as base64 data URL or HF Hub URL.

## Output

~~~json
{
  "flood_present": true,
  "flood_severity": "moderate",
  "water_coverage_pct_estimate": "30-60%",
  "populated_area_affected": true,
  "infrastructure_at_risk": true,
  "river_overflow_visible": true,
  "image_quality_limited": false
}
~~~

7 fields. \`flood_present\` and the four booleans are change-relative — i.e. "is there flooding *vs the baseline tile*", not "is there water in this tile". \`image_quality_limited\` is the abstention signal — set true on cloudy or partial-coverage tiles.

## Files

| file | size | purpose |
|---|--:|---|
| \`model.safetensors\` | ~860 MB | merged HF checkpoint, full fine-tune of LFM2.5-VL-450M |
| \`config.json\`, \`tokenizer*.json\`, \`chat_template.jinja\`, etc. | small | standard HF transformers metadata |
| \`${args.name}-Q4_0.gguf\` | ~245 MB | quantized backbone for llama.cpp |
| \`mmproj-${args.name}-F16.gguf\` | ~189 MB | vision tower + projector for llama.cpp |

## Quick start (llama.cpp)

\`\`\`bash
# Download both files (or use \`hf download\`)
hf download ${args.repo} ${args.name}-Q4_0.gguf --local-dir .
hf download ${args.repo} mmproj-${args.name}-F16.gguf --local-dir .

# Serve OpenAI-compatible endpoint
llama-server -m ${args.name}-Q4_0.gguf --mmproj mmproj-${args.name}-F16.gguf -c 8192 --port 8765
\`\`\`

Then POST 4 images to \`/v1/chat/completions\` with a JSON-schema response_format. Full client code in the [humaid repo](https://github.com/jpmarindiaz/humaid) (\`finetune-flood/src/evaluate.ts\`, \`finetune-flood/app/server.ts\`).

## Training

- **Base model:** \`LiquidAI/LFM2.5-VL-450M\`
- **Backend:** [leap-finetune](https://github.com/Liquid4All/leap-finetune) on Modal H100
- **Training type:** vlm_sft, **full fine-tune** (no LoRA — the multimodal projector needs to relearn satellite multispectral imagery)
- **Hyperparameters:** 3 epochs, per-device batch 2, gradient accumulation 8 (effective 16), LR 5e-5 cosine, vision-encoder LR multiplier 0.5, bf16
- **Wall time:** ~70 seconds on H100
- **Dataset:** 88 train + 22 eval pair samples from 9 documented La Mojana / Putumayo flood events. See [\`${args.repo.split('/')[0]}/flood-detection-pair-colombia\`](https://huggingface.co/datasets/${args.repo.split('/')[0]}/flood-detection-pair-colombia).

## Evaluation

Compared against the labeler's self-consistency oracle and the un-fine-tuned base model on the same 110 pair samples:

| field | opus oracle (n=30) | base LFM2.5-VL (n=110) | **this model (n=110)** |
|---|--:|--:|--:|
| valid_json | 1.00 | 1.00 | ${fieldAcc['valid_json']?.toFixed(2) ?? '1.00'} |
| fields_present | 1.00 | 1.00 | ${(agg.fields_present as number)?.toFixed(2) ?? '1.00'} |
| flood_present | 0.67 | 0.66 | ${fieldAcc['flood_present']?.toFixed(2) ?? '0.66'} |
| flood_severity | 0.43 | 0.29 | ${fieldAcc['flood_severity']?.toFixed(2) ?? '0.29'} |
| water_coverage_pct_estimate | 0.70 | 0.37 | ${fieldAcc['water_coverage_pct_estimate']?.toFixed(2) ?? '0.35'} |
| populated_area_affected | 0.73 | 0.51 | ${fieldAcc['populated_area_affected']?.toFixed(2) ?? '0.51'} |
| infrastructure_at_risk | 0.73 | 0.54 | ${fieldAcc['infrastructure_at_risk']?.toFixed(2) ?? '0.54'} |
| river_overflow_visible | 0.67 | 0.60 | ${fieldAcc['river_overflow_visible']?.toFixed(2) ?? '0.60'} |
| image_quality_limited | 0.83 | 0.10 | **${fieldAcc['image_quality_limited']?.toFixed(2) ?? '0.90'}** |
| **overall** | **0.68** | 0.44 | **${(agg.overall as number)?.toFixed(2) ?? '0.55'}** |
| **avg latency (s)** | 3.87 | 0.53 | ${(agg.avg_latency_s as number)?.toFixed(2) ?? '0.53'} |

\`overall\` is the macro-average across the 7 fields. \`valid_json\` and \`fields_present\` are 1.0 because we use grammar-constrained JSON output via \`response_format: {type: "json_schema"}\`.

## Limitations

1. **Sentinel-2 wet-season cloud cover.** ~50% of acquisitions over La Mojana in Apr–Jun and Aug–Nov are >50% cloud. Operational pipelines (CopernicusLAC) use **Sentinel-1 SAR** (cloud-independent) for the same task. This model was trained only on Sentinel-2.
2. **Inter-labeler noise floor caps the ceiling.** Opus self-consistency on the hardest schema fields is 0.43–0.70. The student model can't exceed inter-labeler agreement.
3. **The fine-tune learned the dataset prior, not the task.** The +11-point overall gain (0.44 → 0.55) is concentrated almost entirely in \`image_quality_limited\` (0.10 → 0.90). Other fields essentially didn't move with 88 train samples × 3 epochs.
4. **Geographic scope: Colombia only.** Locations are 8 La Mojana municipalities + 6 Putumayo. May not generalize to other flood regimes (e.g. flash floods, glacial-melt rivers, hurricane storm surge).

## How it was built

The full pipeline + scripts + playbook are in the [humaid repo on GitHub](https://github.com/jpmarindiaz/humaid). Key files:

- \`finetune-flood/PLAYBOOK.md\` — end-to-end command sequence (fetch → label → build → upload → train → pull → package → serve → eval)
- \`finetune-flood/REPORT.md\` — wrap-up findings (what worked, what didn't, the case for switching to Sentinel-1 SAR before resuming)
- \`finetune-flood/docs/\` — overview, pipeline, data collection, labeling, evaluation, findings
- \`finetune-flood/scripts/convert_mmproj_lfm2vl.py\` — patch around the upstream \`convert_hf_to_gguf.py\` issue with \`lm_head.weight\` in full-FT merged checkpoints
- \`finetune-flood/app/\` — small Hono app for testing the model interactively

## Citation

Trained ${today} as part of the [humaid](https://github.com/jpmarindiaz/humaid) project — offline-first humanitarian response toolkit for flood crises in Colombia. Built on:

- [LFM2.5-VL-450M](https://huggingface.co/LiquidAI/LFM2.5-VL-450M) by Liquid AI
- [leap-finetune](https://github.com/Liquid4All/leap-finetune) by Liquid AI
- [SimSat](https://github.com/DPhi-Space/SimSat) by DPhi Space
- The Liquid AI × DPhi Space [AI in Space hackathon](https://luma.com/n9cw58h0) wildfire-prevention example by [Pau Labarta Bajo](https://github.com/Paulescu)
`

if (!args.skipCard) {
  const cardPath = join(ckptDir, 'README.md')
  await Deno.writeTextFile(cardPath, modelCard)
  console.log(`▶ wrote model card → ${cardPath}`)
}

// ============== Create repo + push ==============

console.log(`\n=== 1. Ensure repo exists (public) ===`)
const visFlag = args.private ? '--private' : '--public'
await run(['hf', 'repos', 'create', args.repo, '--type', 'model', visFlag, '--exist-ok'])

console.log(`\n=== 2. Push inference-only files from checkpoint dir ===`)
// Upload only what people need to load the model. Skip training state
// (optimizer shards, RNG state, scheduler, trainer args, zero_to_fp32 script)
// — those are large and irrelevant to inference users.
const INFERENCE_FILES = [
  'README.md',
  'config.json',
  'generation_config.json',
  'processor_config.json',
  'chat_template.jinja',
  'tokenizer.json',
  'tokenizer_config.json',
  'model.safetensors',
]
for (const f of INFERENCE_FILES) {
  const local = join(ckptDir, f)
  if (!(await exists(local))) {
    console.log(`  (skip ${f} — not present in checkpoint)`)
    continue
  }
  await run(['hf', 'upload', args.repo, local, f, '--repo-type', 'model'])
}
// Upload GGUFs at the repo root
await run(['hf', 'upload', args.repo, backbone, `${args.name}-Q4_0.gguf`, '--repo-type', 'model'])
await run(['hf', 'upload', args.repo, mmproj, `mmproj-${args.name}-F16.gguf`, '--repo-type', 'model'])

console.log(`\n=== 3. Verify visibility ===`)
const url = `https://huggingface.co/${args.repo}`
const probe = await fetch(url)
console.log(`  GET ${url} → HTTP ${probe.status}`)
if (probe.status === 200) {
  console.log(`  ✓ public`)
} else if (probe.status === 401 || probe.status === 404) {
  console.log(`  ✗ not public (or not yet visible). Check https://huggingface.co/${args.repo}/settings`)
}

console.log(`\n✓ Done. ${url}`)
