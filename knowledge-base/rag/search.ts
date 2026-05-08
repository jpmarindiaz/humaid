// Top-k semantic search over the QA index.
//
// Embeds the query, runs cosine similarity in DuckDB, returns the top matches.
// Optional filters by role / phase / region are applied as plain WHERE clauses.

import { embed } from './embed.ts'
import { floatArrayLiteral, openDb, sqlString } from './db.ts'

export interface SearchOptions {
  limit?: number
  minSimilarity?: number
  role?: string
  phase?: string
  region?: string
}

export interface QaMatch {
  id: string
  role: string
  phase: string
  region: string
  topic: string
  question_en: string
  question_es: string
  answer_en: string
  answer_es: string
  references: string
  ref_types: string
  similarity: number
}

export async function search(query: string, opts: SearchOptions = {}): Promise<QaMatch[]> {
  const limit = opts.limit ?? 5
  const minSimilarity = opts.minSimilarity ?? 0.4

  const [queryEmbedding] = await embed([query])

  const where: string[] = []
  if (opts.role) where.push(`role = ${sqlString(opts.role)}`)
  if (opts.phase) where.push(`phase = ${sqlString(opts.phase)}`)
  if (opts.region) where.push(`region = ${sqlString(opts.region)}`)
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const conn = await openDb()
  const reader = await conn.runAndReadAll(`
    SELECT id, role, phase, region, topic,
           question_en, question_es, answer_en, answer_es,
           "references", ref_types,
           array_cosine_similarity(embedding, ${floatArrayLiteral(queryEmbedding)}) AS similarity
    FROM qa
    ${whereSql}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `)

  const out: QaMatch[] = []
  for (const r of reader.getRows()) {
    const sim = Number(r[11])
    if (sim < minSimilarity) continue
    out.push({
      id: String(r[0]),
      role: String(r[1]),
      phase: String(r[2]),
      region: String(r[3]),
      topic: String(r[4]),
      question_en: String(r[5]),
      question_es: String(r[6]),
      answer_en: String(r[7]),
      answer_es: String(r[8]),
      references: String(r[9] ?? ''),
      ref_types: String(r[10] ?? ''),
      similarity: sim,
    })
  }
  return out
}
