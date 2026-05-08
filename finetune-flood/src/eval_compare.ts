// Side-by-side comparison of eval runs.
//
// 1. Prints a terminal accuracy table (replaces Pau's Streamlit app).
// 2. Writes a markdown report to evals/_compare_<ts>/report.md with:
//    - the same accuracy table
//    - sample-level disagreements (samples where runs returned different
//      predictions for the same ground-truth tile), with embedded images
//      so a human can visually compare what each model saw vs called
//
// Usage:
//   deno task eval:compare                          # compare every run under evals/
//   deno task eval:compare --run X --run Y          # specific runs
//   deno task eval:compare --no-md                  # skip writing the MD report

import { parseArgs } from '@std/cli/parse-args'
import { ensureDir } from '@std/fs'
import { join } from '@std/path'

const args = parseArgs(Deno.args, {
  collect: ['run'],
  string: ['evalsDir'],
  boolean: ['md', 'noMd'],
  default: { evalsDir: 'evals', md: true },
})

const writeMd = args.md && !args.noMd

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

interface Aggregate {
  n: number
  valid_json: number
  fields_present: number
  fieldAcc: Record<Field, number>
  overall: number
  avg_latency_s: number
}

interface Meta {
  run_id: string
  display_name?: string
  backend?: string
  model?: string
  backend_description?: string
  dataset?: string
  aggregate: Aggregate
  finished_at?: string
}

interface SampleResult {
  id: string
  ground_truth: Record<string, unknown>
  prediction: Record<string, unknown> | null
  error?: string | null
  latency_s: number
  matches: {
    valid_json: boolean
    fields_present: boolean
    per_field: Record<Field, 'match' | 'mismatch' | 'missing'>
  }
}

async function loadAll(): Promise<Meta[]> {
  const runArgs = (args.run as string[] | undefined) ?? []
  const want = runArgs.length > 0 ? new Set(runArgs) : null
  const out: Meta[] = []
  for await (const e of Deno.readDir(args.evalsDir)) {
    if (!e.isDirectory) continue
    if (e.name.startsWith('_compare_')) continue
    if (want && !want.has(e.name)) continue
    const path = join(args.evalsDir, e.name, 'meta.json')
    try {
      out.push(JSON.parse(await Deno.readTextFile(path)) as Meta)
    } catch {
      // not a finished eval, skip
    }
  }
  out.sort((a, b) => (a.finished_at ?? '').localeCompare(b.finished_at ?? ''))
  return out
}

async function loadResults(runId: string): Promise<SampleResult[]> {
  try {
    return JSON.parse(await Deno.readTextFile(join(args.evalsDir, runId, 'results.json'))) as SampleResult[]
  } catch {
    return []
  }
}

function pad(s: string, w: number): string {
  if (s.length >= w) return s
  return s + ' '.repeat(w - s.length)
}

function fmt(n: number): string {
  return n.toFixed(2)
}

// =================================================================
// Terminal table
// =================================================================

const metas = await loadAll()
if (metas.length === 0) {
  console.error(`No completed eval runs under ${args.evalsDir}/.`)
  console.error(`Run one first: deno task eval --raw <dir> --backend anthropic`)
  Deno.exit(1)
}

const labels = metas.map((m) => m.display_name ?? `${m.backend}/${m.model}`)
const colWidth = Math.max(20, ...labels.map((l) => l.length + 2))
const fieldWidth = Math.max(20, ...FIELDS.map((f) => f.length + 2))

console.log('')
console.log(pad('field', fieldWidth) + '|' + labels.map((l) => pad(' ' + l, colWidth)).join('|'))
console.log('-'.repeat(fieldWidth) + '+' + labels.map(() => '-'.repeat(colWidth)).join('+'))

const rows: Array<{ key: string; values: number[] }> = [
  { key: 'samples', values: metas.map((m) => m.aggregate.n) },
  { key: 'valid_json', values: metas.map((m) => m.aggregate.valid_json) },
  { key: 'fields_present', values: metas.map((m) => m.aggregate.fields_present) },
  ...FIELDS.map((f) => ({ key: f, values: metas.map((m) => m.aggregate.fieldAcc[f] ?? NaN) })),
  { key: 'overall', values: metas.map((m) => m.aggregate.overall) },
  { key: 'avg_latency_s', values: metas.map((m) => m.aggregate.avg_latency_s) },
]

