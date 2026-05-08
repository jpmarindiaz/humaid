# 06 · Deploying the fine-tuned model on the website

Read this first if you're wiring the model into the public site.

> **Scope of this guide.** This is *only* about deploying the **flood-detection vision model** (the satellite-side AI system, runs on `llama-server`). humaid has a second AI system — the **knowledge-base assistant** that runs on responder laptops — and that one **does** use Ollama, by design (text-only LFM2 + `nomic-embed-text` embeddings, served through the local Ollama daemon at `localhost:11434`). When this guide says "don't use Ollama," it means *for the flood vision model*. Don't generalize that to the KB. See [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) Parts 1 and 2 for why the two systems use different runtimes.

## TL;DR — what to actually do

1. **Use `deno-deploy-llamacpp`** (the llama.cpp template), not `deno-deploy-ollama`. Ollama can't bundle the LFM2-VL multimodal projector cleanly; llama.cpp can.
2. **Point its `fetch_binaries.ts` at our fine-tuned model on the HuggingFace Hub** — set 4 env vars (URLs + filenames), the rest of the template is unchanged.
3. **Send 4 images per request** in `(baseline RGB, baseline SWIR, current RGB, current SWIR)` order, plus a system prompt + grammar-constrained `response_format`.

The published model is at:

- `https://huggingface.co/jpmarindiaz/lfm2-flood`

The fine-tuned GGUF + mmproj files are public there.

## What NOT to do

- ❌ **Don't fall back to qwen2.5vl** as a workaround. If the local LFM2.5-VL gives `"this model is missing data required for image input"`, that's because the local Ollama tag was pulled without the multimodal projector. The fix is to use the GGUF + mmproj from `jpmarindiaz/lfm2-flood`, not switch models.
- ❌ **Don't use Ollama for the *vision* model.** Ollama doesn't load LFM2-VL's `mmproj-*.gguf` cleanly (the second `FROM` in a Modelfile fails with `missing tensor 'output_norm'`). Use `llama-server` directly — that's what `deno-deploy-llamacpp` already does. (Reminder: this only applies to the flood vision model. The KB system does use Ollama — different stack, see scope note at the top.)
- ❌ **Don't use `LiquidAI/LFM2.5-VL-450M-GGUF`** (the base model). That's the un-fine-tuned LFM2-VL — it scores 0.44 on our eval and ~0.10 on `image_quality_limited`. We've published the fine-tune at `jpmarindiaz/lfm2-flood`. Same model class, same architecture, but post-fine-tune it scores 0.55 overall and 0.90 on the abstention field.
- ❌ **Don't omit the schema in the prompt**. Without `response_format: {type: "json_schema", ...}` and the schema text in the user prompt, the model will improvise key names like `tile_pair` instead of emitting our 7 fields. We learned this the hard way — see [`finetune-flood/PLAYBOOK.md`](../PLAYBOOK.md) gotcha #4.

## How to set it up in `deno-deploy-llamacpp`

The template already supports overriding the model URLs via env. You don't need to fork it — just set 4 vars before running `deno task fetch-binaries`:

```bash
# in deno-deploy-llamacpp/

# our fine-tuned backbone (Q4_0, ~245 MB)
export MODEL_GGUF_URL="https://huggingface.co/jpmarindiaz/lfm2-flood/resolve/main/lfm2-flood-Q4_0.gguf"
export MODEL_FILENAME="lfm2-flood-Q4_0.gguf"

# our fine-tuned vision tower (F16, ~189 MB)
export MMPROJ_URL="https://huggingface.co/jpmarindiaz/lfm2-flood/resolve/main/mmproj-lfm2-flood-F16.gguf"
export MMPROJ_FILENAME="mmproj-lfm2-flood-F16.gguf"

deno task fetch-binaries          # pulls llama.cpp Linux binaries + our GGUFs into bin/
deno task build:css
deno task build:client
deno task start
```

