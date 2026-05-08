// Populate ./bin/ with everything the deployed isolate needs:
//
//   bin/ollama-linux-amd64                    (~50 MB)   for KB embeddings
//   bin/llama-cpp/llama-server + .so libs     (~150 MB)  for flood vision
//   bin/models/lfm2-flood-Q4_0.gguf           (~245 MB)  fine-tuned flood backbone
//   bin/models/mmproj-lfm2-flood-F16.gguf     (~189 MB)  vision tower
//
// Nomic (the KB embedder) is *not* bundled — it pulls from registry.ollama.ai
// on first use into /tmp/ollama (~270 MB). That's fine on Deploy and lets us
// keep the deploy artifact under 1 GB.
//
// Adapted from the templates in `liquid-ai-in-space/`.

const OLLAMA_VERSION = Deno.env.get("OLLAMA_VERSION") ?? "0.23.2";
const OLLAMA_ARCHIVE_URL =
  `https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/ollama-linux-amd64.tar.zst`;

const LLAMA_VERSION = Deno.env.get("LLAMA_VERSION") ?? "b9070";
const LLAMA_ARCHIVE_URL =
  `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-bin-ubuntu-x64.tar.gz`;

const MODEL_GGUF_URL = Deno.env.get("MODEL_GGUF_URL") ??
  "https://huggingface.co/jpmarindiaz/lfm2-flood/resolve/main/lfm2-flood-Q4_0.gguf";
const MODEL_FILENAME = Deno.env.get("MODEL_FILENAME") ??
  MODEL_GGUF_URL.split("/").pop()!.split("?")[0];

const MMPROJ_URL = Deno.env.get("MMPROJ_URL") ??
  "https://huggingface.co/jpmarindiaz/lfm2-flood/resolve/main/mmproj-lfm2-flood-F16.gguf";
const MMPROJ_FILENAME = Deno.env.get("MMPROJ_FILENAME") ??
  MMPROJ_URL.split("/").pop()!.split("?")[0];

const SKIP_OLLAMA = Deno.env.get("SKIP_OLLAMA") === "1";
const SKIP_LLAMA = Deno.env.get("SKIP_LLAMA") === "1";
const SKIP_MODEL = Deno.env.get("SKIP_MODEL") === "1";
const SKIP_MMPROJ = Deno.env.get("SKIP_MMPROJ") === "1";

const binDir = new URL("../bin/", import.meta.url).pathname;
const llamaDir = `${binDir}llama-cpp/`;
const modelsDir = `${binDir}models/`;
const stagingDir = `${binDir}.staging/`;

const ollamaBin = `${binDir}ollama-linux-amd64`;
const llamaServerBin = `${llamaDir}llama-server`;
const modelPath = `${modelsDir}${MODEL_FILENAME}`;
const mmprojPath = `${modelsDir}${MMPROJ_FILENAME}`;

async function exists(p: string): Promise<boolean> {
  try { await Deno.stat(p); return true; }
  catch { return false; }
}

async function downloadTo(url: string, dest: string, label: string): Promise<void> {
  console.log(`📥 ${label}: ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download failed: ${resp.status} ${resp.statusText}`);
  const total = Number(resp.headers.get("content-length") ?? 0);
  if (total) console.log(`   (${(total / 1e6).toFixed(1)} MB)`);
  const file = await Deno.open(dest, { write: true, create: true, truncate: true });
  await resp.body!.pipeTo(file.writable);
}

// ── 1. Ollama binary (KB-side, embeddings) ────────────────────────────

async function fetchOllama() {
  if (await exists(ollamaBin)) {
    const stat = await Deno.stat(ollamaBin);
    console.log(`✅ ${ollamaBin} (${(stat.size / 1e6).toFixed(1)} MB) — skipping`);
    return;
  }
  await Deno.mkdir(binDir, { recursive: true });
  await Deno.mkdir(stagingDir, { recursive: true });
  const archivePath = `${stagingDir}ollama.tar.zst`;
  await downloadTo(OLLAMA_ARCHIVE_URL, archivePath, `ollama ${OLLAMA_VERSION}`);
  const extracted = `${stagingDir}ollama/`;
  await Deno.mkdir(extracted, { recursive: true });
  const tarRes = await new Deno.Command("tar", {
    args: ["--zstd", "-xf", archivePath, "-C", extracted],
    stdout: "piped", stderr: "piped",
  }).output();
  if (!tarRes.success) throw new Error(`tar failed: ${new TextDecoder().decode(tarRes.stderr)}`);
  const inner = `${extracted}bin/ollama`;
  if (!(await exists(inner))) throw new Error(`expected ${inner} after extraction`);
  await Deno.rename(inner, ollamaBin);
  await Deno.chmod(ollamaBin, 0o755);
  await Deno.remove(extracted, { recursive: true });
  await Deno.remove(archivePath);
  const stat = await Deno.stat(ollamaBin);
  console.log(`✅ wrote ${ollamaBin} (${(stat.size / 1e6).toFixed(1)} MB)`);
}

