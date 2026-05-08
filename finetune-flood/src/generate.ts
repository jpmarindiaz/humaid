// For each (location × event window), sweep candidate timestamps at Sentinel-2
// cadence, pick the one with lowest cloud_cover, fetch RGB+SWIR for that
// timestamp, and label with Claude vision. Outputs a tile dir per sample:
//
//   data/raw/<run-ts>/<location>/<event-id>_<window>/
//     ├── rgb.png
//     ├── swir.png
//     ├── capture_metadata.json   (location, lon/lat, event, window, requested
//     │                            and selected timestamps, cloud_cover, source,
//     │                            candidates_tried)
//     └── annotation.json         (only in label mode — holds the JSON labels)
//
// Modes:
//   --test          fetch images only, no Anthropic call (smoke test the data path)
//   --dryRun        plan only, no fetch, no label
//   --event <id>    restrict to one event
//   --location <id> restrict to one location
//
// build_dataset.ts walks this tree to assemble the leap-finetune JSONL.

import { parseArgs } from '@std/cli/parse-args'
import { ensureDir } from '@std/fs'
import { join } from '@std/path'
import { encodeBase64 } from '@std/encoding/base64'
import Anthropic from '@anthropic-ai/sdk'

import { LOCATIONS } from './locations.ts'
import { CandidateSet, EVENTS, expandEvent } from './events.ts'
import { BAND_COMBOS, fetchSentinel, fetchSentinelWithRetry } from './simsat.ts'
import { FLOOD_LABEL_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from './prompts.ts'

const args = parseArgs(Deno.args, {
  string: ['model', 'concurrency', 'sizeKm', 'event', 'location'],
  boolean: ['dryRun', 'test'],
  default: {
    model: 'claude-opus-4-6',
    concurrency: '3',
    sizeKm: '5.0',
  },
})

const concurrency = Number(args.concurrency)
const sizeKm = Number(args.sizeKm)

interface WindowTask {
  locationId: string
  locationName: string
  lon: number
  lat: number
  eventId: string
  candidateSet: CandidateSet
}

function buildTasks(): WindowTask[] {
  const events = args.event ? EVENTS.filter((e) => e.id === args.event) : EVENTS
  if (events.length === 0) throw new Error(`No event matches --event ${args.event}`)

  const tasks: WindowTask[] = []
  for (const ev of events) {
    let locs = LOCATIONS.filter((l) => l.region === ev.region)
    if (Array.isArray(ev.scope)) locs = locs.filter((l) => ev.scope.includes(l.id))
    if (args.location) locs = locs.filter((l) => l.id === args.location)

    for (const cs of expandEvent(ev)) {
      for (const loc of locs) {
        tasks.push({
          locationId: loc.id,
          locationName: loc.name,
          lon: loc.lon,
          lat: loc.lat,
          eventId: ev.id,
          candidateSet: cs,
        })
      }
    }
  }
  return tasks
}

interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
  return _client
}

async function labelTile(rgb: Uint8Array, swir: Uint8Array): Promise<Record<string, unknown>> {
  const resp = await client().messages.create({
    model: args.model,
    max_tokens: 1024,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    tools: [
      {
        name: 'report_flood_assessment',
        description: 'Submit the structured flood-risk assessment for the tile.',
        input_schema: FLOOD_LABEL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'report_flood_assessment' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: encodeBase64(rgb) } },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: encodeBase64(swir) } },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  })
  const block = resp.content.find((c): c is ToolUseBlock => c.type === 'tool_use')
  if (!block) throw new Error('Teacher returned no tool_use block')
  return block.input
}

interface CandidateProbe {
  date: string
  available: boolean
  cloudCover: number | null
  captureDatetime: string | undefined
  source: string | undefined
}

// Probe each candidate with a single RGB request, concurrently. SimSat itself
// is the bottleneck (~1–3s per call to fetch from AWS Element84 STAC), so
// probing 4 candidates in parallel is ~4× faster per window. Returns the
// candidate with lowest cloud cover; null if no candidate is available.
async function pickBestCandidate(
  task: WindowTask,
): Promise<{ best: CandidateProbe; tried: CandidateProbe[] } | null> {
  const tried = await Promise.all(
    task.candidateSet.candidates.map(async (date): Promise<CandidateProbe> => {
      try {
        const r = await fetchSentinel({
          lon: task.lon,
          lat: task.lat,
          timestamp: `${date}T12:00:00Z`,
          spectralBands: BAND_COMBOS.rgb as unknown as string[],
          sizeKm,
        })
        return {
          date,
          available: r.metadata.image_available,
          cloudCover: r.metadata.cloud_cover ?? null,
          captureDatetime: r.metadata.datetime,
          source: r.metadata.source,
        }
      } catch (err) {
        console.log(`    probe ${date} ${task.locationId}: error ${(err as Error).message.slice(0, 80)}`)
        return { date, available: false, cloudCover: null, captureDatetime: undefined, source: undefined }
      }
    }),
  )

  const available = tried.filter((c) => c.available)
  if (available.length === 0) return null

  const best = available.reduce((a, b) => {
    const ac = a.cloudCover ?? 100
    const bc = b.cloudCover ?? 100
    return bc < ac ? b : a
  })
  return { best, tried }
}

