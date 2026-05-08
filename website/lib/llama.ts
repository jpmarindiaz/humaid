// llama-server runtime helper for Deno Deploy.
//
// Adapted verbatim from `liquid-ai-in-space/deno-deploy-llamacpp/lib/llama.ts`.
//
// We use llama.cpp's llama-server (not Ollama) because Ollama can't load the
// LFM2-VL multimodal projector cleanly — see `finetune-flood/docs/06-deploy-website.md`.
//
// Cold-start sequence per isolate:
//   1. Resolve binary: ./bin/llama-cpp/llama-server  →  system PATH  →  error
//   2. Spawn with -m <gguf> --mmproj <mmproj> --host 127.0.0.1 --port 8765
//   3. Poll /health until 200
//   4. Forward /v1/chat/completions to it

const LLAMA_PORT = 8765;
const LLAMA_HOST = "127.0.0.1";
const LLAMA_BASE = `http://${LLAMA_HOST}:${LLAMA_PORT}`;

const BUNDLED_LLAMA_DIR = new URL("../bin/llama-cpp/", import.meta.url).pathname;
const BUNDLED_SERVER_BIN = `${BUNDLED_LLAMA_DIR}llama-server`;
const BUNDLED_MODELS_DIR = new URL("../bin/models/", import.meta.url).pathname;

// Defaults assume the fine-tune is bundled. Override via env in dev / staging.
const MODEL_FILENAME = Deno.env.get("MODEL_FILENAME") ?? "lfm2-flood-Q4_0.gguf";
const MMPROJ_FILENAME = Deno.env.get("MMPROJ_FILENAME") ?? "mmproj-lfm2-flood-F16.gguf";

// 8192 is required for the 4-image flood input — each Sentinel-2 tile uses
// ~1000-1500 image tokens, 4 of them plus the ~1500-token system prompt
// exceeds the 2048 default and OOMs mid-inference.
const CTX_SIZE = Number(Deno.env.get("LLAMA_CTX") ?? "8192");
const N_THREADS = Number(Deno.env.get("LLAMA_THREADS") ?? "2");
const WAIT_TIMEOUT_MS = Number(Deno.env.get("LLAMA_WAIT_MS") ?? "180000");

const ISOLATE_ID = (() => {
  const id = Math.random().toString(36).slice(2, 8);
  console.log(`[iso ${id}] module loaded at ${new Date().toISOString()} pid=${Deno.pid}`);
  return id;
})();
const log = (msg: string) => console.log(`[iso ${ISOLATE_ID}] ${msg}`);

let serverProcess: Deno.ChildProcess | null = null;
let serverReady: Promise<void> | null = null;
let stderrTail = "";

async function fileExists(path: string): Promise<boolean> {
  try { return (await Deno.stat(path)).isFile; }
  catch { return false; }
}

interface ResolvedBinary { binPath: string; libDir: string | null; }

async function resolveBinary(): Promise<ResolvedBinary> {
  if (await fileExists(BUNDLED_SERVER_BIN)) {
    try { await Deno.chmod(BUNDLED_SERVER_BIN, 0o755); }
    catch { /* read-only fs is fine if already executable */ }
    log(`✅ using bundled llama-server at ${BUNDLED_SERVER_BIN}`);
    return { binPath: BUNDLED_SERVER_BIN, libDir: BUNDLED_LLAMA_DIR.replace(/\/$/, "") };
  }
  try {
    const out = await new Deno.Command("llama-server", {
      args: ["--version"], stdout: "piped", stderr: "piped",
    }).output();
    const text = new TextDecoder().decode(out.stdout) + new TextDecoder().decode(out.stderr);
    if (text.length > 0) {
      log(`✅ using system llama-server: ${text.split("\n")[0]}`);
      return { binPath: "llama-server", libDir: null };
    }
  } catch { /* not on PATH */ }
  throw new Error(
    "llama-server not found. Run `deno task fetch-binaries` (sets up bin/llama-cpp/) " +
      "or install via `brew install llama.cpp` for local dev.",
  );
}

async function isServerUp(): Promise<boolean> {
  try {
    const r = await fetch(`${LLAMA_BASE}/health`, { signal: AbortSignal.timeout(500) });
    return r.ok;
  } catch { return false; }
}

