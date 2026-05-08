// Scripted labeler — drives Anthropic API directly with the same schema and
// prompts that the agent path uses. Production-scale alternative to manual
// agent dispatch: fully runnable from a script, idempotent, parallelizable.
//
// For each unlabeled (pre, current) pair under data/raw/<run>:
//   - load 4 PNGs + 2 capture_metadata.json files
//   - call Claude with a tool_use that enforces FLOOD_LABEL_SCHEMA
//   - write annotation.json next to the current tile (same shape as the agent
//     path: top-level capture metadata + baseline reference + labels)
//
// Usage:
//   deno task label:anthropic --raw data/raw/<run>
//   deno task label:anthropic --raw data/raw/<run> --model claude-sonnet-4-6
//   deno task label:anthropic --raw data/raw/<run> --concurrency 4 --limit 10

import { parseArgs } from '@std/cli/parse-args'
import { encodeBase64 } from '@std/encoding/base64'
import Anthropic from '@anthropic-ai/sdk'

import { findPairs, type Pair } from './pairs.ts'
import { FLOOD_LABEL_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from './prompts.ts'

const args = parseArgs(Deno.args, {
  string: ['raw', 'model', 'concurrency', 'limit'],
  boolean: ['dryRun'],
  default: {
    model: 'claude-opus-4-6',
    concurrency: '3',
  },
})

if (!args.raw) {
  console.error('--raw <data/raw/<run>> required')
  Deno.exit(1)
}

const concurrency = Number(args.concurrency)
const limit = args.limit ? Number(args.limit) : Infinity

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

async function labelPair(pair: Pair): Promise<{ ok: true; labels: Record<string, unknown> } | { ok: false; error: string }> {
  const [preRgb, preSwir, curRgb, curSwir] = await Promise.all([
    Deno.readFile(pair.pre.rgb_path),
    Deno.readFile(pair.pre.swir_path),
    Deno.readFile(pair.current.rgb_path),
    Deno.readFile(pair.current.swir_path),
  ])
  try {
    const resp = await client.messages.create({
      model: args.model,
      max_tokens: 1024,
      system: [
        // Cache the system prompt — every call uses it unchanged.
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
    if (!block) return { ok: false, error: 'no tool_use block in response' }
    return { ok: true, labels: block.input }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

async function processPair(pair: Pair): Promise<'ok' | 'failed'> {
  // Idempotency check — annotation.json already exists means we skip.
  try {
    await Deno.stat(pair.current.annotation_path)
    return 'ok' // already labeled, count as ok but don't re-call
  } catch {
    // not yet labeled
  }

  if (args.dryRun) {
    console.log(`  · plan ${pair.pair_id}`)
    return 'ok'
  }

  const result = await labelPair(pair)
  if (!result.ok) {
    console.log(`  ✗ ${pair.pair_id}: ${result.error.slice(0, 120)}`)
    return 'failed'
  }

  // Load capture metadata so the annotation has the same shape as the agent
  // path's annotations (top-level capture metadata + baseline + labels).
  const curMeta = JSON.parse(await Deno.readTextFile(pair.current.capture_metadata_path)) as Record<string, unknown>
  const preMeta = JSON.parse(await Deno.readTextFile(pair.pre.capture_metadata_path)) as Record<string, unknown>

  const annotation = {
    ...curMeta,
    baseline: {
      tile_dir: pair.pre.tile_dir,
      selected_date: preMeta.selected_date,
      capture_datetime: preMeta.capture_datetime,
      cloud_cover: preMeta.cloud_cover,
    },
    labels: result.labels,
  }
  await Deno.writeTextFile(pair.current.annotation_path, JSON.stringify(annotation, null, 2))
  const sev = result.labels.flood_severity as string | undefined
  const fp = result.labels.flood_present as boolean | undefined
  console.log(`  ✓ ${pair.pair_id}: flood_present=${fp} severity=${sev ?? '?'}`)
  return 'ok'
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<'ok' | 'failed'>,
  cap: number,
): Promise<{ ok: number; failed: number }> {
  let cursor = 0
  let ok = 0
  let failed = 0
  async function pump() {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      let r: 'ok' | 'failed'
      try {
        r = await worker(items[i])
      } catch (err) {
        console.log(`  ✗ uncaught: ${(err as Error).message.slice(0, 120)}`)
        r = 'failed'
      }
      if (r === 'ok') ok++
      else failed++
    }
  }
  await Promise.all(Array.from({ length: cap }, pump))
  return { ok, failed }
}

const all = await findPairs(args.raw, { skipLabeled: true })
const pairs = isFinite(limit) ? all.slice(0, limit) : all

console.log(
  `Label run: ${pairs.length} unlabeled pair(s), backend = anthropic API model=${args.model}, concurrency=${concurrency}`,
)
if (args.dryRun) console.log('(dry run — no API calls, no writes)')

const stats = await runWithConcurrency(pairs, processPair, concurrency)
console.log(`\nDone. ok=${stats.ok}  failed=${stats.failed}`)
