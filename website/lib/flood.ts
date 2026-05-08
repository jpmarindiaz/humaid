// Flood detection — 4-image OpenAI-compatible request to llama-server.
//
// Mirrors the reference implementation in `finetune-flood/app/server.ts`.
// Image order is fixed: pre_rgb, pre_swir, cur_rgb, cur_swir. Both grammar-
// constrained `response_format` AND the schema text in the user prompt
// are required — see `finetune-flood/docs/06-deploy-website.md`.

import { encodeBase64 } from "jsr:@std/encoding@^1.0.5/base64";
import { chatCompletions } from "./llama.ts";
import {
  FLOOD_LABEL_SCHEMA,
  SCHEMA_INSTRUCTION,
  SYSTEM_PROMPT,
  USER_PROMPT,
} from "./prompts.ts";

export interface FloodInput {
  preRgb: Uint8Array;
  preSwir: Uint8Array;
  curRgb: Uint8Array;
  curSwir: Uint8Array;
}

export interface FloodLabels {
  flood_present: boolean;
  flood_severity: "none" | "minor" | "moderate" | "severe";
  water_coverage_pct_estimate: "<10%" | "10-30%" | "30-60%" | ">60%";
  populated_area_affected: boolean;
  infrastructure_at_risk: boolean;
  river_overflow_visible: boolean;
  image_quality_limited: boolean;
}

export interface FloodResult {
  ok: true;
  labels: FloodLabels;
  latency_ms: number;
}

export interface FloodError {
  ok: false;
  error: string;
}

export async function predictFlood(images: FloodInput): Promise<FloodResult | FloodError> {
  const t0 = performance.now();

  const body = {
    model: "lfm2-flood",
    max_tokens: 1024,
    temperature: 0.0,
    response_format: {
      type: "json_schema" as const,
      json_schema: { name: "flood_assessment", strict: true, schema: FLOOD_LABEL_SCHEMA },
    },
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: [
          { type: "image_url" as const, image_url: { url: `data:image/png;base64,${encodeBase64(images.preRgb)}` } },
          { type: "image_url" as const, image_url: { url: `data:image/png;base64,${encodeBase64(images.preSwir)}` } },
          { type: "image_url" as const, image_url: { url: `data:image/png;base64,${encodeBase64(images.curRgb)}` } },
          { type: "image_url" as const, image_url: { url: `data:image/png;base64,${encodeBase64(images.curSwir)}` } },
          { type: "text" as const, text: `${USER_PROMPT}\n\n${SCHEMA_INSTRUCTION}` },
        ],
      },
    ],
  };

  let resp: Response;
  try {
    resp = await chatCompletions(body as never);
  } catch (err) {
    return { ok: false, error: `llama-server unreachable: ${(err as Error).message}` };
  }

  if (!resp.ok) {
    const text = (await resp.text()).slice(0, 500);
    return { ok: false, error: `llama-server ${resp.status}: ${text}` };
  }

  const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return { ok: false, error: `no JSON object in response: ${text.slice(0, 200)}` };
  }

  let labels: FloodLabels;
  try {
    labels = JSON.parse(match[0]) as FloodLabels;
  } catch (err) {
    return { ok: false, error: `JSON parse failed: ${(err as Error).message}` };
  }

  return {
    ok: true,
    labels,
    latency_ms: Math.round(performance.now() - t0),
  };
}
