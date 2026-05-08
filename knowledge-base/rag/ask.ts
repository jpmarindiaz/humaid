// CLI: `deno task ask "question" [--role X] [--phase pre|event|post] [--region X] [--k N]`
//
// Embeds the question, returns the top-k matching Q&A pairs as JSON (default)
// or as a human-readable block (`--text`). The index must already exist —
// run `deno task build` first to (re)generate kb.duckdb.

import { parseArgs } from 'jsr:@std/cli@^1.0.6/parse-args'
import { search } from './search.ts'

const args = parseArgs(Deno.args, {
  string: ['role', 'phase', 'region', 'k', 'min'],
  boolean: ['text', 'help'],
  alias: { k: 'limit', h: 'help' },
})

if (args.help || args._.length === 0) {
  console.log(`Usage: deno task ask "<question>" [options]

Options:
  --role <role>      filter by role (humanitarian-staff, local-community, ...)
  --phase <phase>    filter by phase (pre | event | post)
  --region <region>  filter by region (la-mojana | putumayo | generic)
  --k <N>            top-k results (default 5)
  --min <0..1>       min cosine similarity (default 0.4)
  --text             human-readable output instead of JSON`)
  Deno.exit(0)
}

const query = String(args._[0])
const matches = await search(query, {
  limit: args.k ? parseInt(args.k, 10) : undefined,
  minSimilarity: args.min ? parseFloat(args.min) : undefined,
  role: args.role,
  phase: args.phase,
  region: args.region,
})

if (args.text) {
  console.log(`Q: ${query}\n`)
  if (matches.length === 0) {
    console.log('(no matches above threshold)')
  } else {
    for (const m of matches) {
      console.log(`── ${m.id}  sim=${m.similarity.toFixed(3)}  [${m.role} · ${m.phase} · ${m.region}]`)
      console.log(`Q (en): ${m.question_en}`)
      console.log(`A (en): ${m.answer_en}`)
      console.log()
    }
  }
} else {
  console.log(JSON.stringify({ query, matches }, null, 2))
}
