// Evaluation pipeline for pair-labeled tiles. Walks a directory of CURRENT
// (event/post) tiles whose annotation.json contains a "baseline" reference to
// a pre tile dir, runs a backend on the 4-image input (RGB-pre + SWIR-pre +
// RGB-current + SWIR-current), and compares the prediction's JSON labels
// against ground truth.
//
//   evals/<run-ts>/
//     ├── meta.json        (model, backend, dataset, split, n_samples, started/finished)
//     ├── results.json     (per-sample: id, ground_truth, prediction, per_field_match)
//     └── report.md        (human-readable accuracy table)
//
// Mirrors Pau Labarta Bajo's wildfire-prevention example layout.
//
// Backends:
//   --backend anthropic --model claude-opus-4-6
//   --backend local --url http://localhost:8080 [--model lfm2-flood]
//
// Usage:
//   deno task eval --raw data/raw/<run-ts> --backend anthropic
//   deno task eval --raw data/raw/<run-ts> --backend local --url http://localhost:8080
//   deno task eval --raw data/raw/<run-ts> --backend anthropic --limit 10

import { parseArgs } from '@std/cli/parse-args'
import { ensureDir, walk } from '@std/fs'
import { dirname, join } from '@std/path'
import { encodeBase64 } from '@std/encoding/base64'
import Anthropic from '@anthropic-ai/sdk'

import { FLOOD_LABEL_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from './prompts.ts'

const args = parseArgs(Deno.args, {
  string: ['raw', 'backend', 'model', 'url', 'limit', 'concurrency', 'name'],
  default: {
    backend: 'anthropic',
    model: 'claude-opus-4-6',
    url: 'http://localhost:8080',
    concurrency: '3',
  },
})

if (!args.raw) {
  console.error('--raw <data/raw/<run-ts>> is required (directory of pair-labeled tile dirs)')
  Deno.exit(1)
}

const concurrency = Number(args.concurrency)
const limit = args.limit ? Number(args.limit) : Infinity

// ============== Backends ==============

interface Backend {
  name: string
  description: string
  predict(images: { preRgb: Uint8Array; preSwir: Uint8Array; curRgb: Uint8Array; curSwir: Uint8Array }): Promise<Record<string, unknown>>
}

interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

function anthropicBackend(model: string): Backend {
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
  return {
    name: model,
    description: `anthropic API, model=${model}`,
    async predict({ preRgb, preSwir, curRgb, curSwir }) {
      const resp = await client.messages.create({
        model,
        max_tokens: 1024,
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ],
        tools: [
          {
            name: 'report_flood_assessment',
            description: 'Submit the structured flood-risk assessment for the tile pair.',
            input_schema: FLOOD_LABEL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'report_flood_assessment' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: encodeBase64(preRgb) } },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: encodeBase64(preSwir) } },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: encodeBase64(curRgb) } },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: encodeBase64(curSwir) } },
              { type: 'text', text: USER_PROMPT },
            ],
          },
        ],
      })
      const block = resp.content.find((c): c is ToolUseBlock => c.type === 'tool_use')
      if (!block) throw new Error('no tool_use block')
      return block.input
    },
  }
}