// ── 2. llama.cpp binaries + shared libs (Flood-side, vision) ──────────

async function fetchLlamaCpp() {
  if (await exists(llamaServerBin)) {
    const stat = await Deno.stat(llamaServerBin);
    console.log(`✅ ${llamaServerBin} (${(stat.size / 1e6).toFixed(1)} MB) — skipping`);
    return;
  }
  await Deno.mkdir(binDir, { recursive: true });
  await Deno.mkdir(stagingDir, { recursive: true });
  const archivePath = `${stagingDir}llama-cpp.tar.gz`;
  await downloadTo(LLAMA_ARCHIVE_URL, archivePath, `llama.cpp ${LLAMA_VERSION}`);
  const tarRes = await new Deno.Command("tar", {
    args: ["-xzf", archivePath, "-C", stagingDir],
    stdout: "piped", stderr: "piped",
  }).output();
  if (!tarRes.success) throw new Error(`tar failed: ${new TextDecoder().decode(tarRes.stderr)}`);
  let extractedRoot: string | null = null;
  for await (const entry of Deno.readDir(stagingDir)) {
    if (entry.isDirectory && entry.name.startsWith("llama-")) {
      extractedRoot = `${stagingDir}${entry.name}`;
      break;
    }
  }
  if (!extractedRoot) throw new Error("no llama-* dir found in archive");
  await Deno.rename(extractedRoot, llamaDir.replace(/\/$/, ""));
  for await (const entry of Deno.readDir(llamaDir)) {
    if (entry.isFile && !entry.name.includes(".so") && !entry.name.endsWith(".txt") && entry.name !== "LICENSE") {
      try { await Deno.chmod(`${llamaDir}${entry.name}`, 0o755); } catch { /* ignore */ }
    }
  }
  await Deno.remove(stagingDir, { recursive: true });
  const stat = await Deno.stat(llamaServerBin);
  console.log(`✅ wrote ${llamaServerBin} (${(stat.size / 1e6).toFixed(1)} MB)`);
}

// ── 3. Fine-tuned flood model + multimodal projector ──────────────────

async function fetchModel() {
  await Deno.mkdir(modelsDir, { recursive: true });
  if (await exists(modelPath)) {
    const stat = await Deno.stat(modelPath);
    console.log(`✅ ${modelPath} (${(stat.size / 1e6).toFixed(1)} MB) — skipping`);
    return;
  }
  await downloadTo(MODEL_GGUF_URL, modelPath, `model ${MODEL_FILENAME}`);
  const stat = await Deno.stat(modelPath);
  console.log(`✅ wrote ${modelPath} (${(stat.size / 1e6).toFixed(1)} MB)`);
}

async function fetchMmproj() {
  await Deno.mkdir(modelsDir, { recursive: true });
  if (await exists(mmprojPath)) {
    const stat = await Deno.stat(mmprojPath);
    console.log(`✅ ${mmprojPath} (${(stat.size / 1e6).toFixed(1)} MB) — skipping`);
    return;
  }
  await downloadTo(MMPROJ_URL, mmprojPath, `mmproj ${MMPROJ_FILENAME}`);
  const stat = await Deno.stat(mmprojPath);
  console.log(`✅ wrote ${mmprojPath} (${(stat.size / 1e6).toFixed(1)} MB)`);
}

// ── main ──────────────────────────────────────────────────────────────

if (!SKIP_OLLAMA) await fetchOllama();
else console.log("⏭️  SKIP_OLLAMA=1");

if (!SKIP_LLAMA) await fetchLlamaCpp();
else console.log("⏭️  SKIP_LLAMA=1");

if (!SKIP_MODEL) await fetchModel();
else console.log("⏭️  SKIP_MODEL=1");

if (!SKIP_MMPROJ) await fetchMmproj();
else console.log("⏭️  SKIP_MMPROJ=1");

console.log("\n📦 bin/ contents:");
async function showTree(dir: string, indent = "  ") {
  const entries = [];
  for await (const e of Deno.readDir(dir)) entries.push(e);
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const p = `${dir}${e.name}`;
    const stat = await Deno.stat(p);
    if (stat.isDirectory) {
      console.log(`${indent}${e.name}/`);
      await showTree(`${p}/`, `${indent}  `);
    } else {
      console.log(`${indent}${e.name}  ${(stat.size / 1e6).toFixed(1)} MB`);
    }
  }
}
await showTree(binDir);
