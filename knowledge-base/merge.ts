// Merge per-role CSV chunks into knowledge-base/qa-pairs.csv.
//
// - Validates each chunk against the agreed schema
// - Renumbers ids globally as qa-NNNN to avoid collisions
// - Reports per-role and per-(phase, region) counts
// - Writes a single merged qa-pairs.csv plus a small qa-stats.json
//
// Run from this directory:    deno run -A merge.ts

import { parse } from 'jsr:@std/csv@^1.0.5'
import { dirname, fromFileUrl, join } from 'jsr:@std/path@^1.0.8'

const EXPECTED_HEADER = [
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

type Field = typeof EXPECTED_HEADER[number]
type Row = Record<Field, string>

const ROLES = new Set([
  'local-community',
  'local-authority',
  'national-authorities',
  'humanitarian-staff',
  'ngos',
  'first-respondants',
])
const PHASES = new Set(['pre', 'event', 'post'])
const REGIONS = new Set(['la-mojana', 'putumayo', 'generic'])

const here = dirname(fromFileUrl(import.meta.url))
const chunkDir = join(here, 'chunks')
const outPath = join(here, 'qa-pairs.csv')
const statsPath = join(here, 'qa-stats.json')

// Force quote-all on every cell to match the chunks the agents wrote and to
// keep the CSV trivial to parse with any tool. @std/csv's stringify uses
// minimal quoting which would silently rewrite quoting style on round-trip.
function csvCell(s: string): string {
  return `"${s.replace(/"/g, '""')}"`
}

const chunks: string[] = []
for await (const entry of Deno.readDir(chunkDir)) {
  if (entry.isFile && entry.name.endsWith('.csv')) chunks.push(join(chunkDir, entry.name))
}
chunks.sort()

if (chunks.length === 0) {
  console.error(`No chunks found under ${chunkDir}`)
  Deno.exit(1)
}

const rows: Row[] = []
const issues: string[] = []
const perRole = new Map<string, number>()

for (const chunk of chunks) {
  const text = await Deno.readTextFile(chunk)
  const records = parse(text) as string[][]
  if (records.length === 0) {
    issues.push(`${chunk}: empty file`)
    continue
  }
  const [header, ...body] = records
  if (
    header.length !== EXPECTED_HEADER.length ||
    !EXPECTED_HEADER.every((h, i) => header[i] === h)
  ) {
    issues.push(`${chunk}: header mismatch -> ${header.join(',')}`)
    continue
  }

  body.forEach((raw, idx) => {
    const lineNo = idx + 2 // header is line 1
    if (raw.length !== EXPECTED_HEADER.length) {
      issues.push(`${chunk}:${lineNo} expected ${EXPECTED_HEADER.length} cols, got ${raw.length}`)
      return
    }
    const rec = Object.fromEntries(EXPECTED_HEADER.map((k, i) => [k, raw[i]])) as Row
    if (!ROLES.has(rec.role)) issues.push(`${chunk}:${lineNo} unknown role: ${JSON.stringify(rec.role)}`)
    if (!PHASES.has(rec.phase)) issues.push(`${chunk}:${lineNo} unknown phase: ${JSON.stringify(rec.phase)}`)
    if (!REGIONS.has(rec.region)) issues.push(`${chunk}:${lineNo} unknown region: ${JSON.stringify(rec.region)}`)
    const refs = rec.references ? rec.references.split('|') : []
    const types = rec.ref_types ? rec.ref_types.split('|') : []
    if (refs.length !== types.length) {
      issues.push(
        `${chunk}:${lineNo} references/ref_types length mismatch (${refs.length} vs ${types.length})`,
      )
    }
    rows.push(rec)
    perRole.set(rec.role, (perRole.get(rec.role) ?? 0) + 1)
  })
}

rows.sort((a, b) => {
  return a.role.localeCompare(b.role) ||
    a.phase.localeCompare(b.phase) ||
    a.region.localeCompare(b.region) ||
    a.id.localeCompare(b.id)
})

rows.forEach((r, i) => {
  r.id = `qa-${String(i + 1).padStart(4, '0')}`
})

// CRLF per RFC 4180 — matches what most CSV consumers (Excel, Sheets, Python's
// csv module) emit by default.
const lines = [EXPECTED_HEADER.map(csvCell).join(',')]
for (const r of rows) lines.push(EXPECTED_HEADER.map((k) => csvCell(r[k])).join(','))
await Deno.writeTextFile(outPath, lines.join('\r\n') + '\r\n')

function tally<T extends string>(keyFn: (r: Row) => T): Record<T, number> {
  const out: Partial<Record<T, number>> = {}
  for (const r of rows) {
    const k = keyFn(r)
    out[k] = (out[k] ?? 0) + 1
  }
  return out as Record<T, number>
}

const stats = {
  total_rows: rows.length,
  by_role: Object.fromEntries(Array.from(perRole.entries()).sort()),
  by_phase: tally((r) => r.phase),
  by_region: tally((r) => r.region),
  by_role_phase: tally((r) => `${r.role}|${r.phase}`),
  by_role_region: tally((r) => `${r.role}|${r.region}`),
  by_topic: Object.fromEntries(
    Object.entries(tally((r) => r.topic)).sort((a, b) => b[1] - a[1]),
  ),
  issues,
}
await Deno.writeTextFile(statsPath, JSON.stringify(stats, null, 2) + '\n')

console.log(`Merged ${rows.length} rows from ${chunks.length} chunks → ${outPath}`)
for (const [role, n] of Array.from(perRole.entries()).sort()) {
  console.log(`  ${role.padEnd(24)} ${n}`)
}

if (issues.length > 0) {
  console.log(`\n${issues.length} schema issues (see qa-stats.json):`)
  for (const line of issues.slice(0, 20)) console.log(`  ${line}`)
  if (issues.length > 20) console.log(`  … and ${issues.length - 20} more`)
  Deno.exit(2)
}