for (const row of rows) {
  const cells = row.values.map((v) => {
    const formatted = row.key === 'samples' ? String(v) : fmt(v)
    const isBest = row.key === 'avg_latency_s'
      ? v === Math.min(...row.values)
      : v === Math.max(...row.values)
    return pad(' ' + (isBest && row.values.length > 1 ? `*${formatted}*` : formatted), colWidth)
  })
  console.log(pad(row.key, fieldWidth) + '|' + cells.join('|'))
}

console.log()
for (const m of metas) {
  console.log(`  ${m.run_id}  ${m.display_name ?? `${m.backend}/${m.model}`}  →  ${m.dataset ?? '?'}`)
}
console.log()
console.log(`(* marks the best value in each row.)`)

// =================================================================
// Markdown report
// =================================================================

if (!writeMd) Deno.exit(0)

const compareTs = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')
const outDir = join(args.evalsDir, `_compare_${compareTs}`)
await ensureDir(outDir)

// Markdown table builder.
const md: string[] = []
md.push(`# Eval comparison ${compareTs}\n`)
md.push(`Comparing ${metas.length} eval run(s):\n`)
for (const m of metas) {
  md.push(`- **${m.display_name ?? `${m.backend}/${m.model}`}** — ${m.run_id} — ${m.backend_description ?? ''}`)
  md.push(`  - Dataset: \`${m.dataset ?? '?'}\``)
  md.push(`  - Samples: ${m.aggregate.n}`)
  md.push(`  - Finished: ${m.finished_at ?? '?'}`)
}
md.push('')

md.push(`## Accuracy by field\n`)
md.push(`| field | ${labels.join(' | ')} |`)
md.push(`|---${'|---'.repeat(labels.length)}|`)
for (const row of rows) {
  const cells = row.values.map((v) => {
    const formatted = row.key === 'samples' ? String(v) : fmt(v)
    const isBest = row.key === 'avg_latency_s'
      ? v === Math.min(...row.values)
      : v === Math.max(...row.values)
    return isBest && row.values.length > 1 ? `**${formatted}**` : formatted
  })
  const key = row.key === 'overall' || row.key === 'avg_latency_s' ? `**${row.key}**` : `\`${row.key}\``
  md.push(`| ${key} | ${cells.join(' | ')} |`)
}
md.push('')
md.push(`(**bold** = best value in each row.)\n`)

// =================================================================
// Sample-level disagreements (only if 2+ runs evaluated overlapping samples)
// =================================================================

