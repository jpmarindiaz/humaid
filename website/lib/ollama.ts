// Ollama runtime helper — used by the **KB side only** for Nomic embeddings.
//
// Two systems share this isolate:
//   - KB demo  (laptop-class)  → ollama daemon, this file
//   - Flood    (satellite-class) → llama-server, lib/llama.ts
//
// Adapted from `liquid-ai-in-space/deno-deploy-ollama/lib/ollama.ts`.
// Resolves the binary in this priority:
//   1. ./bin/ollama-linux-amd64        (bundled)
//   2. `ollama` on PATH                (local dev)
//   3. download to /tmp/ollama-bin/    (Deploy fallback)
//
// On first /api/qa, Nomic is pulled from registry.ollama.ai (~270 MB) into
// /tmp/ollama. Subsequent requests on the same isolate are cache hits.

const OLLAMA_VERSION = Deno.env.get("OLLAMA_VERSION") ?? "0.23.2";
const OLLAMA_DOWNLOAD_URL =
  `https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/ollama-linux-amd64.tar.zst`;

const OLLAMA_HOST = "127.0.0.1:11434";
const OLLAMA_BASE = `http://${OLLAMA_HOST}`;
const OLLAMA_MODELS_DIR = "/tmp/ollama";

const BUNDLED_BIN = new URL("../bin/ollama-linux-amd64", import.meta.url).pathname;

const ISOLATE_TAG = (() => {
  const id = Math.random().toString(36).slice(2, 8);
  console.log(`[ollama:iso ${id}] module loaded`);
  return id;
})();
const log = (msg: string) => console.log(`[ollama:iso ${ISOLATE_TAG}] ${msg}`);

let ollamaPath: string | null = null;
let serverProcess: Deno.ChildProcess | null = null;
let serverReady: Promise<void> | null = null;
const pulledModels = new Set<string>();
const pullPromises = new Map<string, Promise<void>>();

async function fileExists(path: string): Promise<boolean> {
  try { return (await Deno.stat(path)).isFile; }
  catch { return false; }
}

async function getOllamaPath(): Promise<string> {
  if (ollamaPath) return ollamaPath;
  if (await fileExists(BUNDLED_BIN)) {
    try { await Deno.chmod(BUNDLED_BIN, 0o755); } catch { /* read-only fs */ }
    ollamaPath = BUNDLED_BIN;
    log(`✅ bundled ollama at ${BUNDLED_BIN}`);
    return ollamaPath;
  }
  try {
    const out = await new Deno.Command("ollama", {
      args: ["--version"], stdout: "piped", stderr: "piped",
    }).output();
    if (out.success) {
      ollamaPath = "ollama";
      log(`✅ system ollama: ${new TextDecoder().decode(out.stdout).trim()}`);
      return ollamaPath;
    }
  } catch { /* not on PATH */ }

  const binDir = "/tmp/ollama-bin";
  const binPath = `${binDir}/bin/ollama`;
  if (await fileExists(binPath)) {
    ollamaPath = binPath;
    log(`✅ cached ollama at ${binPath}`);
    return ollamaPath;
  }

  log(`📥 downloading ollama ${OLLAMA_VERSION}...`);
  await Deno.mkdir(binDir, { recursive: true });
  const resp = await fetch(OLLAMA_DOWNLOAD_URL);
  if (!resp.ok) throw new Error(`ollama download failed: ${resp.status}`);
  const tarPath = `${binDir}/ollama.tar.zst`;
  const file = await Deno.open(tarPath, { write: true, create: true });
  await resp.body!.pipeTo(file.writable);
  const tarRes = await new Deno.Command("tar", {
    args: ["--zstd", "-xf", tarPath, "-C", binDir], stdout: "piped", stderr: "piped",
  }).output();
  if (!tarRes.success) {
    throw new Error(`tar failed: ${new TextDecoder().decode(tarRes.stderr)}`);
  }
  await Deno.chmod(binPath, 0o755);
  await Deno.remove(tarPath);
  ollamaPath = binPath;
  log(`✅ ollama ${OLLAMA_VERSION} ready at ${binPath}`);
  return ollamaPath;
}

async function isServerUp(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(500) });
    return r.ok;
  } catch { return false; }
}

async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerUp()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`ollama did not become ready within ${timeoutMs}ms`);
}

export function startOllamaServer(): Promise<void> {
  if (serverReady) return serverReady;
  serverReady = (async () => {
    if (await isServerUp()) { log("✅ ollama daemon already running"); return; }
    const bin = await getOllamaPath();
    await Deno.mkdir(OLLAMA_MODELS_DIR, { recursive: true });
    log(`🚀 spawning \`ollama serve\` (models at ${OLLAMA_MODELS_DIR})`);
    serverProcess = new Deno.Command(bin, {
      args: ["serve"],
      env: { OLLAMA_HOST, OLLAMA_MODELS: OLLAMA_MODELS_DIR, HOME: "/tmp" },
      stdout: "piped", stderr: "piped",
    }).spawn();

    (async () => {
      const reader = serverProcess!.stderr.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        Deno.stderr.writeSync(new TextEncoder().encode(`[ollama] ${decoder.decode(value)}`));
      }
    })().catch(() => {});

    (async () => {
      const reader = serverProcess!.stdout.getReader();
      while (true) { const { done } = await reader.read(); if (done) break; }
    })().catch(() => {});

    await waitForServer();
    log(`✅ ollama daemon ready on ${OLLAMA_BASE}`);
  })();
  return serverReady;
}

export async function ensureModel(name: string): Promise<void> {
  if (pulledModels.has(name)) return;
  const existing = pullPromises.get(name);
  if (existing) { await existing; return; }
  const p = (async () => {
    await startOllamaServer();
    const tagsResp = await fetch(`${OLLAMA_BASE}/api/tags`);
    const tags = await tagsResp.json();
    const tagNames: string[] = (tags.models ?? []).map((m: { name: string }) => m.name);
    if (tagNames.some((n) => n === name || n.startsWith(`${name}:`))) {
      pulledModels.add(name);
      return;
    }
    log(`📥 pulling ${name} from registry`);
    const resp = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, stream: false }),
    });
    if (!resp.ok) throw new Error(`pull ${name} failed (${resp.status}): ${await resp.text()}`);
    pulledModels.add(name);
    log(`✅ pulled ${name}`);
  })();
  pullPromises.set(name, p);
  try { await p; }
  finally { if (!pulledModels.has(name)) pullPromises.delete(name); }
}

export async function embedTexts(model: string, texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  await ensureModel(model);
  const resp = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!resp.ok) {
    throw new Error(`ollama embed failed (${resp.status}): ${(await resp.text()).slice(0, 300)}`);
  }
  const json = await resp.json() as { embeddings?: number[][] };
  if (!json.embeddings || json.embeddings.length !== texts.length) {
    throw new Error(`ollama embed returned ${json.embeddings?.length ?? 0} for ${texts.length}`);
  }
  return json.embeddings.map((e) => new Float32Array(e));
}

export async function listOllamaModels(): Promise<unknown> {
  await startOllamaServer();
  const r = await fetch(`${OLLAMA_BASE}/api/tags`);
  return await r.json();
}

export const ollamaConfig = {
  OLLAMA_VERSION, OLLAMA_BASE, OLLAMA_MODELS_DIR, BUNDLED_BIN,
};