async function processWindow(task: WindowTask, runDir: string): Promise<'ok' | 'skipped' | 'failed'> {
  const tileDir = join(runDir, task.locationId, `${task.eventId}_${task.candidateSet.windowKind}`)
  const annotationPath = join(tileDir, 'annotation.json')
  const rgbPath = join(tileDir, 'rgb.png')
  const swirPath = join(tileDir, 'swir.png')

  // In --test mode, idempotency on the image. In label mode, on the annotation.
  const idempotencyMarker = args.test ? rgbPath : annotationPath
  try {
    await Deno.stat(idempotencyMarker)
    return 'skipped'
  } catch {
    // proceed
  }

  if (args.dryRun) {
    console.log(
      `  · plan ${task.locationId} ${task.eventId}/${task.candidateSet.windowKind}: ${task.candidateSet.candidates.join(', ')}`,
    )
    return 'ok'
  }

  const picked = await pickBestCandidate(task)
  if (!picked) {
    console.log(
      `  ✗ ${task.locationId} ${task.eventId}/${task.candidateSet.windowKind}: no image_available across ${task.candidateSet.candidates.length} candidates`,
    )
    return 'failed'
  }

  const { best, tried } = picked
  const ts = `${best.date}T12:00:00Z`
  let rgbResp, swirResp
  try {
    ;[rgbResp, swirResp] = await Promise.all([
      fetchSentinelWithRetry({
        lon: task.lon,
        lat: task.lat,
        timestamp: ts,
        spectralBands: BAND_COMBOS.rgb as unknown as string[],
        sizeKm,
      }),
      fetchSentinelWithRetry({
        lon: task.lon,
        lat: task.lat,
        timestamp: ts,
        spectralBands: BAND_COMBOS.swir as unknown as string[],
        sizeKm,
      }),
    ])
  } catch (err) {
    console.log(
      `  ✗ ${task.locationId} ${task.eventId}/${task.candidateSet.windowKind}: fetch failed after retries: ${(err as Error).message.slice(0, 100)}`,
    )
    return 'failed'
  }

  if (!rgbResp.png || !swirResp.png) {
    console.log(
      `  ✗ ${task.locationId} ${task.eventId}/${task.candidateSet.windowKind}: probe said available but fetch returned empty`,
    )
    return 'failed'
  }

  await ensureDir(tileDir)
  await Deno.writeFile(rgbPath, rgbResp.png)
  await Deno.writeFile(swirPath, swirResp.png)
  const captureMetadata = {
    location_id: task.locationId,
    location_name: task.locationName,
    lon: task.lon,
    lat: task.lat,
    event_id: task.eventId,
    window_kind: task.candidateSet.windowKind,
    selected_date: best.date,
    selected_timestamp: ts,
    capture_datetime: rgbResp.metadata.datetime,
    cloud_cover: rgbResp.metadata.cloud_cover,
    source: rgbResp.metadata.source,
    candidates_tried: tried,
  }
  await Deno.writeTextFile(join(tileDir, 'capture_metadata.json'), JSON.stringify(captureMetadata, null, 2))

  const cloud = rgbResp.metadata.cloud_cover ?? 0
  if (args.test) {
    console.log(
      `  ✓ ${task.locationId} ${task.eventId}/${task.candidateSet.windowKind}: picked ${best.date} (cloud=${cloud.toFixed(0)}%, ${tried.length} candidates tried)`,
    )
    return 'ok'
  }

  let labels: Record<string, unknown>
  try {
    labels = await labelTile(rgbResp.png, swirResp.png)
  } catch (err) {
    console.log(
      `  ✗ ${task.locationId} ${task.eventId}/${task.candidateSet.windowKind}: label error: ${(err as Error).message}`,
    )
    return 'failed'
  }

  const annotation = { ...captureMetadata, labels }
  await Deno.writeTextFile(annotationPath, JSON.stringify(annotation, null, 2))
  console.log(
    `  ✓ ${task.locationId} ${task.eventId}/${task.candidateSet.windowKind}: ${(labels.flood_severity as string) ?? '?'} (${(labels.flood_type as string) ?? '?'}, cloud=${cloud.toFixed(0)}%)`,
  )
  return 'ok'
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<'ok' | 'skipped' | 'failed'>,
  limit: number,
): Promise<{ ok: number; skipped: number; failed: number }> {
  let cursor = 0
  let ok = 0
  let skipped = 0
  let failed = 0
  async function pump() {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      let r: 'ok' | 'skipped' | 'failed'
      try {
        r = await worker(items[i])
      } catch (err) {
        console.log(`  ✗ uncaught error: ${(err as Error).message.slice(0, 200)}`)
        r = 'failed'
      }
      if (r === 'ok') ok++
      else if (r === 'skipped') skipped++
      else failed++
    }
  }
  await Promise.all(Array.from({ length: limit }, pump))
  return { ok, skipped, failed }
}

const runStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')
const runDir = `data/raw/${runStamp}`
await ensureDir(runDir)

const tasks = buildTasks()
const mode = args.dryRun ? 'dry run' : args.test ? 'test (fetch only, no labels)' : `label with ${args.model}`
console.log(`Run ${runStamp}: ${tasks.length} window(s), mode = ${mode}, concurrency=${concurrency}`)
if (args.event) console.log(`  filter: event = ${args.event}`)
if (args.location) console.log(`  filter: location = ${args.location}`)

const stats = await runWithConcurrency(tasks, (t) => processWindow(t, runDir), concurrency)
console.log(`\nDone. ok=${stats.ok}  skipped=${stats.skipped}  failed=${stats.failed}`)
console.log(`Run dir: ${runDir}`)
if (!args.test && !args.dryRun) console.log(`Next: deno task build`)