async function waitForServer(timeoutMs = WAIT_TIMEOUT_MS): Promise<void> {
  const start = Date.now();
  let nextHeartbeat = 5_000;
  while (Date.now() - start < timeoutMs) {
    if (await isServerUp()) {
      log(`✅ llama-server became ready after ${Math.round((Date.now() - start) / 1000)}s`);
      return;
    }
    if (serverProcess) {
      try {
        const st = await Promise.race([
          serverProcess.status,
          new Promise<null>((r) => setTimeout(() => r(null), 0)),
        ]);
        if (st !== null) {
          await new Promise((r) => setTimeout(r, 200));
          const tail = stderrTail.split("\n").slice(-30).join("\n").trim();
          throw new Error(
            `llama-server exited early (code=${(st as Deno.CommandStatus).code}, ` +
              `signal=${(st as Deno.CommandStatus).signal ?? "none"}).\n` +
              `--- last stderr/stdout ---\n${tail || "(empty)"}\n--- end ---`,
          );
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("llama-server exited")) throw err;
      }
    }
    const elapsed = Date.now() - start;
    if (elapsed > nextHeartbeat) {
      log(`… still waiting for llama-server (${Math.round(elapsed / 1000)}s elapsed)`);
      nextHeartbeat += 10_000;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`llama-server did not become ready within ${timeoutMs}ms`);
}

export function startLlamaServer(): Promise<void> {
  if (serverReady) return serverReady;
  serverReady = (async () => {
    if (await isServerUp()) {
      log(`✅ llama-server already running on ${LLAMA_BASE}`);
      return;
    }
    const { binPath, libDir } = await resolveBinary();
    const modelPath = `${BUNDLED_MODELS_DIR}${MODEL_FILENAME}`;
    const mmprojPath = `${BUNDLED_MODELS_DIR}${MMPROJ_FILENAME}`;
    if (!(await fileExists(modelPath))) {
      throw new Error(`model not found at ${modelPath}; run \`deno task fetch-binaries\``);
    }
    const haveMmproj = await fileExists(mmprojPath);

    const args = [
      "-m", modelPath,
      "--host", LLAMA_HOST,
      "--port", String(LLAMA_PORT),
      "-c", String(CTX_SIZE),
      "-t", String(N_THREADS),
    ];
    if (haveMmproj) {
      args.push("--mmproj", mmprojPath);
      log(`🖼️  vision enabled via ${MMPROJ_FILENAME}`);
    } else {
      log(`⚠️  no mmproj at ${mmprojPath} — text-only mode (flood route will fail)`);
    }

    log(`🚀 spawning ${binPath} ${args.join(" ")}`);
    const env: Record<string, string> = { HOME: "/tmp" };
    if (libDir) env.LD_LIBRARY_PATH = libDir;
    serverProcess = new Deno.Command(binPath, {
      args, env, stdout: "piped", stderr: "piped",
    }).spawn();
    stderrTail = "";

    (async () => {
      const reader = serverProcess!.stderr.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        stderrTail = (stderrTail + chunk).slice(-8192);
        Deno.stderr.writeSync(new TextEncoder().encode(`[llama] ${chunk}`));
      }
    })().catch(() => {});

    (async () => {
      const reader = serverProcess!.stdout.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        stderrTail = (stderrTail + decoder.decode(value)).slice(-8192);
      }
    })().catch(() => {});

    await waitForServer();
    log(`✅ llama-server ready on ${LLAMA_BASE}`);
  })();
  return serverReady;
}

// ── OpenAI-compatible proxy ────────────────────────────────────────────

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  response_format?: unknown;
}

export async function chatCompletions(req: ChatRequest): Promise<Response> {
  await startLlamaServer();
  return await fetch(`${LLAMA_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
}

export async function getModels(): Promise<unknown> {
  await startLlamaServer();
  const r = await fetch(`${LLAMA_BASE}/v1/models`);
  return await r.json();
}

export const config = {
  ISOLATE_ID, LLAMA_BASE, CTX_SIZE, N_THREADS,
  BUNDLED_LLAMA_DIR, BUNDLED_SERVER_BIN, BUNDLED_MODELS_DIR,
  MODEL_FILENAME, MMPROJ_FILENAME,
};

export function debugState() {
  return {
    isolate_id: ISOLATE_ID,
    pid: Deno.pid,
    llama_base: LLAMA_BASE,
    ctx_size: CTX_SIZE,
    n_threads: N_THREADS,
    server_started: serverReady !== null,
    server_pid: serverProcess?.pid ?? null,
    model: MODEL_FILENAME,
    mmproj: MMPROJ_FILENAME,
  };
}
