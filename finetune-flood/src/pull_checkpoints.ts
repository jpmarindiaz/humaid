// Pulls a finished training run from the Modal volume into ./outputs/.
// Usage:
//   deno task pull                    # list runs at the volume root
//   deno task pull --run <run-name>   # download that run (or a nested path)

import { parseArgs } from '@std/cli/parse-args'
import { ensureDir } from '@std/fs'

const args = parseArgs(Deno.args, {
  string: ['volume', 'run', 'remoteDir', 'localDir'],
  default: { volume: 'finetune-flood', remoteDir: '/', localDir: 'outputs' },
})

async function run(cmd: string[]) {
  console.log(`$ ${cmd.join(' ')}`)
  const p = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const { code } = await p.output()
  return code === 0
}

if (!args.run) {
  console.log(`Listing ${args.volume}:${args.remoteDir} (full names, no truncation)\n`)
  const p = new Deno.Command('modal', {
    args: ['volume', 'ls', '--json', args.volume, args.remoteDir],
    stdout: 'piped',
    stderr: 'inherit',
  })
  const { code, stdout } = await p.output()
  if (code !== 0) Deno.exit(code)
  const entries = JSON.parse(new TextDecoder().decode(stdout)) as Array<
    { Filename: string; Type: string; Size: string | number; 'Created/Modified'?: string }
  >
  for (const e of entries) {
    const tag = e.Type === 'dir' ? 'd' : 'f'
    console.log(`  ${tag}  ${e.Filename}`)
  }
  console.log(`\nUsage: deno task pull --run <run-name>`)
  console.log(`Tip: copy a name above (no truncation), then run the command.`)
  console.log(`Note: with full fine-tuning the merged weights live at the run root, not nested in a -lora_m- dir.`)
  Deno.exit(0)
}

await ensureDir(args.localDir)
const remotePath = args.remoteDir === '/'
  ? `/${args.run}`
  : `${args.remoteDir.replace(/\/$/, '')}/${args.run}`
const ok = await run([
  'modal',
  'volume',
  'get',
  '--force',
  args.volume,
  remotePath,
  args.localDir,
])
if (!ok) Deno.exit(1)
console.log(`\nCheckpoint at ${args.localDir}/${args.run}`)
