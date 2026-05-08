// DuckDB connection helpers.
//
// One file `kb.duckdb` next to qa-pairs.csv holds the full index (one row per
// Q&A pair, embedding inline). It's small (~1.5 MB for 471 × 768 floats) and
// is checked into the repo so consumers don't need to rebuild.

import { DuckDBInstance } from 'npm:@duckdb/node-api@1.1.3-alpha.7'
import { dirname, fromFileUrl, join } from 'jsr:@std/path@^1.0.8'
import { EMBEDDING_DIM } from './embed.ts'

export const KB_DUCKDB_PATH = join(dirname(fromFileUrl(import.meta.url)), '..', 'kb.duckdb')
export const QA_CSV_PATH = join(dirname(fromFileUrl(import.meta.url)), '..', 'qa-pairs.csv')

export async function openDb(path: string = KB_DUCKDB_PATH) {
  const instance = await DuckDBInstance.create(path)
  return await instance.connect()
}

export const QA_DDL = `
  CREATE TABLE IF NOT EXISTS qa (
    id          VARCHAR PRIMARY KEY,
    role        VARCHAR,
    phase       VARCHAR,
    region      VARCHAR,
    topic       VARCHAR,
    question_en TEXT,
    question_es TEXT,
    answer_en   TEXT,
    answer_es   TEXT,
    "references" TEXT,
    ref_types   TEXT,
    embedding   FLOAT[${EMBEDDING_DIM}]
  )
`

/** Inline a Float32Array as a DuckDB FLOAT[N] literal. Safe — values are ours. */
export function floatArrayLiteral(v: Float32Array | number[]): string {
  const parts: string[] = new Array(v.length)
  for (let i = 0; i < v.length; i++) parts[i] = (v[i] as number).toFixed(7)
  return `[${parts.join(',')}]::FLOAT[${v.length}]`
}

/** SQL-quote a string by doubling single quotes. */
export function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}
