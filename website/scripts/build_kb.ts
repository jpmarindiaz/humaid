// Bring the canonical knowledge-base DuckDB file into this deploy artifact.
//
// The build (CSV → Nomic embeddings → kb.duckdb) lives in
// `../knowledge-base/rag/build.ts` so the local CLI and the deployed website
// share a single source of truth. This script just copies the latest result
// in.
//
// To regenerate from scratch after editing qa-pairs.csv:
//   cd ../knowledge-base && deno task build
//   cd ../website        && deno task build:kb

import { dirname, fromFileUrl, resolve } from "@std/path";

const here = dirname(fromFileUrl(import.meta.url));
const SRC = resolve(here, "../../knowledge-base/kb.duckdb");
const DEST = resolve(here, "../data/kb.duckdb");

try {
  const stat = await Deno.stat(SRC);
  await Deno.mkdir(dirname(DEST), { recursive: true });
  await Deno.copyFile(SRC, DEST);
  console.log(`✅ ${DEST} (${(stat.size / 1e6).toFixed(2)} MB) — copied from ${SRC}`);
} catch (err) {
  console.error(`❌ ${SRC} not found.`);
  console.error(`   Run: cd ../knowledge-base && deno task build`);
  console.error(`   Original error: ${(err as Error).message}`);
  Deno.exit(1);
}
