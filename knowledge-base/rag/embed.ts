// Nomic embeddings via local Ollama. 768-dim, multilingual.
//
// Ollama's /api/embed accepts a single string or an array; we always batch.
// No retry, no caching — fail fast and let the caller decide. The build
// script calls this once at index time; the search script calls it once per
// query.

const OLLAMA_URL = Deno.env.get('OLLAMA_URL') ?? 'http://localhost:11434'
const MODEL = Deno.env.get('NOMIC_MODEL') ?? 'nomic-embed-text'

export const EMBEDDING_DIM = 768

export async function embed(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return []
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: texts }),
  })
  if (!res.ok) {
    throw new Error(`Ollama embed failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  }
  const json = await res.json() as { embeddings?: number[][] }
  if (!json.embeddings || json.embeddings.length !== texts.length) {
    throw new Error(
      `Ollama returned ${json.embeddings?.length ?? 0} embeddings for ${texts.length} inputs`,
    )
  }
  return json.embeddings.map((e) => new Float32Array(e))
}
