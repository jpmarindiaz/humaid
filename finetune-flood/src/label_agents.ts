// Build a manifest of unlabeled tile groups so a separate labeling pass
// (agents, scripts, whatever) can pick them up.
//
// Modes:
//   --mode singles   one entry per tile (each tile labeled standalone)
//   --mode pairs     one entry per (baseline → current) pair, current ∈ {event, post}
//
// A "pair" is unlabeled if the *current* tile dir lacks annotation.json. The
// baseline (pre) tile dir never holds an annotation; it is only context.
//
// Usage:
//   deno task label:manifest --raw data/raw/<run> --mode pairs
//   deno task label:manifest --raw data/raw/<run> --mode pairs --slices 5

import { parseArgs } from '@std/cli/parse-args'
import { walk } from '@std/fs/walk'
import { dirname, resolve } from '@std/path'

import { findPairs, type Pair } from './pairs.ts'

const args = parseArgs(Deno.args, {
  string: ['raw', 'slices', 'mode'],
  default: { slices: '1', mode: 'pairs' },
})

if (!args.raw) {
  console.error('--raw <data/raw/<run>> required')
  Deno.exit(1)
}

interface SingleTile {
  tile_dir: string
  rgb_path: string
  swir_path: string
  capture_metadata_path: string
  annotation_path: string
}

async function buildSinglesManifest(rawDir: string): Promise<SingleTile[]> {
  const out: SingleTile[] = []
  for await (const entry of walk(rawDir, { exts: ['.png'] })) {
    if (!entry.path.endsWith('rgb.png')) continue
    const tileDir = dirname(entry.path)
    const rgb = resolve(tileDir, 'rgb.png')
    const swir = resolve(tileDir, 'swir.png')
    const meta = resolve(tileDir, 'capture_metadata.json')
    const ann = resolve(tileDir, 'annotation.json')
    try {
      await Deno.stat(ann)
      continue // already labeled
    } catch {
      // unlabeled, proceed
    }
    let usable = true
    for (const p of [swir, meta]) {
      try {
        await Deno.stat(p)
      } catch {
        usable = false
        break
      }
    }
    if (!usable) continue
    out.push({
      tile_dir: resolve(tileDir),
      rgb_path: rgb,
      swir_path: swir,
      capture_metadata_path: meta,
      annotation_path: ann,
    })
  }
  out.sort((a, b) => a.tile_dir.localeCompare(b.tile_dir))
  return out
}

const slices = Math.max(1, Number(args.slices))
const mode = args.mode

let manifest: Record<string, unknown>
let totalCount: number

if (mode === 'pairs') {
  const pairs = await findPairs(args.raw, { skipLabeled: true })
  totalCount = pairs.length
  const sliced: Pair[][] = Array.from({ length: slices }, () => [])
  for (let i = 0; i < pairs.length; i++) sliced[i % slices].push(pairs[i])
  manifest = {
    raw_dir: resolve(args.raw),
    mode: 'pairs',
    generated_at: new Date().toISOString(),
    total_pairs: pairs.length,
    n_slices: slices,
    slices: sliced.map((batch, i) => ({ batch_id: i, pairs: batch })),
  }
} else if (mode === 'singles') {
  const tiles = await buildSinglesManifest(args.raw)
  totalCount = tiles.length
  const sliced: SingleTile[][] = Array.from({ length: slices }, () => [])
  for (let i = 0; i < tiles.length; i++) sliced[i % slices].push(tiles[i])
  manifest = {
    raw_dir: resolve(args.raw),
    mode: 'singles',
    generated_at: new Date().toISOString(),
    total_tiles: tiles.length,
    n_slices: slices,
    slices: sliced.map((batch, i) => ({ batch_id: i, tiles: batch })),
  }
} else {
  console.error(`Unknown --mode ${mode}; use 'pairs' or 'singles'`)
  Deno.exit(1)
}

const out = `${args.raw.replace(/\/$/, '')}/label_manifest.json`
await Deno.writeTextFile(out, JSON.stringify(manifest, null, 2))
console.log(`mode=${mode}: ${totalCount} unlabeled item(s) → ${out}`)
const slicesData = manifest.slices as Array<{ batch_id: number; pairs?: unknown[]; tiles?: unknown[] }>
for (let i = 0; i < slices; i++) {
  const items = slicesData[i].pairs ?? slicesData[i].tiles ?? []
  console.log(`  slice ${i}: ${items.length} item(s)`)
}
