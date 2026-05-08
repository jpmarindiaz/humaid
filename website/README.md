# website

humaid public site — Hono + React on Deno Deploy. One bundle, one isolate,
two model subsystems running side-by-side:

| Demo | Stack | Route | Where it'd live in production |
|---|---|---|---|
| Knowledge base | Ollama daemon + Nomic + DuckDB | `POST /api/qa`, `POST /api/chat` (JSON) | Laptop / Raspberry-class community station |
| Flood detection | llama-server + `jpmarindiaz/lfm2-flood` + mmproj | `POST /api/flood`, `POST /api/chat` (multipart) | Onboard satellite payload |

The website hosts both so visitors can play with each. The contract for the
flood model is the canonical one in
[`finetune-flood/docs/06-deploy-website.md`](../finetune-flood/docs/06-deploy-website.md)
— 4 PNGs in fixed order, OpenAI-compatible request, json_schema response
format. The KB contract is plain JSON in / matches out.

## Layout

```
website/
├── deno.json             tasks + imports (Hono server config)
├── deno-client.json      React JSX config for the bundled client
├── main.tsx              Hono app (routes + static + APIs)
├── views/
│   ├── Landing.tsx       editorial landing (server-rendered Hono JSX)
│   └── ChatShell.tsx     wrapper that mounts the React client
├── client/
│   ├── chat.tsx          React: tabbed UI for KB and flood demos
│   └── styles.css        Tailwind v4 entry (chat only)
├── lib/
│   ├── ollama.ts         spawns `ollama serve`, exposes embedTexts()
│   ├── llama.ts          spawns `llama-server`, exposes chatCompletions()
│   ├── prompts.ts        FLOOD_LABEL_SCHEMA + SYSTEM_PROMPT (mirrors src/prompts.ts)
│   ├── flood.ts          predictFlood(): 4-image OpenAI request → 7-key JSON
│   └── qa.ts             qaSearch(): Nomic embed → DuckDB cosine
├── scripts/
│   ├── fetch_binaries.ts pulls ollama bin + llama.cpp bin + lfm2-flood + mmproj
│   └── build_kb.ts       copies kb.duckdb from ../knowledge-base/
├── data/
│   └── kb.duckdb         471 rows × 768d Nomic embeddings (~2.3 MB, committed)
├── bin/                  populated by fetch_binaries.ts (gitignored)
│   ├── ollama-linux-amd64
│   ├── llama-cpp/llama-server + .so libs
│   └── models/
│       ├── lfm2-flood-Q4_0.gguf
│       └── mmproj-lfm2-flood-F16.gguf
├── static/               build output (chat.js, styles.css, landing.css)
└── assets/               landing imagery from pitch/images/
```

## Routes

| Path | Method | Purpose |
|---|---|---|
| `/` | GET | Landing page — Hono JSX, custom CSS in `static/landing.css` |
| `/app` | GET | Demo UI — React app mounted on a small HTML shell |
| `/api/health` | GET | Both subsystems' status |
| `/api/kb` | GET | KB stats (total / by role / phase / region) from DuckDB |
| `/api/qa` | POST | `{ query, role?, phase?, region?, limit? }` → top-k matches |
| `/api/flood` | POST | multipart: 4 PNGs → 7-key flood JSON |
| `/api/chat` | POST | Unified router. JSON body → KB. multipart → flood. |

The chat client posts everything to `/api/chat` and the server picks the
right backend based on `Content-Type`.

## Local development

You need:

- **Deno 2.x**
- **Ollama** running locally with `nomic-embed-text` pulled
- **llama-server** running locally with the fine-tuned flood model
  (or rely on `deno task fetch-binaries` to download it)

### Quick path — KB only

```bash
ollama pull nomic-embed-text       # ~270 MB

cd website
deno task build:css
deno task build:client
deno task start                    # http://localhost:8000
```

The KB demo will work; the flood tab will return an error from
`llama-server unreachable` until you do the next step.

### Full path — KB + flood

Two terminal options.

**Option A** — let the website fetch its own binaries:

```bash
cd website
deno task fetch-binaries           # pulls ollama bin + llama.cpp bin + lfm2-flood
deno task build:css
deno task build:client
deno task start
```

`lib/llama.ts` will spawn `llama-server` on `:8765` from the bundled GGUF.

**Option B** — point at the existing `finetune-flood/app/` setup:

```bash
# terminal 1 — finetune-flood serves llama-server on :8765 with our GGUFs
cd finetune-flood
deno task serve

# terminal 2 — the website auto-detects the running llama-server
cd website
deno task build:css && deno task build:client
deno task start
```

This is what we did during the smoke test above.

## Deno Deploy

Set these env vars on the project before pushing (per
`finetune-flood/docs/06-deploy-website.md`):

```
MODEL_GGUF_URL=https://huggingface.co/jpmarindiaz/lfm2-flood/resolve/main/lfm2-flood-Q4_0.gguf
MODEL_FILENAME=lfm2-flood-Q4_0.gguf
MMPROJ_URL=https://huggingface.co/jpmarindiaz/lfm2-flood/resolve/main/mmproj-lfm2-flood-F16.gguf
MMPROJ_FILENAME=mmproj-lfm2-flood-F16.gguf
LLAMA_CTX=8192
```

Build command: `deno task build` (runs install → build:kb → fetch-binaries
→ build:css → build:client). Start command: `deno task start`. Both are
defined in `deno.json`. The build artifact bundles `bin/`, `data/`,
`static/`, `assets/`, and the source under `main.tsx` / `lib/` / `views/`.

## Why DuckDB

Same `kb.duckdb` the local CLI in `knowledge-base/rag/` uses. `qaSearch()`
runs `array_cosine_similarity(embedding, $query_vec) ORDER BY similarity
DESC LIMIT k` — DuckDB does the math, not us. Filtering by
role/phase/region is a plain `WHERE`. The `@duckdb/node-api` npm package
ships an N-API native binding that works under Deno's `nodeModulesDir:
"auto"` — `deno serve` needs `--allow-ffi` (already set in the tasks).

To rebuild the index after editing `knowledge-base/qa-pairs.csv`:

```bash
cd knowledge-base && deno task build       # → knowledge-base/kb.duckdb
cd ../website     && deno task build:kb    # → website/data/kb.duckdb
```

## Why two binaries on one isolate

- **Ollama** is the cleanest path to Nomic embeddings (and any future
  small-text-model layer for synthesis). It pulls models from the registry
  on first use into `/tmp/ollama` and stays warm across requests on the
  same isolate.
- **llama-server** loads the LFM2-VL fine-tune correctly, including the
  multimodal projector (`mmproj-*.gguf`). Ollama can't — see the doc above.

The two subprocesses bind different ports (`11434` and `8765`) and don't
interact. Eager-init in `main.tsx` starts both at isolate boot so the
first request doesn't pay the full cold-start tax serially.

## Known cold-start cost

| Phase | Time |
|---|---|
| Isolate boot + module load | ~1 s |
| Ollama daemon spawn + Nomic pull (first time) | ~30 s |
| llama-server spawn + GGUF mmap + mmproj load | ~30–60 s |
| Subsequent KB query | <100 ms |
| Subsequent flood inference | ~1–2 s on dev hardware |

Both daemons live as long as the isolate does, which is why eager-init
matters — without it the first `/api/qa` and `/api/flood` would each pay
their own warmup cost.
