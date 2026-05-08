# 03 · Labeling

## Why pairs (and not single tiles)

Pau's wildfire example labels single tiles independently — RGB + SWIR for one timestamp → JSON risk. That works for fire because risk factors (dry vegetation, urban interface, steep terrain) are properties of *now*.

Floods are different. **A town in the middle of a chronic ciénaga (La Mojana baseline) looks identical to a flooded town** in a single tile. The visible water signature is the same. Single-tile labelers either consistently call wetlands "moderate flood" (false positive) or consistently say "no flood" (false negative).

We saw this empirically in early experiments: same prompt, two labeler runs on the same single tile, ~25–37% disagreement on `flood_present` for La Mojana wetland tiles. Adding pre-event baseline as part of the input collapses that ambiguity — the labeler can compare and (correctly) conclude "the dark water shape didn't change → not flooded".

## Schema (7 fields)

In `src/prompts.ts`. JSON-Schema style:

```json
{
  "flood_present":               <boolean>,
  "flood_severity":              "none" | "minor" | "moderate" | "severe",
  "water_coverage_pct_estimate": "<10%" | "10-30%" | "30-60%" | ">60%",
  "populated_area_affected":     <boolean>,
  "infrastructure_at_risk":      <boolean>,
  "river_overflow_visible":      <boolean>,
  "image_quality_limited":       <boolean>
}
```

Severity is anchored on the *fraction of land newly inundated relative to baseline*:
- `none`: 0%
- `minor`: <5%
- `moderate`: 5–20%
- `severe`: >20%

The `image_quality_limited` flag is the abstention mechanism — when clouds, snow, or partial coverage make assessment uncertain, the labeler sets it true and chooses conservative severity.

The full system prompt is in `src/prompts.ts:SYSTEM_PROMPT`. It includes:
- Image semantics (RGB vs SWIR colors)
- Change-detection rules ("water on land in current that was dry in baseline = flooding")
- Severity calibration
- Quality rules
- Regional context (La Mojana wetland baseline + Putumayo lowland river floodplains)

## Why Claude Code agents

Initially we planned direct Anthropic API calls in `generate.ts`'s label step. We pivoted to Claude Code agent dispatch for the labeling pass:

- **Cost flows through Claude Code subscription**, not Anthropic API budget — useful for development/iteration when re-labeling after schema changes.
- **No env management** — the agents inherit the conversation's auth.
- **Parallel by default** — dispatching 5 agents simultaneously from the conversation is a single tool call.
- **Visible reasoning** — each agent reports back what it labeled, so the human supervisor can sanity-check the calls.

The pattern:

1. `deno task label:manifest --raw <run-dir> --mode pairs` — scans for unlabeled (pre, current) pairs, writes `data/raw/<run>/label_manifest.json`.
2. `deno run -A src/agent_prompt_section.ts --manifest <path>` — prints the per-pair section ready to paste into an Agent prompt.
3. The conversation dispatches agents in parallel via the Agent tool. Each agent gets:
   - The system prompt body (calibration rules, region context, event context)
   - The output schema (verbatim JSON shape)
   - The list of pairs in its slice with absolute paths
   - Instructions to use only Read + Write tools
4. Each agent reads the 4 PNGs + 2 capture_metadata.json files, applies the rules, writes `annotation.json` to the *current* tile's directory.

`annotation.json` shape (per pair):

```json
{
  "location_id": "san_jacinto_del_cauca",
  "location_name": "San Jacinto del Cauca, Bolívar",
  "lon": -74.7167,
  "lat": 8.25,
  "event_id": "cara_de_gato_2024",
  "window_kind": "event",
  "selected_date": "2024-05-07",
  "selected_timestamp": "2024-05-07T12:00:00Z",
  "capture_datetime": "2024-04-27T15:30:49Z",
  "cloud_cover": 41.67,
  "source": "sentinel-2a",
  "candidates_tried": [...],
  "baseline": {
    "tile_dir": "/abs/path/to/cara_de_gato_2024_pre",
    "selected_date": "2024-04-19",
    "capture_datetime": "2024-04-17T15:30:49Z",
    "cloud_cover": 94.96
  },
  "labels": {
    "flood_present": true,
    "flood_severity": "moderate",
    "water_coverage_pct_estimate": "30-60%",
    "populated_area_affected": true,
    "infrastructure_at_risk": true,
    "river_overflow_visible": true,
    "image_quality_limited": true
  }
}
```

Note the `baseline` field — every pair annotation references its baseline tile dir. This lets `evaluate.ts` reconstruct the 4-image input later.

## The Mocoa special case

Sentinel-2A launched in 2015-06 but its acquisition plan over Mocoa in early 2017 had gaps. None of the 4 candidate dates in the pre window (2017-03-04, 03-09, 03-12, 03-18) returned `image_available: true`. We manually fetched a 2017-08-15 tile (15% cloud, full coverage) and used it as a stand-in baseline. The annotation includes a `note` field flagging this is non-standard.

The agent prompt for Mocoa explicitly explains the situation: "the baseline shows post-recovery state because Sentinel-2 had no usable pre-event captures" — this gives the labeler the right framing. The labels for the event tile (2017-04-04, 3 days post-avalancha) correctly flag `severe avalancha` with sediment-scarred channels visible.

## Idempotency

`label_agents.ts` only emits unlabeled pairs (skips pairs that already have `annotation.json`). Re-running the manifest after a partial agent batch only includes the un-finished pairs.

## When to use Anthropic API instead

For production labeling at 1000+ tiles, switch to `evaluate.ts:anthropicBackend()` (which uses `tool_use` to enforce the schema). The agent path is for iteration and ~100s of tiles.
