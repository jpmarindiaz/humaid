# rag — local Q&A retrieval

A minimal semantic-search layer over `qa-pairs.csv`. Embeds each pair once
into a local DuckDB file (`kb.duckdb`, committed to the repo) and searches
by cosine similarity.

## Files

```
rag/
├── embed.ts    Ollama Nomic embed wrapper (768-dim, multilingual)
├── db.ts       DuckDB connection + schema + literal helpers
├── build.ts    Read CSV → embed → write kb.duckdb
├── search.ts   Embed query → top-k cosine match
└── ask.ts      CLI wrapper around search.ts
```

The DuckDB file lives at `knowledge-base/kb.duckdb` (~2.9 MB for 589 rows
× 768-dim float embeddings — 471 humanitarian rows from `qa-pairs.csv` plus
118 project-meta rows from `../project-qa/`). Committed so consumers don't
need to rebuild; regenerate after editing either source.

## Prerequisites

- Deno 2.x
- Local Ollama running with `nomic-embed-text` pulled:

  ```bash
  ollama pull nomic-embed-text
  ```

  Set `OLLAMA_URL` to override `http://localhost:11434` and `NOMIC_MODEL`
  to override `nomic-embed-text`.

## Usage

```bash
# (Re)build the index from qa-pairs.csv (~3 s on M-series, batched 32×).
cd knowledge-base
deno task build

# Ask a question — JSON output by default
deno task ask "How do I evacuate when the river rises overnight?"

# Human-readable output, top 3
deno task ask "what should i pack in my go-bag" --text --k 3

# With filters
deno task ask "¿Qué hago durante un paro armado?" \
  --role local-community --region putumayo --text
```

CLI flags (`rag/ask.ts`):

| Flag | Default | Effect |
|---|---|---|
| `--k <N>` | `5` | top-k results |
| `--min <0..1>` | `0.4` | minimum cosine similarity |
| `--role <role>` | — | filter by `role` |
| `--phase <pre\|event\|post>` | — | filter by `phase` |
| `--region <la-mojana\|putumayo\|generic>` | — | filter by `region` |
| `--text` | off | human-readable output instead of JSON |

## Programmatic use

```ts
import { search } from './rag/search.ts'

const matches = await search('how do I rescue someone from a roof', {
  limit: 3,
  region: 'putumayo',
})
// matches: { id, role, phase, region, topic, question_en, ..., similarity }[]
```

## How the index is built

1. Read all 471 rows from `qa-pairs.csv`.
2. For each row, embed `question_en + "\n" + question_es` via Ollama
   (one embedding per pair — concat works because Nomic is multilingual,
   so a query in either language hits the right row).
3. Drop the existing `kb.duckdb` and rewrite — the CSV is the source of
   truth.
4. INSERT into a single `qa` table with `embedding FLOAT[768]` inline.

## How a query runs

1. Embed the query text via Ollama (one round trip).
2. `SELECT … array_cosine_similarity(embedding, $query) AS similarity
   FROM qa [WHERE filters] ORDER BY similarity DESC LIMIT k`.
3. Drop rows below `minSimilarity`, return the rest.

No HNSW index — for 589 rows the sequential scan is ~1 ms, not worth the
extension dependency.
