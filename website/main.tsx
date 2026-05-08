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
//   GET  /api/sources     17 source PDFs (gallery data)
//   POST /api/qa          { query, role?, phase?, region?, limit? } → matches
//   POST /api/flood       multipart: pre_rgb, pre_swir, cur_rgb, cur_swir → labels
//   POST /api/chat        unified router — text → /api/qa, 4 images → /api/flood

import { Hono } from "hono";
import { Landing } from "./views/Landing.tsx";
import { ChatShell } from "./views/ChatShell.tsx";
import { listOllamaModels, ollamaConfig, startOllamaServer } from "./lib/ollama.ts";
import { config as llamaConfig, getModels as getLlamaModels, startLlamaServer } from "./lib/llama.ts";
import { kbStats, qaSearch } from "./lib/qa.ts";
import { type FloodInput, type FloodLabels, predictFlood } from "./lib/flood.ts";
import { SOURCES } from "./lib/sources.ts";
import { FLOOD_SAMPLES, SAMPLES_BY_ID } from "./lib/samples.ts";
import {
  type AlertRecord,
  getAlert,
  listAlerts,
  publishAlert,
  shouldPublishAlert,
} from "./lib/alerts.ts";

// Per-isolate request counter — paired with isolate ids from lib/ollama and
// lib/llama to make logs traceable: same isolate_id across messages = warm,
// different = cold-start on a new isolate.
let requestCount = 0;

// Eager-init both subsystems on isolate boot so the first user request
// doesn't pay the full cold-start tax serially.
const BOOT_AT = new Date().toISOString();
const BOOT_ID = Math.random().toString(36).slice(2, 8);
const COMMIT = (Deno.env.get("DENO_DEPLOYMENT_ID") ?? Deno.env.get("COMMIT_SHA") ?? "local").slice(0, 12);
console.log(`[boot ${BOOT_ID}] ╔═══════════════════════════════════════════════════════════════════`);
console.log(`[boot ${BOOT_ID}] ║ humaid · isolate boot`);
console.log(`[boot ${BOOT_ID}] ║   at:        ${BOOT_AT}`);
console.log(`[boot ${BOOT_ID}] ║   pid:       ${Deno.pid}`);
console.log(`[boot ${BOOT_ID}] ║   deploy id: ${COMMIT}`);
console.log(`[boot ${BOOT_ID}] ║   region:    ${Deno.env.get("DENO_REGION") ?? "—"}`);
console.log(`[boot ${BOOT_ID}] ║   model:     ${llamaConfig.MODEL_FILENAME}`);
console.log(`[boot ${BOOT_ID}] ║   mmproj:    ${llamaConfig.MMPROJ_FILENAME}`);
console.log(`[boot ${BOOT_ID}] ║   ctx_size:  ${llamaConfig.CTX_SIZE}`);
console.log(`[boot ${BOOT_ID}] ╚═══════════════════════════════════════════════════════════════════`);

startOllamaServer()
  .then(() => console.log(`[boot ${BOOT_ID}] ✅ ollama daemon ready`))
  .catch((err) => console.error(`[boot ${BOOT_ID}] ❌ eager ollama init failed:`, err));

startLlamaServer()
  .then(() => console.log(`[boot ${BOOT_ID}] ✅ llama-server ready`))
  .catch((err) => console.error(`[boot ${BOOT_ID}] ❌ eager llama-server init failed:`, err));

const app = new Hono();

// Request-level access log — fires on every route. `[req N METHOD PATH]`
// prefix is consistent with the deno-deploy-llamacpp template style.
app.use("*", async (c, next) => {
  const reqId = ++requestCount;
  const t0 = performance.now();
  const url = new URL(c.req.url);
  const ua = c.req.header("user-agent") ?? "—";
  const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
             c.req.header("cf-connecting-ip") ?? "—";
  const ref = c.req.header("referer") ?? "—";
  c.set("reqId" as never, reqId);
  console.log(
    `[req ${reqId}] ← ${c.req.method} ${url.pathname}${url.search} ` +
    `· iso=${BOOT_ID} · ip=${ip} · ua=${ua.slice(0, 60)}${ua.length > 60 ? "…" : ""}` +
    (ref !== "—" ? ` · ref=${ref}` : ""),
  );
  await next();
  const ms = Math.round(performance.now() - t0);
  const status = c.res.status;
  const bytes = c.res.headers.get("content-length") ?? "?";
  const tag = status >= 500 ? "🔥" : status >= 400 ? "⚠" : "✓";
  console.log(`[req ${reqId}] → ${tag} ${status} (${ms}ms · ${bytes}B)`);
});