For Deno Deploy, set those four env vars in the project's environment settings before pushing — the build step picks them up.

`lib/llama.ts` already reads `MODEL_FILENAME` and `MMPROJ_FILENAME` (lines 25–26 in the upstream template) and spawns `llama-server -m {model} --mmproj {mmproj} -c 8192 …`. No code changes needed there.

The context window: **set `LLAMA_CTX=8192`** for our 4-image input. Each Sentinel-2 tile takes ~1000–1500 image tokens; 4 of them plus a 1500-token system prompt blows past 2048. Default of 2048 will OOM mid-inference.

## The flood-detection request shape

This is the non-negotiable part. The model will return garbage if any of these are wrong:

### 1. Four images, in this order

```
content: [
  {type: "image_url", image_url: {url: "data:image/png;base64,<RGB-baseline>"}},
  {type: "image_url", image_url: {url: "data:image/png;base64,<SWIR-baseline>"}},
  {type: "image_url", image_url: {url: "data:image/png;base64,<RGB-current>"}},
  {type: "image_url", image_url: {url: "data:image/png;base64,<SWIR-current>"}},
  {type: "text",      text: "<USER_PROMPT + SCHEMA_INSTRUCTION>"},
]
```

### 2. The system prompt from `prompts.ts`

Lives at [`finetune-flood/src/prompts.ts:SYSTEM_PROMPT`](../src/prompts.ts). ~1500 tokens of calibration rules. Includes:
- Color semantics for RGB and SWIR false-color views
- Change-detection rules ("water on land in current that was dry in baseline = flooding")
- Severity bands anchored on land-area percentages
- Regional context for La Mojana / Putumayo

If you're sending requests from JS/TS, import it directly from `finetune-flood/src/prompts.ts`. Don't re-author it.

### 3. Grammar-constrained JSON

```ts
response_format: {
  type: "json_schema",
  json_schema: {
    name: "flood_assessment",
    strict: true,
    schema: FLOOD_LABEL_SCHEMA,    // also from prompts.ts
  },
}
```

Plus the schema as text in the user prompt as a belt-and-suspenders fallback for runtimes that don't honor `response_format`. Both layers together is what gets the local model from 0.00 → 0.44 baseline.

### 4. Output

The model returns this JSON:

```json
{
  "flood_present": true,
  "flood_severity": "moderate",
  "water_coverage_pct_estimate": "30-60%",
  "populated_area_affected": true,
  "infrastructure_at_risk": true,
  "river_overflow_visible": true,
  "image_quality_limited": false
}
```

7 fields, exact-match enums for the strings, booleans for the rest. `image_quality_limited=true` is the abstention signal — the UI should treat the other fields as low-confidence when it's set.

## Drop-in route handler

Copy this verbatim into `main.tsx` of the deno-deploy-llamacpp clone. It mirrors what's in [`finetune-flood/app/server.ts`](../app/server.ts) but uses the template's `chatCompletions` helper:

