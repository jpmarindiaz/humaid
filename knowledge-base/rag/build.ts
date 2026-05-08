// Build kb.duckdb from qa-pairs.csv.
//
// Embeds each Q&A pair (concatenating EN + ES question so a query in either
// language hits the same row) and writes the index to a local DuckDB file.
// Re-running drops and recreates the qa table — the CSV is the source of truth.

import { parse } from 'jsr:@std/csv@^1.0.5'
import { embed } from './embed.ts'
import { floatArrayLiteral, KB_DUCKDB_PATH, openDb, QA_CSV_PATH, QA_DDL, sqlString } from './db.ts'

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

type Row = Record<typeof HEADER[number], string>

const t0 = performance.now()

const csv = await Deno.readTextFile(QA_CSV_PATH)
const records = parse(csv) as string[][]
const [header, ...body] = records
if (header.length !== HEADER.length || !HEADER.every((h, i) => header[i] === h)) {
  throw new Error(`qa-pairs.csv header mismatch: got ${header.join(',')}`)
}
const rows: Row[] = body.map((r) =>
  Object.fromEntries(HEADER.map((k, i) => [k, r[i] ?? ''])) as Row
)
console.log(`Read ${rows.length} Q&A pairs from ${QA_CSV_PATH}`)

// One embedding per row. We concat EN + ES question with a separator so a
// query in either language matches the same row. Nomic handles multilingual
// fine; concat produces a centroid-ish vector that works well for retrieval.
const embedTexts = rows.map((r) => `${r.question_en}\n${r.question_es}`)

console.log(`Embedding ${embedTexts.length} texts via Ollama...`)
const BATCH = 32
const embeddings: Float32Array[] = []
for (let i = 0; i < embedTexts.length; i += BATCH) {
  const slice = embedTexts.slice(i, i + BATCH)
  const out = await embed(slice)
  embeddings.push(...out)
  Deno.stdout.writeSync(new TextEncoder().encode(`\r  ${embeddings.length}/${embedTexts.length}`))
}
console.log() // newline after progress

// Wipe and rewrite — the CSV is canonical.
try {
  await Deno.remove(KB_DUCKDB_PATH)
} catch { /* file may not exist on first run */ }
const conn = await openDb(KB_DUCKDB_PATH)
await conn.run(QA_DDL)

// Multi-row INSERT in batches. Inline literals are safe (our own data) and
// avoid the prepare/bind dance for FLOAT[N] columns.
const INSERT_BATCH = 50
for (let i = 0; i < rows.length; i += INSERT_BATCH) {
  const slice = rows.slice(i, i + INSERT_BATCH)
  const values: string[] = []
  for (let j = 0; j < slice.length; j++) {
    const r = slice[j]
    const e = embeddings[i + j]
    values.push(
      `(${sqlString(r.id)}, ${sqlString(r.role)}, ${sqlString(r.phase)}, ` +
        `${sqlString(r.region)}, ${sqlString(r.topic)}, ` +
        `${sqlString(r.question_en)}, ${sqlString(r.question_es)}, ` +
        `${sqlString(r.answer_en)}, ${sqlString(r.answer_es)}, ` +
        `${sqlString(r.references)}, ${sqlString(r.ref_types)}, ` +
        `${floatArrayLiteral(e)})`,
    )
  }
  await conn.run(`INSERT INTO qa VALUES ${values.join(',')}`)
}

const count = await conn.runAndReadAll('SELECT COUNT(*) FROM qa')
const ms = Math.round(performance.now() - t0)
console.log(`Wrote ${count.getRows()[0][0]} rows to ${KB_DUCKDB_PATH} (${ms} ms)`)
