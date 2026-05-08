// Pair-grouping logic shared by label_agents.ts (manifest builder), build_dataset.ts
// (training JSONL), and evaluate.ts (eval samples).
//
// Given a raw run dir of single-window tile dirs (each with rgb.png + swir.png +
// capture_metadata.json), find (baseline → current) pairs where:
//   - baseline = the "pre" window for some (location, event)
//   - current  = the "event" or "post" window for the same (location, event)
//
// One (location × event) yields up to 2 pairs: (pre, event) and (pre, post).
// Pairs missing the pre baseline are skipped — pair labeling needs both sides.
//
// The pair's annotation lives in the CURRENT window's tile dir, not the baseline.

import { walk } from '@std/fs/walk'
import { dirname, resolve } from '@std/path'

export interface TilePaths {
  tile_dir: string
  rgb_path: string
  swir_path: string
  capture_metadata_path: string
  annotation_path: string
}

export interface Pair {
  pair_id: string // <location_id>/<event_id>/<current_kind>
  location_id: string
  event_id: string
  current_kind: 'event' | 'post'
  pre: TilePaths
  current: TilePaths
}

interface TileEntry extends TilePaths {
  location_id: string
  event_id: string
  window_kind: 'pre' | 'event' | 'post'
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path)
    return true
  } catch {
    return false
  }
}

async function listTiles(rawDir: string): Promise<TileEntry[]> {
  const out: TileEntry[] = []
  for await (const entry of walk(rawDir, { exts: ['.png'] })) {
    if (!entry.path.endsWith('rgb.png')) continue
    const tileDir = dirname(entry.path)
    const rgb = resolve(tileDir, 'rgb.png')
    const swir = resolve(tileDir, 'swir.png')
    const meta = resolve(tileDir, 'capture_metadata.json')
    const ann = resolve(tileDir, 'annotation.json')

    // All three input files must exist for a tile to be eligible.
    if (!(await exists(swir)) || !(await exists(meta))) continue

    // Path shape: <raw>/<location_id>/<event_id>_<window>/rgb.png
    const parts = tileDir.split('/')
    const dirName = parts[parts.length - 1]
    const locId = parts[parts.length - 2]
    const m = dirName.match(/^(.+)_(pre|event|post)$/)
    if (!m) continue

    out.push({
      location_id: locId,
      event_id: m[1],
      window_kind: m[2] as 'pre' | 'event' | 'post',
      tile_dir: resolve(tileDir),
      rgb_path: rgb,
      swir_path: swir,
      capture_metadata_path: meta,
      annotation_path: ann,
    })
  }
  return out
}

export async function findPairs(
  rawDir: string,
  opts: { skipLabeled?: boolean } = {},
): Promise<Pair[]> {
  const tiles = await listTiles(rawDir)

  const groups = new Map<string, TileEntry[]>()
  for (const t of tiles) {
    const key = `${t.location_id}/${t.event_id}`
    let arr = groups.get(key)
    if (!arr) {
      arr = []
      groups.set(key, arr)
    }
    arr.push(t)
  }

  const pairs: Pair[] = []
  for (const arr of groups.values()) {
    const pre = arr.find((t) => t.window_kind === 'pre')
    if (!pre) continue
    const event = arr.find((t) => t.window_kind === 'event')
    const post = arr.find((t) => t.window_kind === 'post')

    for (const [kind, current] of [['event', event], ['post', post]] as const) {
      if (!current) continue
      if (opts.skipLabeled && (await exists(current.annotation_path))) continue
      pairs.push({
        pair_id: `${current.location_id}/${current.event_id}/${kind}`,
        location_id: current.location_id,
        event_id: current.event_id,
        current_kind: kind,
        pre: stripEntry(pre),
        current: stripEntry(current),
      })
    }
  }

  pairs.sort((a, b) => a.pair_id.localeCompare(b.pair_id))
  return pairs
}

function stripEntry(t: TileEntry): TilePaths {
  return {
    tile_dir: t.tile_dir,
    rgb_path: t.rgb_path,
    swir_path: t.swir_path,
    capture_metadata_path: t.capture_metadata_path,
    annotation_path: t.annotation_path,
  }
}
