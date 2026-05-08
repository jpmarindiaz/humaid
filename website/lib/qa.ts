// Q&A retrieval over the bundled DuckDB knowledge base.
//
// The same `kb.duckdb` we built in `knowledge-base/rag/` ships with the
// website (`data/kb.duckdb`, ~2.9 MB, 589 rows × 768d Nomic embeddings —
// 471 humanitarian + 118 project-meta).
// Queries run via `@duckdb/node-api` against that file using DuckDB's
// native `array_cosine_similarity()` — same engine, same SQL, same
// results as the local CLI.
//
// To rebuild after editing the source CSV:
//   cd ../knowledge-base && deno task build
//   cd ../website         && deno task build:kb   # copies into data/

import { DuckDBInstance } from "@duckdb/node-api";
import { embedTexts } from "./ollama.ts";

const KB_DUCKDB = new URL("../data/kb.duckdb", import.meta.url).pathname;
const EMBED_MODEL = Deno.env.get("EMBED_MODEL") ?? "nomic-embed-text";

export interface QaMatch {
  id: string;
  role: string;
  phase: string;
  region: string;
  topic: string;
  question_en: string;
  question_es: string;
  answer_en: string;
  answer_es: string;
  references: string;
  ref_types: string;
  similarity: number;
}

export interface QaSearchOptions {
  limit?: number;
  minSimilarity?: number;
  role?: string;
  phase?: string;
  region?: string;
}

let connPromise: ReturnType<typeof openConnection> | null = null;

async function openConnection() {
  const instance = await DuckDBInstance.create(KB_DUCKDB);
  const conn = await instance.connect();
  console.log(`[qa] opened ${KB_DUCKDB}`);
  return conn;
}

function getConnection() {
  if (!connPromise) connPromise = openConnection();
  return connPromise;
}

function floatArrayLiteral(v: Float32Array): string {
  const parts = new Array<string>(v.length);
  for (let i = 0; i < v.length; i++) parts[i] = v[i].toFixed(7);
  return `[${parts.join(",")}]::FLOAT[${v.length}]`;
}

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

export async function qaSearch(query: string, opts: QaSearchOptions = {}): Promise<QaMatch[]> {
  const limit = opts.limit ?? 5;
  const minSimilarity = opts.minSimilarity ?? 0.4;

  const [queryVec] = await embedTexts(EMBED_MODEL, [query]);
  const conn = await getConnection();

  const where: string[] = [];
  if (opts.role)   where.push(`role   = ${sqlString(opts.role)}`);
  if (opts.phase)  where.push(`phase  = ${sqlString(opts.phase)}`);
  if (opts.region) where.push(`region = ${sqlString(opts.region)}`);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Inline the query embedding as a FLOAT[768] literal — same approach the
  // local CLI uses (`knowledge-base/rag/search.ts`). Values are our own,
  // not user input.
  const reader = await conn.runAndReadAll(`
    SELECT id, role, phase, region, topic,
           question_en, question_es, answer_en, answer_es,
           "references", ref_types,
           array_cosine_similarity(embedding, ${floatArrayLiteral(queryVec)}) AS similarity
    FROM qa
    ${whereSql}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);

  const out: QaMatch[] = [];
  for (const r of reader.getRows()) {
    const sim = Number(r[11]);
    if (sim < minSimilarity) continue;
    out.push({
      id:           String(r[0]),
      role:         String(r[1]),
      phase:        String(r[2]),
      region:       String(r[3]),
      topic:        String(r[4]),
      question_en:  String(r[5]),
      question_es:  String(r[6]),
      answer_en:    String(r[7]),
      answer_es:    String(r[8]),
      references:   String(r[9]  ?? ""),
      ref_types:    String(r[10] ?? ""),
      similarity:   sim,
    });
  }
  return out;
}

export async function kbStats() {
  const conn = await getConnection();
  const all = await conn.runAndReadAll(`
    SELECT
      (SELECT COUNT(*) FROM qa) AS total,
      role, phase, region, COUNT(*) AS n
    FROM qa
    GROUP BY role, phase, region
  `);

  let total = 0;
  const byRole: Record<string, number> = {};
  const byPhase: Record<string, number> = {};
  const byRegion: Record<string, number> = {};
  for (const r of all.getRows()) {
    total = Number(r[0]);
    const role = String(r[1]);
    const phase = String(r[2]);
    const region = String(r[3]);
    const n = Number(r[4]);
    byRole[role]     = (byRole[role]   ?? 0) + n;
    byPhase[phase]   = (byPhase[phase] ?? 0) + n;
    byRegion[region] = (byRegion[region] ?? 0) + n;
  }
  return { total, byRole, byPhase, byRegion };
}
