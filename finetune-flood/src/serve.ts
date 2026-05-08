// Convenience launcher for llama-server. Default: serve the fine-tuned
// model from outputs/ if package.ts has produced GGUFs there. Fallback:
// pull the base LFM2.5-VL-450M from HF for a baseline run.
//
// Usage:
//   deno task serve                              # auto-detect outputs/lfm2-flood-Q4_0.gguf
//   deno task serve --base                       # use base LFM2.5-VL-450M from HF
//   deno task serve --backbone <path> --mmproj <path> --port 8765
//
// Once running, point evaluate.ts at it:
//   deno task eval --raw data/raw/<run> --backend local --url http://localhost:8765 --model lfm2-flood

import { parseArgs } from '@std/cli/parse-args'

const args = parseArgs(Deno.args, {
  string: ['backbone', 'mmproj', 'port', 'ctx', 'threads', 'outDir', 'name'],
  boolean: ['base'],
  default: {
    port: '8765',
    ctx: '8192',
    threads: '4',
    outDir: 'outputs',
    name: 'lfm2-flood',
  },
})

async function exists(p: string): Promise<boolean> {
  try {
    await Deno.stat(p)
    return true
  } catch {
    return false
  }
}

async function commandExists(cmd: string): Promise<boolean> {
  const p = new Deno.Command('which', { args: [cmd], stdout: 'null', stderr: 'null' })
  const { code } = await p.output()
  return code === 0
}

if (!(await commandExists('llama-server'))) {
  console.error('✗ llama-server not on PATH. Install: brew install llama.cpp')
  Deno.exit(1)
}

let serverArgs: string[]

if (args.base) {
  // Pull the base model from HF — useful for baseline benchmarking.
  console.log('▶ Serving BASE LFM2.5-VL-450M (Q8_0 from HF)')
  serverArgs = [
    '-hf', 'LiquidAI/LFM2.5-VL-450M-GGUF:Q8_0',
    '--host', '127.0.0.1',
    '--port', args.port,
    '-c', args.ctx,
    '-t', args.threads,
  ]
} else {
  // Fine-tuned: explicit paths if given, else auto-detect.
  let backbone = args.backbone
  let mmproj = args.mmproj
  if (!backbone) {
    const candidates = [
      `${args.outDir}/${args.name}-Q4_0.gguf`,
      `${args.outDir}/${args.name}-Q5_K_M.gguf`,
      `${args.outDir}/${args.name}-Q8_0.gguf`,
    ]
    for (const c of candidates) {
      if (await exists(c)) {
        backbone = c
        break
      }
    }
  }
  if (!mmproj) {
    const candidates = [
      `${args.outDir}/mmproj-${args.name}-F16.gguf`,
    ]
    for (const c of candidates) {
      if (await exists(c)) {
        mmproj = c
        break
      }
    }
  }
  if (!backbone || !mmproj) {
    console.error(`✗ Could not auto-detect fine-tuned GGUFs in ${args.outDir}/.`)
    console.error(`  Looked for ${args.outDir}/${args.name}-{Q4_0,Q5_K_M,Q8_0}.gguf`)
    console.error(`  And ${args.outDir}/mmproj-${args.name}-F16.gguf`)
    console.error(`\n  Either run \`deno task package\` first, or pass --backbone and --mmproj explicitly,`)
    console.error(`  or use \`deno task serve --base\` to serve the unfine-tuned base model.`)
    Deno.exit(1)
  }
  console.log(`▶ Serving fine-tuned model`)
  console.log(`  backbone: ${backbone}`)
  console.log(`  mmproj:   ${mmproj}`)
  serverArgs = [
    '-m', backbone,
    '--mmproj', mmproj,
    '--host', '127.0.0.1',
    '--port', args.port,
    '-c', args.ctx,
    '-t', args.threads,
  ]
}

console.log(`▶ http://localhost:${args.port}/v1/chat/completions`)
console.log(`▶ Test:  deno task eval --raw <dir> --backend local --url http://localhost:${args.port} --model ${args.name}\n`)

const proc = new Deno.Command('llama-server', {
  args: serverArgs,
  stdout: 'inherit',
  stderr: 'inherit',
})
const child = proc.spawn()

// Forward Ctrl+C cleanly.
Deno.addSignalListener('SIGINT', () => {
  child.kill('SIGINT')
})

const status = await child.status
Deno.exit(status.code ?? 0)
