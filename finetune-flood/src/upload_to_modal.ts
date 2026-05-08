// Pushes the built JSONLs and the image tree to a Modal volume so leap-finetune
// can read them on the GPU. The dataset JSONL references images by relative path
// (e.g. "images/<location>/<tile>/rgb.png"), so we mirror that tree on the volume.
//
// Requires the `modal` CLI (installed via `uv tool install modal` or pip).

import { parseArgs } from '@std/cli/parse-args'

const args = parseArgs(Deno.args, {
  string: ['volume', 'remoteDir', 'imagesDir'],
  default: {
    volume: 'finetune-flood',
    remoteDir: '/data',
    imagesDir: 'data/images',
  },
})

async function run(cmd: string[]): Promise<{ ok: boolean; out: string }> {
  console.log(`$ ${cmd.join(' ')}`)
  const p = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: 'piped',
    stderr: 'piped',
  })
  const { code, stdout, stderr } = await p.output()
  const out = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr)
  if (out.trim()) console.log(out)
  return { ok: code === 0, out }
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path)
    return true
  } catch {
    return false
  }
}

const create = await run(['modal', 'volume', 'create', args.volume])
if (!create.ok && !create.out.includes('already exists')) {
  console.error('Failed to create volume.')
  Deno.exit(1)
}

const jsonls = ['data/flood_train.jsonl', 'data/flood_eval.jsonl']
for (const f of jsonls) {
  if (!(await exists(f))) {
    console.error(`Missing ${f}. Run 'deno task build' first.`)
    Deno.exit(1)
  }
  const remote = `${args.remoteDir}/${f.split('/').pop()}`
  const r = await run(['modal', 'volume', 'put', '--force', args.volume, f, remote])
  if (!r.ok) {
    console.error(`Upload failed for ${f}.`)
    Deno.exit(1)
  }
}

if (!(await exists(args.imagesDir))) {
  console.error(`Missing images dir ${args.imagesDir}. Run 'deno task fetch' and 'deno task build' first.`)
  Deno.exit(1)
}
const remoteImages = `${args.remoteDir}/images`
const r = await run(['modal', 'volume', 'put', '--force', args.volume, args.imagesDir, remoteImages])
if (!r.ok) {
  console.error(`Image upload failed.`)
  Deno.exit(1)
}

console.log(`\nUploaded to volume '${args.volume}' under ${args.remoteDir}/`)
console.log(`Next: cd ../leap-finetune && uv run leap-finetune ../finetune-flood/configs/flood_modal.yaml`)