```tsx
import { Hono } from "hono";
import { chatCompletions } from "./lib/llama.ts";
import { encodeBase64 } from "@std/encoding/base64";

// Bring these from finetune-flood/src/prompts.ts — copy the file or
// import via a relative path / npm dep.
import { FLOOD_LABEL_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from "./flood/prompts.ts";

const SCHEMA_INSTRUCTION = `You MUST output a single JSON object with exactly these 7 keys, no additional keys, no prose:
  flood_present: boolean
  flood_severity: one of "none" | "minor" | "moderate" | "severe"
  water_coverage_pct_estimate: one of "<10%" | "10-30%" | "30-60%" | ">60%"
  populated_area_affected: boolean
  infrastructure_at_risk: boolean
  river_overflow_visible: boolean
  image_quality_limited: boolean`;

const app = new Hono();

// POST /flood
//   multipart form with 4 PNG files: pre_rgb, pre_swir, cur_rgb, cur_swir
//   returns: {ok, labels, latency_ms} | {ok: false, error}
app.post("/flood", async (c) => {
  const form = await c.req.formData();
  const fields = ["pre_rgb", "pre_swir", "cur_rgb", "cur_swir"] as const;
  const images: Record<typeof fields[number], string> = {} as never;
  for (const f of fields) {
    const file = form.get(f);
    if (!(file instanceof File)) {
      return c.json({ ok: false, error: `missing field "${f}"` }, 400);
    }
    images[f] = encodeBase64(new Uint8Array(await file.arrayBuffer()));
  }

  const body = {
    model: "lfm2-flood",                     // must match what llama-server reports
    max_tokens: 1024,
    temperature: 0.0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "flood_assessment",
        strict: true,
        schema: FLOOD_LABEL_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/png;base64,${images.pre_rgb}` } },
          { type: "image_url", image_url: { url: `data:image/png;base64,${images.pre_swir}` } },
          { type: "image_url", image_url: { url: `data:image/png;base64,${images.cur_rgb}` } },
          { type: "image_url", image_url: { url: `data:image/png;base64,${images.cur_swir}` } },
          { type: "text", text: `${USER_PROMPT}\n\n${SCHEMA_INSTRUCTION}` },
        ],
      },
    ],
  };

  const t0 = performance.now();
  const resp = await chatCompletions(body as never);    // proxies to local llama-server
  const json = await resp.json();
  const text = json.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return c.json({ ok: false, error: `no JSON in response: ${text.slice(0, 200)}` }, 500);
  }
  return c.json({
    ok: true,
    labels: JSON.parse(match[0]),
    latency_ms: Math.round(performance.now() - t0),
  });
});

export default app;
```

That's it. ~70 lines. The `chatCompletions` helper from `lib/llama.ts` already lazily spawns `llama-server` on first request and proxies through.

## Test from `curl`

```bash
curl -X POST http://localhost:8000/flood \
  -F pre_rgb=@finetune-flood/data/raw/20260508_070216/san_jacinto_del_cauca/cara_de_gato_2024_pre/rgb.png \
  -F pre_swir=@finetune-flood/data/raw/20260508_070216/san_jacinto_del_cauca/cara_de_gato_2024_pre/swir.png \
  -F cur_rgb=@finetune-flood/data/raw/20260508_070216/san_jacinto_del_cauca/cara_de_gato_2024_event/rgb.png \
  -F cur_swir=@finetune-flood/data/raw/20260508_070216/san_jacinto_del_cauca/cara_de_gato_2024_event/swir.png
```

Expected output: a JSON object with `flood_present: true, flood_severity: "moderate"` (the breach municipality during the May 2024 Cara de Gato event).

## A pre-existing reference implementation

`finetune-flood/app/server.ts` is a self-contained ~500-line Hono app that does exactly the same thing. It connects to a local llama-server at `localhost:8765` instead of spawning one (because in dev we run `deno task serve` separately) — so the wire format is identical to what you'd send from the website route.

You can run it locally to confirm the contract:

```bash
# in finetune-flood/, three terminals:
docker compose --env-file ../.env up -d   # in simsat/
deno task serve                            # llama-server with our fine-tuned GGUFs
deno task app                              # http://localhost:8081
```

Then the website's `/flood` route sends the same JSON body to the same OpenAI-compatible endpoint. Identical contract.

## Local dev for the website team

If you want to test the website's `/flood` route against a real model without deploying:

```bash
# Option A — point at the published HF model, fetch into bin/ via env vars
cd deno-deploy-llamacpp
MODEL_GGUF_URL="https://huggingface.co/jpmarindiaz/lfm2-flood/resolve/main/lfm2-flood-Q4_0.gguf" \
MODEL_FILENAME="lfm2-flood-Q4_0.gguf" \
MMPROJ_URL="https://huggingface.co/jpmarindiaz/lfm2-flood/resolve/main/mmproj-lfm2-flood-F16.gguf" \
MMPROJ_FILENAME="mmproj-lfm2-flood-F16.gguf" \
deno task fetch-binaries
deno task start

