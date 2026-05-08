/** @jsxImportSource hono/jsx */
// humaid website — Hono server bundling two model systems on one isolate:
//
//   KB demo (laptop-class)        ollama daemon  +  Nomic embeddings
//                                 → cosine search over data/kb.duckdb
//   Flood demo (satellite-class)  llama-server   +  jpmarindiaz/lfm2-flood
//                                 → 4-image OpenAI-compatible inference
//
// Routes:
//   GET  /                landing page (Hono JSX)
//   GET  /app             chat shell that mounts the React client
//   GET  /api/health      both subsystems' status
//   GET  /api/kb          KB stats from DuckDB
//   POST /api/qa          { query, role?, phase?, region?, limit? } → matches
//   POST /api/flood       multipart: pre_rgb, pre_swir, cur_rgb, cur_swir → labels
//   POST /api/chat        unified router — text → /api/qa, 4 images → /api/flood

import { Hono } from "hono";
import { Landing } from "./views/Landing.tsx";
import { ChatShell } from "./views/ChatShell.tsx";
import { listOllamaModels, ollamaConfig, startOllamaServer } from "./lib/ollama.ts";
import { config as llamaConfig, getModels as getLlamaModels, startLlamaServer } from "./lib/llama.ts";
import { kbStats, qaSearch } from "./lib/qa.ts";
import { type FloodInput, predictFlood } from "./lib/flood.ts";

// Eager-init both subsystems on isolate boot so the first user request
// doesn't pay the full cold-start tax serially.
startOllamaServer().catch((err) => console.error("eager ollama init failed:", err));
startLlamaServer().catch((err) => console.error("eager llama-server init failed:", err));

const app = new Hono();

// ── Pages ─────────────────────────────────────────────────────────────

app.get("/", (c) => c.html(<Landing />));
app.get("/app", (c) => c.html(<ChatShell />));

// ── Static + assets ───────────────────────────────────────────────────

const STATIC_DIR = new URL("./static/", import.meta.url);
const ASSETS_DIR = new URL("./assets/", import.meta.url);

