// Print the variable "Pairs to process" section of the agent labeling prompt
// from a label_manifest.json. The static system rules are kept in the agent
// invocation; only the per-pair paths change between dispatches.

import { parseArgs } from '@std/cli/parse-args'

const args = parseArgs(Deno.args, {
  string: ['manifest', 'slice'],
  default: { slice: '0' },
})

if (!args.manifest) {
  console.error('--manifest <path/to/label_manifest.json> required')
  Deno.exit(1)
}

const manifest = JSON.parse(await Deno.readTextFile(args.manifest)) as {
  slices: Array<{ batch_id: number; pairs?: Array<{
    pair_id: string
    location_id: string
    pre: { rgb_path: string; swir_path: string; capture_metadata_path: string }
    current: { rgb_path: string; swir_path: string; capture_metadata_path: string; annotation_path: string }
  }> }>
}

const slice = manifest.slices.find((s) => s.batch_id === Number(args.slice))
if (!slice || !slice.pairs) {
  console.error(`No pairs in slice ${args.slice}`)
  Deno.exit(1)
}

console.log('# Pairs to process')
console.log('')
let i = 1
for (const p of slice.pairs) {
  console.log(`Pair ${i} — ${p.pair_id}:`)
  console.log(`  PRE rgb_path:  ${p.pre.rgb_path}`)
  console.log(`  PRE swir_path: ${p.pre.swir_path}`)
  console.log(`  PRE meta:      ${p.pre.capture_metadata_path}`)
  console.log(`  CURRENT rgb_path:  ${p.current.rgb_path}`)
  console.log(`  CURRENT swir_path: ${p.current.swir_path}`)
  console.log(`  CURRENT meta:      ${p.current.capture_metadata_path}`)
  console.log(`  WRITE to: ${p.current.annotation_path}`)
  console.log('')
  i++
}