# Option B — use the local checkout if you have one
cp /path/to/humaid/finetune-flood/outputs/lfm2-flood-Q4_0.gguf bin/models/
cp /path/to/humaid/finetune-flood/outputs/mmproj-lfm2-flood-F16.gguf bin/models/
MODEL_FILENAME=lfm2-flood-Q4_0.gguf MMPROJ_FILENAME=mmproj-lfm2-flood-F16.gguf \
LLAMA_CTX=8192 \
deno task start
```

Either way: the local Ollama install is **not used by the flood-detection route**. Don't mix `ollama run jpmarindiaz/lfm2.5-vl-450m` with this setup — the Ollama tag we published is text-only (Ollama can't load the mmproj). For vision, use the GGUF + mmproj pair via llama-server, which is what `deno-deploy-llamacpp` already does.

(If your dev box also runs the KB assistant, that's a separate Ollama process on the same daemon serving `lfm2` + `nomic-embed-text` at `localhost:11434` — it can coexist with `llama-server` on a different port. The two systems just don't share a runtime.)

## Sample images for testing

The repo bundles 110 labeled pair samples in `finetune-flood/data/raw/`. Each tile dir has `rgb.png`, `swir.png`, `capture_metadata.json`, and `annotation.json` (the ground-truth labels we trained on). Pick any matching `(<location>/<event>_pre, <location>/<event>_event)` pair to test.

Notable test cases:

| pair | expected behavior |
|---|---|
| `san_jacinto_del_cauca/cara_de_gato_2024_pre` → `…_event` | flood_present=true, severity=moderate, river_overflow_visible=true (the breach municipality during the May 2024 dike failure) |
| `mocoa/mocoa_avalancha_2017_pre` → `…_event` | severe flood, populated area affected (the 2017 avalancha torrencial) |
| `san_marcos/cara_de_gato_2021_pre` → `…_event` | flood_present=false (chronic wetland, not changed) — model should NOT call this a flood |

The full ground-truth labels are in `data/raw/<run>/<location>/<event>_<window>/annotation.json` for every pair.

## When something goes wrong

| symptom | likely cause |
|---|---|
| Model says `"this model is missing data required for image input"` | mmproj wasn't loaded. Check `--mmproj` flag is being passed and the file exists in `bin/models/`. |
| Model returns valid JSON but with keys like `tile_pair`, `current_window`, `swir_baseline` | Schema not injected into the prompt. Add the `SCHEMA_INSTRUCTION` text to the user message **and** include `response_format: {type: "json_schema", ...}`. |
| llama-server OOM mid-request | `LLAMA_CTX` too small. 4 images × ~1000–1500 image tokens = ~4–6k tokens of input. Set `LLAMA_CTX=8192`. |
| Latency >5 seconds | Either the context window is being shifted (too small ctx) or you're on `cpu-basic` Deploy hardware. The model itself runs ~0.5s on a laptop. |
| Returns garbage / weird tokens | You're using the *base* GGUF (`LiquidAI/LFM2.5-VL-450M-GGUF`), not the fine-tune. Check `MODEL_GGUF_URL` actually points at `jpmarindiaz/lfm2-flood`. |

## Reference

- Project README — [`../README.md`](../README.md)
- The wrap-up findings (why the model is paused) — [`../REPORT.md`](../REPORT.md)
- The full fine-tune playbook — [`../PLAYBOOK.md`](../PLAYBOOK.md)
- The reference Hono app — [`../app/server.ts`](../app/server.ts)
- The schema + prompts — [`../src/prompts.ts`](../src/prompts.ts)
- Eval results comparing fine-tuned vs base vs oracle — [`../evals/_compare_20260508_140208/report.md`](../evals/_compare_20260508_140208/report.md)
