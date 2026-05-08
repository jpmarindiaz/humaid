// Sanity-check the built dataset: print 3 random rows with truncated content.
import { parseArgs } from '@std/cli/parse-args'

const args = parseArgs(Deno.args, {
  string: ['file', 'count'],
  default: { file: 'data/flood_train.jsonl', count: '3' },
})

const text = await Deno.readTextFile(args.file)
const lines = text.split('\n').filter((l) => l.trim())
const n = Math.min(Number(args.count), lines.length)

console.log(`${args.file}: ${lines.length} rows. Showing ${n} random.\n`)
for (let i = 0; i < n; i++) {
  const idx = Math.floor(Math.random() * lines.length)
  const row = JSON.parse(lines[idx])
  console.log(`--- row ${idx} ---`)
  for (const m of row.messages) {
    const content = Array.isArray(m.content)
      ? m.content
        .map((c: { type: string; image?: string; text?: string }) =>
          c.type === 'image' ? `[image: ${c.image}]` : c.text
        )
        .join(' ')
      : m.content
    const truncated = content.length > 300 ? content.slice(0, 300) + '…' : content
    console.log(`${m.role}: ${truncated}`)
  }
  console.log()
}
