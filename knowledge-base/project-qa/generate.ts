// Emit project-pairs.csv from source.ts.
//
// Same 11-column schema as ../qa-pairs.csv so a single DuckDB index can hold
// both. IDs are renumbered sequentially as `proj-NNNN`. CRLF line endings to
// match the humanitarian CSV (RFC 4180; Excel/Sheets/Python's csv default).
//
// Run from this directory:   deno run -A generate.ts

import { dirname, fromFileUrl, join } from 'jsr:@std/path@^1.0.8'
import { PROJECT_QA, ProjectQA } from './source.ts'

const HEADER = [
  'id',
  'role',
  'phase',
  'region',
  'topic',
  'question_en',
  'question_es',
  'answer_en',
  'answer_es',
  'references',
  'ref_types',
] as const

function csvCell(s: string): string {
  return `"${s.replace(/"/g, '""')}"`
}

function joinPipes(parts: string[] | undefined): string {
  return (parts ?? []).join('|')
}

const here = dirname(fromFileUrl(import.meta.url))
const outPath = join(here, 'project-pairs.csv')

const rows: string[] = [HEADER.map(csvCell).join(',')]
for (let i = 0; i < PROJECT_QA.length; i++) {
  const q: ProjectQA = PROJECT_QA[i]
  const id = `proj-${String(i + 1).padStart(4, '0')}`
  const cells = [
    id,
    q.role,
    'meta',
    q.region,
    q.topic,
    q.question_en,
    q.question_es,
    q.answer_en,
    q.answer_es,
    joinPipes(q.references),
    joinPipes(q.ref_types),
  ]
  if ((q.references?.length ?? 0) !== (q.ref_types?.length ?? 0)) {
    console.error(
      `WARN ${id}: references/ref_types length mismatch (${q.references?.length ?? 0} vs ${q.ref_types?.length ?? 0})`,
    )
  }
  rows.push(cells.map(csvCell).join(','))
}

await Deno.writeTextFile(outPath, rows.join('\r\n') + '\r\n')

const counts = {
  total: PROJECT_QA.length,
  by_role: countBy((q) => q.role),
  by_region: countBy((q) => q.region),
  by_topic: countBy((q) => q.topic),
}

console.log(`Wrote ${PROJECT_QA.length} rows → ${outPath}`)
console.log()
console.log('By role:')
for (const [k, v] of Object.entries(counts.by_role)) console.log(`  ${k.padEnd(24)} ${v}`)
console.log()
console.log('By region:')
for (const [k, v] of Object.entries(counts.by_region)) console.log(`  ${k.padEnd(24)} ${v}`)
console.log()
console.log('By topic:')
for (const [k, v] of Object.entries(counts.by_topic)) console.log(`  ${k.padEnd(36)} ${v}`)

function countBy(fn: (q: ProjectQA) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const q of PROJECT_QA) {
    const k = fn(q)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}