if (metas.length >= 2) {
  md.push(`## Sample-level disagreements\n`)
  md.push(
    `Samples where two or more runs produced different predictions for the same ` +
      `ground-truth tile. Only samples present in **all** compared runs are shown. ` +
      `The four images are the model's input — RGB-baseline, SWIR-baseline, ` +
      `RGB-current, SWIR-current. Each row's cell shows that run's prediction.\n`,
  )

  // Load all results.
  const allResults = await Promise.all(metas.map((m) => loadResults(m.run_id)))
  const idsByRun = allResults.map((rs) => new Set(rs.map((r) => r.id)))
  // Common-id set: ids present in EVERY run.
  let commonIds: Set<string> | null = null
  for (const idSet of idsByRun) {
    if (commonIds === null) {
      commonIds = new Set(idSet)
    } else {
      const next = new Set<string>()
      for (const x of commonIds) {
        if (idSet.has(x)) next.add(x)
      }
      commonIds = next
    }
  }
  const commonIdList = commonIds ? [...commonIds].sort() : []

  if (commonIdList.length === 0) {
    md.push(`_No samples are common to all compared runs (different datasets or limit values)._\n`)
  } else {
    md.push(`${commonIdList.length} samples common to all runs.\n`)

    // Find disagreements: samples where field predictions differ across runs.
    interface Disagreement {
      id: string
      groundTruth: Record<string, unknown>
      perRun: Array<{ runIdx: number; prediction: Record<string, unknown> | null }>
      disagreedFields: Field[]
    }
    const disagreements: Disagreement[] = []
    for (const id of commonIdList) {
      const perRun = allResults.map((rs, idx) => {
        const r = rs.find((x) => x.id === id)
        return { runIdx: idx, prediction: r?.prediction ?? null }
      })
      const gt = allResults[0].find((x) => x.id === id)?.ground_truth ?? {}
      const disagreed: Field[] = []
      for (const f of FIELDS) {
        const vals = perRun.map((p) => JSON.stringify(p.prediction?.[f]))
        if (new Set(vals).size > 1) disagreed.push(f)
      }
      if (disagreed.length > 0) {
        disagreements.push({ id, groundTruth: gt, perRun, disagreedFields: disagreed })
      }
    }

    md.push(`${disagreements.length} samples where runs disagreed on at least one field.\n`)

    // Show top 10 by disagreement count.
    const top = [...disagreements]
      .sort((a, b) => b.disagreedFields.length - a.disagreedFields.length)
      .slice(0, 10)

    // Image-path resolver. Prediction results don't carry image paths,
    // so reconstruct from the run's dataset path + the sample id (which
    // has the form "<location>/<event>/<window>"). We need to find the
    // matching tile dir under data/raw/<dataset>.
    // For now, look up the ground-truth annotation.json by walking each
    // run's dataset dir for paths that match the id.
    const datasetByRun = metas.map((m) => m.dataset ?? '')
    async function findImagePathsForId(runIdx: number, id: string): Promise<{
      preRgb?: string
      preSwir?: string
      curRgb?: string
      curSwir?: string
    }> {
      const ds = datasetByRun[runIdx]
      if (!ds) return {}
      const [loc, event, window] = id.split('/')
      const curDir = `${ds}/${loc}/${event}_${window}`
      const annPath = `${curDir}/annotation.json`
      try {
        const ann = JSON.parse(await Deno.readTextFile(annPath)) as { baseline?: { tile_dir?: string } }
        const preDir = ann.baseline?.tile_dir
        return {
          preRgb: preDir ? `${preDir}/rgb.png` : undefined,
          preSwir: preDir ? `${preDir}/swir.png` : undefined,
          curRgb: `${curDir}/rgb.png`,
          curSwir: `${curDir}/swir.png`,
        }
      } catch {
        return {}
      }
    }

    // Path normalization to be relative to the report dir
    // (evals/_compare_<ts>/report.md → ../../data/raw/...)
    const evalDirRel = (p?: string) => {
      if (!p) return ''
      if (p.startsWith('/')) {
        const idx = p.indexOf('/data/raw/')
        return idx >= 0 ? `../..${p.slice(idx)}` : p
      }
      return p.startsWith('data/') ? `../../${p}` : p
    }

    for (const d of top) {
      md.push(`### \`${d.id}\` — ${d.disagreedFields.length}/${FIELDS.length} fields disagreed\n`)

      // Try to surface images from the first run that has them.
      let imgs: Awaited<ReturnType<typeof findImagePathsForId>> = {}
      for (let i = 0; i < metas.length; i++) {
        imgs = await findImagePathsForId(i, d.id)
        if (imgs.curRgb) break
      }
      if (imgs.preRgb && imgs.preSwir && imgs.curRgb && imgs.curSwir) {
        md.push(`| baseline RGB | baseline SWIR | current RGB | current SWIR |`)
        md.push(`|---|---|---|---|`)
        md.push(
          `| ![](${evalDirRel(imgs.preRgb)}) | ![](${evalDirRel(imgs.preSwir)}) ` +
            `| ![](${evalDirRel(imgs.curRgb)}) | ![](${evalDirRel(imgs.curSwir)}) |`,
        )
        md.push('')
      }

      // Per-field comparison.
      md.push(`| field | ground truth | ${labels.join(' | ')} |`)
      md.push(`|---|---${'|---'.repeat(labels.length)}|`)
      for (const f of FIELDS) {
        const gt = JSON.stringify(d.groundTruth[f])
        const cells = d.perRun.map((p) => {
          const v = JSON.stringify(p.prediction?.[f])
          return v === gt ? `${v} ✓` : `${v} ✗`
        })
        const isDisagreed = d.disagreedFields.includes(f)
        const fieldLabel = isDisagreed ? `**\`${f}\`**` : `\`${f}\``
        md.push(`| ${fieldLabel} | ${gt} | ${cells.join(' | ')} |`)
      }
      md.push('')
    }
  }
}

await Deno.writeTextFile(join(outDir, 'report.md'), md.join('\n'))
await Deno.writeTextFile(
  join(outDir, 'meta.json'),
  JSON.stringify(
    {
      compared_runs: metas.map((m) => m.run_id),
      generated_at: new Date().toISOString(),
    },
    null,
    2,
  ),
)
console.log(`\nMD report → ${outDir}/report.md`)