// llama-server speaks OpenAI's chat completions API. Sends 4 image_url content
// blocks with data: URLs (base64 PNG). Critically: the local model has no
// tool_use enforcement, so we have to inject the schema into the prompt
// explicitly. Without this, the model improvises key names and scores 0.
// llama.cpp also supports `response_format: { type: 'json_schema', ... }`
// which constrains generation via grammar — we use that when available.
function llamaServerBackend(url: string, model: string): Backend {
  const schemaInstruction =
    `You MUST output a single JSON object with exactly these 7 keys, no additional keys, no prose:\n` +
    `  flood_present: boolean\n` +
    `  flood_severity: one of "none" | "minor" | "moderate" | "severe"\n` +
    `  water_coverage_pct_estimate: one of "<10%" | "10-30%" | "30-60%" | ">60%"\n` +
    `  populated_area_affected: boolean\n` +
    `  infrastructure_at_risk: boolean\n` +
    `  river_overflow_visible: boolean\n` +
    `  image_quality_limited: boolean\n` +
    `Example shape (values are illustrative, not the answer):\n` +
    `  {"flood_present": true, "flood_severity": "moderate", "water_coverage_pct_estimate": "10-30%", "populated_area_affected": true, "infrastructure_at_risk": true, "river_overflow_visible": true, "image_quality_limited": false}`

  return {
    name: model,
    description: `llama-server at ${url}, model=${model}`,
    async predict({ preRgb, preSwir, curRgb, curSwir }) {
      const body = {
        model,
        max_tokens: 1024,
        temperature: 0.0,
        // llama.cpp grammar-constrained JSON output. If the server doesn't
        // support response_format it ignores the field and falls back to
        // plain generation; the schema-in-prompt above still helps.
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'flood_assessment',
            strict: true,
            schema: FLOOD_LABEL_SCHEMA,
          },
        },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/png;base64,${encodeBase64(preRgb)}` } },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${encodeBase64(preSwir)}` } },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${encodeBase64(curRgb)}` } },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${encodeBase64(curSwir)}` } },
              { type: 'text', text: `${USER_PROMPT}\n\n${schemaInstruction}` },
            ],
          },
        ],
      }
      const resp = await fetch(`${url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        throw new Error(`llama-server ${resp.status}: ${(await resp.text()).slice(0, 300)}`)
      }
      const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const text = json.choices?.[0]?.message?.content ?? ''
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error(`no JSON object in response: ${text.slice(0, 200)}`)
      return JSON.parse(match[0]) as Record<string, unknown>
    },
  }
}

function buildBackend(): Backend {
  if (args.backend === 'anthropic') return anthropicBackend(args.model)
  if (args.backend === 'local') return llamaServerBackend(args.url, args.model)
  throw new Error(`unknown backend ${args.backend}`)
}

// ============== Sample loading ==============

interface Sample {
  id: string
  preRgbPath: string
  preSwirPath: string
  curRgbPath: string
  curSwirPath: string
  groundTruth: Record<string, unknown>
}

async function loadSamples(rawDir: string): Promise<Sample[]> {
  const samples: Sample[] = []
  for await (const entry of walk(rawDir, { exts: ['.json'] })) {
    if (!entry.path.endsWith('annotation.json')) continue
    const ann = JSON.parse(await Deno.readTextFile(entry.path)) as {
      location_id?: string
      event_id?: string
      window_kind?: string
      labels?: Record<string, unknown>
      baseline?: { tile_dir?: string }
    }
    if (!ann.baseline?.tile_dir || !ann.labels) continue
    if (ann.window_kind !== 'event' && ann.window_kind !== 'post') continue
    const curTileDir = dirname(entry.path)
    const preTileDir = ann.baseline.tile_dir
    const curRgb = join(curTileDir, 'rgb.png')
    const curSwir = join(curTileDir, 'swir.png')
    const preRgb = join(preTileDir, 'rgb.png')
    const preSwir = join(preTileDir, 'swir.png')
    let usable = true
    for (const p of [curRgb, curSwir, preRgb, preSwir]) {
      try {
        await Deno.stat(p)
      } catch {
        usable = false
        break
      }
    }
    if (!usable) continue
    const id = `${ann.location_id ?? '?'}/${ann.event_id ?? '?'}/${ann.window_kind}`
    samples.push({ id, preRgbPath: preRgb, preSwirPath: preSwir, curRgbPath: curRgb, curSwirPath: curSwir, groundTruth: ann.labels })
  }
  samples.sort((a, b) => a.id.localeCompare(b.id))
  return samples
}

// ============== Scoring ==============

const FIELDS = [
  'flood_present',
  'flood_severity',
  'water_coverage_pct_estimate',
  'populated_area_affected',
  'infrastructure_at_risk',
  'river_overflow_visible',
  'image_quality_limited',
] as const
type Field = typeof FIELDS[number]

interface FieldMatches {
  valid_json: boolean
  fields_present: boolean
  per_field: Record<Field, 'match' | 'mismatch' | 'missing'>
}

function compare(gt: Record<string, unknown>, pred: Record<string, unknown> | null): FieldMatches {
  const valid_json = pred !== null
  const fields_present = valid_json && FIELDS.every((f) => f in (pred as object))
  const per_field = {} as Record<Field, 'match' | 'mismatch' | 'missing'>
  for (const f of FIELDS) {
    if (!pred || !(f in pred)) per_field[f] = 'missing'
    else if (JSON.stringify(pred[f]) === JSON.stringify(gt[f])) per_field[f] = 'match'
    else per_field[f] = 'mismatch'
  }
  return { valid_json, fields_present, per_field }
}

// ============== Run ==============

interface SampleResult {
  id: string
  ground_truth: Record<string, unknown>
  prediction: Record<string, unknown> | null
  error: string | null
  latency_s: number
  matches: FieldMatches
}

async function runOne(sample: Sample, backend: Backend): Promise<SampleResult> {
  const [preRgb, preSwir, curRgb, curSwir] = await Promise.all([
    Deno.readFile(sample.preRgbPath),
    Deno.readFile(sample.preSwirPath),
    Deno.readFile(sample.curRgbPath),
    Deno.readFile(sample.curSwirPath),
  ])
  const t0 = performance.now()
  let prediction: Record<string, unknown> | null = null
  let error: string | null = null
  try {
    prediction = await backend.predict({ preRgb, preSwir, curRgb, curSwir })
  } catch (err) {
    error = (err as Error).message
  }
  const latency_s = (performance.now() - t0) / 1000
  const matches = compare(sample.groundTruth, prediction)
  return { id: sample.id, ground_truth: sample.groundTruth, prediction, error, latency_s, matches }
}

async function runAll(samples: Sample[], backend: Backend): Promise<SampleResult[]> {
  const out: SampleResult[] = new Array(samples.length)
  let cursor = 0
  let done = 0
  async function pump() {
    while (true) {
      const i = cursor++
      if (i >= samples.length) return
      const r = await runOne(samples[i], backend)
      out[i] = r
      done++
      const status = r.error
        ? `error: ${r.error.slice(0, 60)}`
        : r.matches.valid_json
        ? `${Object.values(r.matches.per_field).filter((s) => s === 'match').length}/${FIELDS.length} match`
        : 'invalid JSON'
      console.log(`  [${done}/${samples.length}] ${r.id}: ${status} (${r.latency_s.toFixed(2)}s)`)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, pump))
  return out
}

// ============== Aggregation + report ==============

function aggregate(results: SampleResult[]) {
  const n = results.length
  const valid_json = results.filter((r) => r.matches.valid_json).length / n
  const fields_present = results.filter((r) => r.matches.fields_present).length / n
  const fieldAcc = {} as Record<Field, number>
  for (const f of FIELDS) {
    fieldAcc[f] = results.filter((r) => r.matches.per_field[f] === 'match').length / n
  }
  const overall = Object.values(fieldAcc).reduce((a, b) => a + b, 0) / FIELDS.length
  const avg_latency_s = results.reduce((a, r) => a + r.latency_s, 0) / n
  return { n, valid_json, fields_present, fieldAcc, overall, avg_latency_s }
}

function reportMd(
  meta: Record<string, unknown>,
  agg: ReturnType<typeof aggregate>,
  results: SampleResult[],
  samples: Sample[],
): string {
  const lines: string[] = []
  lines.push(`# Eval ${meta.run_id}\n`)
  lines.push(`- **Backend**: ${meta.backend_description}`)
  lines.push(`- **Dataset**: ${meta.dataset}`)
  lines.push(`- **Display name**: ${meta.display_name}`)
  lines.push(`- **Samples**: ${agg.n} (4-image pair samples: RGB-pre + SWIR-pre + RGB-current + SWIR-current)`)
  lines.push(`- **Started**: ${meta.started_at}`)
  lines.push(`- **Finished**: ${meta.finished_at}\n`)

  lines.push(`## Accuracy by field\n`)
  lines.push(`| field | accuracy |`)
  lines.push(`|---|---|`)
  lines.push(`| valid_json | ${agg.valid_json.toFixed(2)} |`)
  lines.push(`| fields_present | ${agg.fields_present.toFixed(2)} |`)
  for (const f of FIELDS) lines.push(`| ${f} | ${agg.fieldAcc[f].toFixed(2)} |`)
  lines.push(`| **overall** | **${agg.overall.toFixed(2)}** |`)
  lines.push(`| **avg latency (s)** | **${agg.avg_latency_s.toFixed(2)}** |`)
  lines.push('')

  // Top mismatches per field — useful to see WHERE the model disagrees.
  lines.push(`## Most-disagreed fields\n`)
  const fieldRanked = [...FIELDS].sort((a, b) => agg.fieldAcc[a] - agg.fieldAcc[b]).slice(0, 3)
  for (const f of fieldRanked) {
    const mismatches = results.filter((r) => r.matches.per_field[f] === 'mismatch').slice(0, 5)
    lines.push(`### \`${f}\` (acc ${agg.fieldAcc[f].toFixed(2)})\n`)
    if (mismatches.length === 0) {
      lines.push(`No mismatches.\n`)
      continue
    }
    lines.push(`| sample | ground truth | prediction |`)
    lines.push(`|---|---|---|`)
    for (const m of mismatches) {
      const gt = JSON.stringify(m.ground_truth[f])
      const pr = JSON.stringify((m.prediction ?? {})[f])
      lines.push(`| \`${m.id}\` | ${gt} | ${pr} |`)
    }
    lines.push('')
  }

  // Worst samples (most fields wrong) — embed the imagery so a human can
  // open the report and immediately see what the model saw. Image paths are
  // relative to the report's location (evals/<run-id>/report.md), so we
  // build paths up to the project root.
  lines.push(`## Worst samples (5 with the most mismatched fields)\n`)
  lines.push(
    `Each sample shows the four-image input the model received: ` +
      `RGB-baseline, SWIR-baseline, RGB-current, SWIR-current. ` +
      `Compare the labeler's call (ground_truth) against the model's call (prediction).\n`,
  )
  const worst = [...results].sort((a, b) => {
    const bw = Object.values(b.matches.per_field).filter((s) => s !== 'match').length
    const aw = Object.values(a.matches.per_field).filter((s) => s !== 'match').length
    return bw - aw
  }).slice(0, 5)
  const sampleById = new Map(samples.map((s) => [s.id, s]))
  // The report.md lives at evals/<run-id>/report.md. Image paths in samples
  // can be either absolute (from annotation.json's baseline.tile_dir) or
  // relative to project root (from walking the rawDir). Normalize both to
  // a path relative to the report's own directory, two levels up.
  const evalDirRel = (p: string) => {
    if (p.startsWith('/')) {
      const idx = p.indexOf('/data/raw/')
      return idx >= 0 ? `../..${p.slice(idx)}` : p
    }
    // relative path — assume it's relative to project root
    return p.startsWith('data/') ? `../../${p}` : p
  }
  for (const w of worst) {
    const wrongCount = Object.values(w.matches.per_field).filter((s) => s !== 'match').length
    lines.push(`### \`${w.id}\` — ${wrongCount}/${FIELDS.length} fields wrong\n`)
    const s = sampleById.get(w.id)
    if (s) {
      lines.push(`| baseline RGB | baseline SWIR | current RGB | current SWIR |`)
      lines.push(`|---|---|---|---|`)
      lines.push(
        `| ![](${evalDirRel(s.preRgbPath)}) ` +
          `| ![](${evalDirRel(s.preSwirPath)}) ` +
          `| ![](${evalDirRel(s.curRgbPath)}) ` +
          `| ![](${evalDirRel(s.curSwirPath)}) |`,
      )
      lines.push('')
    }
    // Per-field side-by-side, only the disagreements.
    lines.push(`| field | ground truth | prediction | match |`)
    lines.push(`|---|---|---|---|`)
    for (const f of FIELDS) {
      const status = w.matches.per_field[f]
      const gt = JSON.stringify(w.ground_truth[f])
      const pr = JSON.stringify((w.prediction ?? {})[f])
      const icon = status === 'match' ? '✓' : '✗'
      lines.push(`| \`${f}\` | ${gt} | ${pr} | ${icon} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ============== Main ==============

const backend = buildBackend()
const all = await loadSamples(args.raw)
if (all.length === 0) {
  console.error(`No pair-labeled samples (annotation.json with baseline + labels) under ${args.raw}`)
  Deno.exit(1)
}
const samples = isFinite(limit) ? all.slice(0, limit) : all

const runId = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')
const evalDir = join('evals', runId)
await ensureDir(evalDir)

const meta = {
  run_id: runId,
  started_at: new Date().toISOString(),
  backend: args.backend,
  backend_description: backend.description,
  model: backend.name,
  dataset: args.raw,
  n_samples: samples.length,
  display_name: args.name ?? `${args.backend}/${backend.name}`,
}

console.log(`Eval ${runId}: ${samples.length} pair samples, backend = ${backend.description}, concurrency = ${concurrency}`)
const results = await runAll(samples, backend)
const agg = aggregate(results)
const finishedMeta = { ...meta, finished_at: new Date().toISOString(), aggregate: agg }

await Deno.writeTextFile(join(evalDir, 'meta.json'), JSON.stringify(finishedMeta, null, 2))
await Deno.writeTextFile(join(evalDir, 'results.json'), JSON.stringify(results, null, 2))
await Deno.writeTextFile(join(evalDir, 'report.md'), reportMd(finishedMeta, agg, results, samples))

console.log(`\nResults written to ${evalDir}/`)
console.log(`Overall: ${agg.overall.toFixed(2)}  |  valid_json: ${agg.valid_json.toFixed(2)}  |  avg latency: ${agg.avg_latency_s.toFixed(2)}s`)
console.log(`Compare runs: deno task eval:compare`)
