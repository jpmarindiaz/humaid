// Idempotent Vite starter — used as Tauri's `beforeDevCommand` so multiple
// `tauri dev` sessions (desktop + android, simultaneously) share a single
// Vite instance instead of fighting over port 1420.
//
// Behaviour:
//   - Vite already up → exit 0 immediately (Tauri proceeds straight to cargo).
//   - Vite not running → spawn it inheriting stdio; block until Vite exits.
//     Tauri's "wait for dev server" loop will see the port come up shortly
//     after and proceed in parallel.

const PORT = 1420;
const URL = `http://localhost:${PORT}/`;

async function isUp(): Promise<boolean> {
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(800) });
    return r.status < 500;
  } catch {
    return false;
  }
}

if (await isUp()) {
  console.log(`[dev-or-skip] vite already on :${PORT}, reusing`);
  Deno.exit(0);
}

console.log(`[dev-or-skip] vite not running on :${PORT}, starting`);
const cmd = new Deno.Command("deno", {
  args: ["run", "-A", "npm:vite@^7"],
  stdout: "inherit",
  stderr: "inherit",
});
const child = cmd.spawn();

// Forward Ctrl+C and SIGTERM to the Vite child so kill(parent) cleans up.
const forward = (sig: Deno.Signal) => {
  try { child.kill(sig); } catch { /* already gone */ }
};
Deno.addSignalListener("SIGINT", () => forward("SIGINT"));
Deno.addSignalListener("SIGTERM", () => forward("SIGTERM"));

const status = await child.status;
Deno.exit(status.code ?? 0);
