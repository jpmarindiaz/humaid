// Walk pair-labeled tile dirs and emit a leap-finetune vlm_sft JSONL.
// Each row is a 4-image pair sample: baseline RGB + baseline SWIR + current RGB
// + current SWIR + the user instruction → assistant message containing the JSON
// labels. Train/eval split is temporal — latest fraction of CURRENT timestamps
// goes to eval — so spatially adjacent dates can't leak across the split (cf.
// Pau's wildfire notes on near-duplicate Sentinel-2 revisits contaminating
// random splits).
//
// Inputs:
//   --raw <data/raw/<run>>   walk this dir for current tiles with annotation.json
//                            that contains a "baseline" reference. Repeatable.
//   --evalSplit 0.2          fraction of (sorted-by-timestamp) samples to put in eval
//
// Outputs:
//   data/flood_train.jsonl
//   data/flood_eval.jsonl
//   data/images/<location>/<event>/<window>/{rgb,swir}.png   (mirrored from raw)

import { parseArgs } from '@std/cli/parse-args'
import { ensureDir, walk } from '@std/fs'
import { copy } from '@std/fs/copy'
import { dirname, join, relative } from '@std/path'

import { USER_PROMPT } from './prompts.ts'

const args = parseArgs(Deno.args, {
  collect: ['raw'],
  string: ['images', 'evalSplit'],
  default: { images: 'data/images', evalSplit: '0.2' },
})

const rawDirs = (args.raw as string[] | undefined) ?? []
if (rawDirs.length === 0) {
  console.error('--raw <data/raw/<run>> required (repeatable)')
  Deno.exit(1)
}

interface PairSample {
  pairId: string // <location>/<event>/<window>
  locationId: string
  eventId: string
  windowKind: 'event' | 'post'
  selectedTimestamp: string
  preRgbSrc: string
  preSwirSrc: string
  curRgbSrc: string
  curSwirSrc: string
  labels: Record<string, unknown>
}

const samples: PairSample[] = []
const seen = new Set<string>()

for (const rawDir of rawDirs) {
  for await (const entry of walk(rawDir, { exts: ['.json'] })) {
    if (!entry.path.endsWith('annotation.json')) continue
    const ann = JSON.parse(await Deno.readTextFile(entry.path)) as {
      location_id?: string
      event_id?: string
      window_kind?: string
      selected_timestamp?: string
      labels?: Record<string, unknown>
      baseline?: { tile_dir?: string }
    }
    // Only pair-format annotations are usable here. Single-tile annotations
    // (no `baseline` field) are leftover from the pre-pair-mode pipeline.
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

    const pairId = `${ann.location_id}/${ann.event_id}/${ann.window_kind}`
    if (seen.has(pairId)) continue
    seen.add(pairId)
    samples.push({
      pairId,
      locationId: ann.location_id ?? '?',
      eventId: ann.event_id ?? '?',
      windowKind: ann.window_kind,
      selectedTimestamp: ann.selected_timestamp ?? '',
      preRgbSrc: preRgb,
      preSwirSrc: preSwir,
      curRgbSrc: curRgb,
      curSwirSrc: curSwir,
      labels: ann.labels,
    })
  }
}

if (samples.length === 0) {
  console.error(`No pair-format annotations under: ${rawDirs.join(', ')}`)
  console.error(`Hint: pair-format annotations have a "baseline" field. Run the pair labeler first.`)
  Deno.exit(1)
}

// Sort by current-window timestamp, then split temporally — latest 20% to eval.
samples.sort((a, b) => a.selectedTimestamp.localeCompare(b.selectedTimestamp))

const evalCount = Math.max(20, Math.floor(samples.length * Number(args.evalSplit)))
const trainSamples = samples.slice(0, Math.max(0, samples.length - evalCount))
const evalSamples = samples.slice(Math.max(0, samples.length - evalCount))

await ensureDir(args.images)

async function ensureImageQuad(s: PairSample): Promise<{
  preRgb: string
  preSwir: string
  curRgb: string
  curSwir: string
}> {
  // Mirror under data/images/<location>/<event>/<window>/{baseline,current}/{rgb,swir}.png
  const base = join(args.images, s.locationId, s.eventId, s.windowKind)
  const baselineDir = join(base, 'baseline')
  const currentDir = join(base, 'current')
  await ensureDir(baselineDir)
  await ensureDir(currentDir)
  const map: Array<[string, string]> = [
    [s.preRgbSrc, join(baselineDir, 'rgb.png')],
    [s.preSwirSrc, join(baselineDir, 'swir.png')],
    [s.curRgbSrc, join(currentDir, 'rgb.png')],
    [s.curSwirSrc, join(currentDir, 'swir.png')],
  ]
  for (const [src, dst] of map) {
    try {
      await Deno.stat(dst)
    } catch {
      await copy(src, dst)
    }
  }
  return {
    preRgb: relative('data', map[0][1]),
    preSwir: relative('data', map[1][1]),
    curRgb: relative('data', map[2][1]),
    curSwir: relative('data', map[3][1]),
  }
}

// vlm_sft pair sample. Image content blocks are in baseline-then-current order
// to match the prompt ("Image 1 = RGB-baseline. Image 2 = SWIR-baseline.
// Image 3 = RGB-current. Image 4 = SWIR-current.").
function toSft(s: PairSample, paths: { preRgb: string; preSwir: string; curRgb: string; curSwir: string }) {
  return {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: paths.preRgb },
          { type: 'image', image: paths.preSwir },
          { type: 'image', image: paths.curRgb },
          { type: 'image', image: paths.curSwir },
          { type: 'text', text: USER_PROMPT },
        ],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: JSON.stringify(s.labels) }],
      },
    ],
  }
}

async function writeJsonl(path: string, items: PairSample[]) {
  const fh = await Deno.open(path, { write: true, create: true, truncate: true })
  const enc = new TextEncoder()
  for (const s of items) {
    const paths = await ensureImageQuad(s)
    await fh.write(enc.encode(JSON.stringify(toSft(s, paths)) + '\n'))
  }
  fh.close()
}

await writeJsonl('data/flood_train.jsonl', trainSamples)
await writeJsonl('data/flood_eval.jsonl', evalSamples)

const cutoff = trainSamples.at(-1)?.selectedTimestamp ?? '?'
console.log(`Total pair samples: ${samples.length}`)
console.log(`  train → data/flood_train.jsonl  (${trainSamples.length}, ≤ ${cutoff})`)
console.log(`  eval  → data/flood_eval.jsonl   (${evalSamples.length})`)
console.log(`  images mirrored under ${args.images}/`)
console.log(`Next: deno task upload`)