// ── Pages ─────────────────────────────────────────────────────────────

// HTML shells are tagged with the deploy id so a redeploy bumps the
// effective ETag. We also emit Cache-Control: no-cache so browsers
// revalidate every load — kills the "I see the old UI" class of bug.
const NO_CACHE_HEADERS = {
  "cache-control": "no-cache, must-revalidate",
  "x-deploy-id": COMMIT,
};

app.get("/", (c) => {
  const html = (
    <Landing />
  );
  return c.html(html, 200, NO_CACHE_HEADERS);
});

app.get("/app", (c) => {
  return c.html(<ChatShell deployId={COMMIT} />, 200, NO_CACHE_HEADERS);
});

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

async function serveFile(dir: URL, file: string, cache: "long" | "revalidate" = "long") {
  if (file.includes("..")) return null;
  try {
    const content = await Deno.readFile(new URL(file, dir));
    const ext = file.split(".").pop() ?? "";
    const type = STATIC_TYPES[ext] ?? "application/octet-stream";
    // chat.{js,css} ride on a ?v=<deploy-id> query so the browser cache
    // keys on URL — but the URL the server receives is bare. Send
    // Cache-Control: no-cache, must-revalidate to force a conditional
    // GET each time and avoid the "still seeing old UI" trap. Static
    // images can be aggressively cached.
    const isShellAsset = file === "chat.js" || file === "chat.css" || file === "chat.js.map";
    const cacheControl = isShellAsset || cache === "revalidate"
      ? "no-cache, must-revalidate"
      : "public, max-age=86400, stale-while-revalidate=604800";
    return new Response(content, {
      headers: {
        "content-type": type,
        "cache-control": cacheControl,
        "x-deploy-id": COMMIT,
      },
    });
  } catch {
    return null;
  }
}

app.get("/static/:file", async (c) => (await serveFile(STATIC_DIR, c.req.param("file"))) ?? c.notFound());
// /assets supports nested paths (e.g. assets/samples/<file>.png).
app.get("/assets/*", async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname.replace(/^\/assets\//, "");
  if (path.includes("..")) return c.notFound();
  return (await serveFile(ASSETS_DIR, path)) ?? c.notFound();
});

// ── Health / introspection ────────────────────────────────────────────

app.get("/api/health", async (c) => {
  const reqId = c.get("reqId" as never) as number;
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
    console.log(`[req ${reqId}] /api/health kb=ok`);
  } catch (err) {
    out.kb = { status: "down", error: (err as Error).message };
    console.warn(`[req ${reqId}] /api/health kb=down: ${(err as Error).message}`);
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
    console.log(`[req ${reqId}] /api/health flood=ok`);
  } catch (err) {
    out.flood = { status: "down", error: (err as Error).message };
    console.warn(`[req ${reqId}] /api/health flood=down: ${(err as Error).message}`);
  }
  const overall = out.kb && (out.kb as { status: string }).status === "ok" &&
    out.flood && (out.flood as { status: string }).status === "ok";
  return c.json({ ok: overall, ...out }, overall ? 200 : 503);
});

app.get("/api/kb", async (c) => {
  const reqId = c.get("reqId" as never) as number;
  try {
    const stats = await kbStats();
    console.log(`[req ${reqId}] /api/kb total=${stats.total}`);
    return c.json(stats);
  } catch (err) {
    console.error(`[req ${reqId}] /api/kb error: ${err}`);
    return c.json({ error: String(err) }, 500);
  }
});

app.get("/api/sources", (c) => {
  const reqId = c.get("reqId" as never) as number;
  console.log(`[req ${reqId}] /api/sources total=${SOURCES.length}`);
  return c.json({ total: SOURCES.length, sources: SOURCES });
});

app.get("/api/samples", (c) => {
  const reqId = c.get("reqId" as never) as number;
  console.log(`[req ${reqId}] /api/samples total=${FLOOD_SAMPLES.length}`);
  return c.json({ total: FLOOD_SAMPLES.length, samples: FLOOD_SAMPLES });
});

