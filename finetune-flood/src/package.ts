// Post-training pipeline: HF merged checkpoint → backbone GGUF + mmproj GGUF.
//
// Unlike the text-only quixote pipeline, this is a vision-language model: the
// vision tower + multimodal projector ("mmproj") must be packaged as a separate
// GGUF alongside the language-model backbone. llama.cpp's convert_hf_to_gguf.py
// does both:
//   - default invocation → backbone GGUF
//   - with --mmproj      → mmproj GGUF (always F16)
// We then quantize the backbone (default Q4_0) and leave the mmproj at F16 —
// the vision tower is small and quantizing it tends to hurt quality.
//
// Deployment: llama-server with both files (Ollama can't currently bundle the
// pair into a single Modelfile cleanly for LFM2-VL).
//
// Usage:
//   deno task package
//   deno task package --run <full-run-dir>
//   deno task package --quant Q5_K_M
//   deno task package --keepF16

import { parseArgs } from '@std/cli/parse-args'
import { join } from '@std/path'

const args = parseArgs(Deno.args, {
  string: ['run', 'name', 'quant', 'outDir'],
  boolean: ['keepF16', 'force'],
  default: {
    name: 'lfm2-flood',
    quant: 'Q4_0',
    outDir: 'outputs',
  },
})

async function findMergedRun(outDir: string, runArg?: string): Promise<string> {
  if (runArg) return runArg
  // Full fine-tune writes the merged model directly under the run dir, with no
  // -lora_m- suffix. Heuristic: pick the dir that contains config.json.
  const candidates: string[] = []
  for await (const e of Deno.readDir(outDir)) {
    if (!e.isDirectory) continue
    try {
      await Deno.stat(join(outDir, e.name, 'config.json'))
      candidates.push(e.name)
    } catch {
      // not a HF model dir — skip
    }
  }
  if (candidates.length === 0) {
    console.error(`✗ No HF model dir (with config.json) found in ${outDir}/.`)
    console.error(`  Pull one first:`)
    console.error(`    deno task pull                       # list runs on the volume`)
    console.error(`    deno task pull --run <run-name>      # download merged model`)
    Deno.exit(1)
  }
  if (candidates.length > 1) {
    console.error(`✗ Multiple model dirs in ${outDir}/:`)
    for (const c of candidates) console.error(`    ${c}`)
    console.error(`  Pass --run <name> to disambiguate.`)
    Deno.exit(1)
  }
  return candidates[0]
}

async function findConverter(): Promise<string> {
  const cellar = '/opt/homebrew/Cellar/llama.cpp'
  try {
    for await (const e of Deno.readDir(cellar)) {
      if (!e.isDirectory) continue
      const path = `${cellar}/${e.name}/bin/convert_hf_to_gguf.py`
      try {
        await Deno.stat(path)
        return path
      } catch {
        // try next version
      }
    }
  } catch {
    // cellar dir doesn't exist
  }
  console.error(`✗ convert_hf_to_gguf.py not found under ${cellar}/.`)
  console.error(`  Install: brew install llama.cpp`)
  Deno.exit(1)
}

async function commandExists(cmd: string): Promise<boolean> {
  const p = new Deno.Command('which', { args: [cmd], stdout: 'null', stderr: 'null' })
  const { code } = await p.output()
  return code === 0
}

async function run(cmd: string[]): Promise<void> {
  console.log(`$ ${cmd.join(' ')}`)
  const p = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const { code } = await p.output()
  if (code !== 0) {
    console.error(`✗ Command failed (exit ${code})`)
    Deno.exit(code)
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path)
    return true
  } catch {
    return false
  }
}

if (!(await commandExists('uv'))) {
  console.error('✗ uv is not on PATH. Install: brew install uv')
  Deno.exit(1)
}
if (!(await commandExists('llama-quantize'))) {
  console.error('✗ llama-quantize is not on PATH. Install: brew install llama.cpp')
  Deno.exit(1)
}

const runName = await findMergedRun(args.outDir, args.run)
const sourceDir = join(args.outDir, runName)
const f16Filename = `${args.name}-f16.gguf`
const quantFilename = `${args.name}-${args.quant}.gguf`
const mmprojFilename = `mmproj-${args.name}-F16.gguf`
const f16Path = join(args.outDir, f16Filename)
const quantPath = join(args.outDir, quantFilename)
const mmprojPath = join(args.outDir, mmprojFilename)

console.log(`▶ Source HF dir : ${sourceDir}`)
console.log(`▶ Backbone      : ${quantFilename}`)
console.log(`▶ mmproj        : ${mmprojFilename}`)
console.log(`▶ Quantization  : ${args.quant}`)

const converter = await findConverter()
const pyDeps = [
  '--with', 'transformers',
  '--with', 'torch',
  '--with', 'numpy',
  '--with', 'sentencepiece',
  '--with', 'safetensors',
  '--with', 'mistral-common',
  '--with', 'protobuf',
  '--with', 'gguf',
]

console.log('\n=== 1. Convert HF → backbone GGUF (f16) ===')
if (!args.force && (await exists(f16Path))) {
  console.log(`(reusing existing ${f16Path}; pass --force to rebuild)`)
} else {
  await run([
    'uv', 'run',
    ...pyDeps,
    'python3', converter,
    sourceDir,
    '--outfile', f16Path,
    '--outtype', 'f16',
  ])
}

console.log(`\n=== 2. Quantize backbone → ${args.quant} ===`)
if (!args.force && (await exists(quantPath))) {
  console.log(`(reusing existing ${quantPath}; pass --force to rebuild)`)
} else {
  await run(['llama-quantize', f16Path, quantPath, args.quant])
}

console.log('\n=== 3. Convert HF → mmproj GGUF (F16) ===')
if (!args.force && (await exists(mmprojPath))) {
  console.log(`(reusing existing ${mmprojPath}; pass --force to rebuild)`)
} else {
  // Upstream convert_hf_to_gguf.py --mmproj fails on leap-finetune's full-FT
  // merged checkpoints because they contain a top-level lm_head.weight that
  // the MmprojModel filter only catches via "language_model." prefix. Our
  // wrapper monkeypatches the LFM2VLModel filter to also drop lm_head.*.
  // See scripts/convert_mmproj_lfm2vl.py for the why.
  await run([
    'uv', 'run',
    ...pyDeps,
    'python3', 'scripts/convert_mmproj_lfm2vl.py',
    sourceDir,
    '--outfile', mmprojPath,
    '--outtype', 'f16',
    '--mmproj',
  ])
}

if (!args.keepF16) {
  console.log(`\nRemoving intermediate f16 backbone (${f16Path}); pass --keepF16 to keep it`)
  try {
    await Deno.remove(f16Path)
  } catch {
    // ignore
  }
}

console.log(`\n✓ Done. Run inference with llama-server:\n`)
console.log(
  `  llama-server \\\n` +
    `    -m ${quantPath} \\\n` +
    `    --mmproj ${mmprojPath} \\\n` +
    `    --port 8080`,
)
console.log(`\n  Then POST images + a prompt to http://localhost:8080/v1/chat/completions`)
console.log(`  (OpenAI-compatible API). The web UI at http://localhost:8080 also works.`)