const STATIC_TYPES: Record<string, string> = {
  js:   "application/javascript; charset=utf-8",
  css:  "text/css; charset=utf-8",
  map:  "application/json; charset=utf-8",
  svg:  "image/svg+xml",
  ico:  "image/x-icon",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

async function serveFile(dir: URL, file: string) {
  if (file.includes("/") || file.includes("..")) return null;
  try {
    const content = await Deno.readFile(new URL(file, dir));
    const ext = file.split(".").pop() ?? "";
    const type = STATIC_TYPES[ext] ?? "application/octet-stream";
    return new Response(content, { headers: { "content-type": type } });
  } catch {
    return null;
  }
}

app.get("/static/:file", async (c) => (await serveFile(STATIC_DIR, c.req.param("file"))) ?? c.notFound());
app.get("/assets/:file", async (c) => (await serveFile(ASSETS_DIR, c.req.param("file"))) ?? c.notFound());

// ── Health / introspection ────────────────────────────────────────────

app.get("/api/health", async (c) => {
  const out: Record<string, unknown> = {
    kb: { status: "unknown" },
    flood: { status: "unknown" },
  };
  try {
    await startOllamaServer();
    out.kb = {
      status: "ok",
      ollama_version: ollamaConfig.OLLAMA_VERSION,
      models: await listOllamaModels(),
    };
  } catch (err) {
    out.kb = { status: "down", error: (err as Error).message };
  }
  try {
    await startLlamaServer();
    out.flood = {
      status: "ok",
      ctx_size: llamaConfig.CTX_SIZE,
      model: llamaConfig.MODEL_FILENAME,
      mmproj: llamaConfig.MMPROJ_FILENAME,
      models: await getLlamaModels(),
    };
  } catch (err) {
    out.flood = { status: "down", error: (err as Error).message };
  }
  const overall = out.kb && (out.kb as { status: string }).status === "ok" &&
    out.flood && (out.flood as { status: string }).status === "ok";
  return c.json({ ok: overall, ...out }, overall ? 200 : 503);
});

app.get("/api/kb", async (c) => {
  try { return c.json(await kbStats()); }
  catch (err) { return c.json({ error: String(err) }, 500); }
});

// ── /api/qa — knowledge-base retrieval (Ollama + Nomic + DuckDB) ──────

interface QaRequest {
  query?: string;
  q?: string;
  limit?: number;
  k?: number;
  min_similarity?: number;
  role?: string;
  phase?: string;
  region?: string;
}

app.post("/api/qa", async (c) => {
  let body: QaRequest;
  try { body = await c.req.json(); }
  catch { return c.json({ error: "JSON body required" }, 400); }

  const query = (body.query ?? body.q ?? "").trim();
  if (!query) return c.json({ error: "query is required" }, 400);

  try {
    const matches = await qaSearch(query, {
      limit:         body.limit ?? body.k,
      minSimilarity: body.min_similarity,
      role:          body.role,
      phase:         body.phase,
      region:        body.region,
    });
    return c.json({ query, matches });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ── /api/flood — 4-image satellite flood detection ────────────────────
//
// Multipart contract from `finetune-flood/docs/06-deploy-website.md`:
// fields pre_rgb, pre_swir, cur_rgb, cur_swir (all PNG). The order is
// load-bearing — the system prompt tells the model which image is which.

const FLOOD_FIELDS = {
  pre_rgb:  "preRgb",
  pre_swir: "preSwir",
  cur_rgb:  "curRgb",
  cur_swir: "curSwir",
} as const satisfies Record<string, keyof FloodInput>;

async function readFloodFiles(form: FormData): Promise<FloodInput | { missing: string[] }> {
  const images = {} as FloodInput;
  const missing: string[] = [];
  for (const [field, key] of Object.entries(FLOOD_FIELDS)) {
    const file = form.get(field);
    if (!(file instanceof File)) { missing.push(field); continue; }
    images[key as keyof FloodInput] = new Uint8Array(await file.arrayBuffer());
  }
  return missing.length ? { missing } : images;
}

app.post("/api/flood", async (c) => {
  let form: FormData;
  try { form = await c.req.formData(); }
  catch { return c.json({ ok: false, error: "multipart form required" }, 400); }

  const result = await readFloodFiles(form);
  if ("missing" in result) {
    return c.json({ ok: false, error: `missing fields: ${result.missing.join(", ")}` }, 400);
  }
  const out = await predictFlood(result);
  return c.json(out, out.ok ? 200 : 500);
});

// ── /api/chat — unified router ────────────────────────────────────────
//
// Single endpoint the chat UI sends every message to. Routing rule:
//   - text only          → KB retrieval
//   - 4 images attached  → flood detection (text becomes optional context,
//                          ignored by the model — the prompt is fixed)
//   - any other count    → 400 with a helpful message
//
// The 4-image rule mirrors the satellite model's calibration: images must
// be {pre_rgb, pre_swir, cur_rgb, cur_swir}. We use multipart here because
// 4 PNGs base64-encoded blow past 4-5 MB of JSON.

app.post("/api/chat", async (c) => {
  const ct = c.req.header("content-type") ?? "";

  // Multipart branch — flood detection
  if (ct.startsWith("multipart/form-data")) {
    let form: FormData;
    try { form = await c.req.formData(); }
    catch { return c.json({ kind: "error", error: "multipart parse failed" }, 400); }

    const parsed = await readFloodFiles(form);
    if ("missing" in parsed) {
      return c.json({
        kind: "error",
        error: `flood detection needs 4 images (pre_rgb, pre_swir, cur_rgb, cur_swir); missing: ${parsed.missing.join(", ")}`,
      }, 400);
    }
    const result = await predictFlood(parsed);
    return c.json({ kind: "flood", ...result }, result.ok ? 200 : 500);
  }

  // JSON branch — KB retrieval
  let body: { message?: string; role?: string; phase?: string; region?: string };
  try { body = await c.req.json(); }
  catch { return c.json({ kind: "error", error: "JSON body required" }, 400); }

  const text = (body.message ?? "").trim();
  if (!text) return c.json({ kind: "error", error: "message is required" }, 400);

  try {
    const matches = await qaSearch(text, {
      limit: 3,
      role: body.role, phase: body.phase, region: body.region,
    });
    return c.json({ kind: "qa", query: text, matches });
  } catch (err) {
    return c.json({ kind: "error", error: String(err) }, 500);
  }
});

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

export default app;