// ── Alerts: publish (web → KV), list (Tauri polls), get one ───────────

interface PublishAlertRequest {
  /** Sample id from /api/samples — server pulls coordinates + location
   *  + thumbnail from there. The labels are passed in (they came from
   *  the model run on the client side). */
  sample_id: string;
  labels: FloodLabels;
}

app.post("/api/alerts", async (c) => {
  const reqId = c.get("reqId" as never) as number;
  let body: PublishAlertRequest;
  try { body = await c.req.json(); }
  catch { return c.json({ ok: false, error: "JSON body required" }, 400); }

  const sample = SAMPLES_BY_ID[body.sample_id];
  if (!sample) {
    console.warn(`[req ${reqId}] /api/alerts unknown sample_id=${body.sample_id}`);
    return c.json({ ok: false, error: `unknown sample_id: ${body.sample_id}` }, 400);
  }
  if (!body.labels) {
    return c.json({ ok: false, error: "labels required" }, 400);
  }
  if (!shouldPublishAlert(body.labels)) {
    console.log(
      `[req ${reqId}] /api/alerts threshold not met for ${sample.id} ` +
      `(flood=${body.labels.flood_present} pop=${body.labels.populated_area_affected} ` +
      `quality_limited=${body.labels.image_quality_limited})`,
    );
    return c.json({
      ok: false,
      error: "threshold not met: requires flood_present && populated_area_affected && !image_quality_limited",
      labels: body.labels,
    }, 422);
  }

  console.log(
    `[req ${reqId}] /api/alerts publishing for ${sample.id} ` +
    `(${sample.region}/${sample.location_slug}, ${sample.lon}, ${sample.lat})`,
  );
  const record = await publishAlert({
    region: sample.region,
    location: sample.location_slug,
    location_label: sample.location_label,
    coordinates: { lon: sample.lon, lat: sample.lat },
    labels: body.labels,
    thumbnail_url: sample.thumbnail,
    source: { kind: "simulator", scenario_id: sample.id },
  });
  console.log(`[req ${reqId}] /api/alerts ✅ ${record.id} severity=${record.severity} qa=${record.recommended_qa_ids.length}`);
  return c.json({ ok: true, alert: record });
});

/** GET /api/alerts?region=la-mojana&since=<iso8601>&limit=N
 *  Polled by the Tauri desktop app every N minutes. */
app.get("/api/alerts", async (c) => {
  const reqId = c.get("reqId" as never) as number;
  const region = c.req.query("region") as AlertRecord["region"] | undefined;
  const since = c.req.query("since");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : undefined;

  console.log(`[req ${reqId}] /api/alerts list region=${region ?? "*"} since=${since ?? "—"} limit=${limit ?? 50}`);
  const result = await listAlerts({ region, since, limit });
  console.log(`[req ${reqId}] /api/alerts → ${result.alerts.length} alerts cursor=${result.cursor}`);
  return c.json(result);
});

app.get("/api/alerts/:id", async (c) => {
  const reqId = c.get("reqId" as never) as number;
  const id = c.req.param("id");
  const rec = await getAlert(id);
  if (!rec) {
    console.warn(`[req ${reqId}] /api/alerts/${id} not found`);
    return c.json({ ok: false, error: "alert not found" }, 404);
  }
  console.log(`[req ${reqId}] /api/alerts/${id} found severity=${rec.severity}`);
  return c.json({ ok: true, alert: rec });
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
  const reqId = c.get("reqId" as never) as number;
  let body: QaRequest;
  try { body = await c.req.json(); }
  catch { return c.json({ error: "JSON body required" }, 400); }

  const query = (body.query ?? body.q ?? "").trim();
  if (!query) return c.json({ error: "query is required" }, 400);

  const filters = [
    body.role && `role=${body.role}`,
    body.phase && `phase=${body.phase}`,
    body.region && `region=${body.region}`,
  ].filter(Boolean).join(" ");
  console.log(`[req ${reqId}] /api/qa q=${JSON.stringify(query.slice(0, 60))} ${filters || "(no filters)"}`);

  const t0 = performance.now();
  try {
    const matches = await qaSearch(query, {
      limit:         body.limit ?? body.k,
      minSimilarity: body.min_similarity,
      role:          body.role,
      phase:         body.phase,
      region:        body.region,
    });
    const ms = Math.round(performance.now() - t0);
    const top = matches[0];
    console.log(`[req ${reqId}] /api/qa → ${matches.length} matches in ${ms}ms top=${top?.id ?? "—"} sim=${top?.similarity.toFixed(3) ?? "—"}`);
    return c.json({ query, matches });
  } catch (err) {
    console.error(`[req ${reqId}] /api/qa error: ${err}`);
    return c.json({ error: String(err) }, 500);
  }
});

// ── /api/flood — 4-image satellite flood detection ────────────────────

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
  const reqId = c.get("reqId" as never) as number;
  let form: FormData;
  try { form = await c.req.formData(); }
  catch { return c.json({ ok: false, error: "multipart form required" }, 400); }

  const result = await readFloodFiles(form);
  if ("missing" in result) {
    console.warn(`[req ${reqId}] /api/flood missing fields: ${result.missing.join(",")}`);
    return c.json({ ok: false, error: `missing fields: ${result.missing.join(", ")}` }, 400);
  }
  const totalBytes = Object.values(result).reduce((n, b) => n + b.byteLength, 0);
  console.log(`[req ${reqId}] /api/flood images received: 4 PNGs, ${(totalBytes / 1024).toFixed(0)} KB total`);

  const out = await predictFlood(result);
  if (out.ok) {
    console.log(`[req ${reqId}] /api/flood → flood=${out.labels.flood_present} severity=${out.labels.flood_severity} ${out.latency_ms}ms`);
  } else {
    console.error(`[req ${reqId}] /api/flood error: ${out.error}`);
  }
  return c.json(out, out.ok ? 200 : 500);
});

// ── /api/chat — unified router ────────────────────────────────────────

app.post("/api/chat", async (c) => {
  const reqId = c.get("reqId" as never) as number;
  const ct = c.req.header("content-type") ?? "";

  if (ct.startsWith("multipart/form-data")) {
    let form: FormData;
    try { form = await c.req.formData(); }
    catch { return c.json({ kind: "error", error: "multipart parse failed" }, 400); }

    const parsed = await readFloodFiles(form);
    if ("missing" in parsed) {
      console.warn(`[req ${reqId}] /api/chat (flood) missing: ${parsed.missing.join(",")}`);
      return c.json({
        kind: "error",
        error: `flood detection needs 4 images (pre_rgb, pre_swir, cur_rgb, cur_swir); missing: ${parsed.missing.join(", ")}`,
      }, 400);
    }
    console.log(`[req ${reqId}] /api/chat → flood branch`);
    const result = await predictFlood(parsed);
    if (result.ok) {
      console.log(`[req ${reqId}] /api/chat (flood) → flood=${result.labels.flood_present} severity=${result.labels.flood_severity} ${result.latency_ms}ms`);
    } else {
      console.error(`[req ${reqId}] /api/chat (flood) error: ${result.error}`);
    }
    return c.json({ kind: "flood", ...result }, result.ok ? 200 : 500);
  }

  let body: { message?: string; role?: string; phase?: string; region?: string };
  try { body = await c.req.json(); }
  catch { return c.json({ kind: "error", error: "JSON body required" }, 400); }

  const text = (body.message ?? "").trim();
  if (!text) return c.json({ kind: "error", error: "message is required" }, 400);

  const filters = [body.role, body.phase, body.region].filter(Boolean).join("/");
  console.log(`[req ${reqId}] /api/chat → kb branch q=${JSON.stringify(text.slice(0, 60))} ${filters ? `[${filters}]` : ""}`);

  const t0 = performance.now();
  try {
    const matches = await qaSearch(text, {
      limit: 3,
      role: body.role, phase: body.phase, region: body.region,
    });
    const ms = Math.round(performance.now() - t0);
    const top = matches[0];
    console.log(`[req ${reqId}] /api/chat (kb) → ${matches.length} matches in ${ms}ms top=${top?.id ?? "—"} sim=${top?.similarity.toFixed(3) ?? "—"}`);
    return c.json({ kind: "qa", query: text, matches });
  } catch (err) {
    console.error(`[req ${reqId}] /api/chat (kb) error: ${err}`);
    return c.json({ kind: "error", error: String(err) }, 500);
  }
});

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

export default app;
