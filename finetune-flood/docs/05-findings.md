# 05 · Findings

## What we tried

End-to-end pipeline:

1. Cloned `simsat/` (Docker), brought it up locally
2. Curated 14 locations + 9 events grounded in `research/flood-tagging-and-reference-points.md`
3. Built a Deno/TS orchestration (mirror of `finetune-quixote` shape)
4. Implemented candidate-date sweep at Sentinel-2's revisit cadence + parallel probes + retry/backoff
5. Implemented pair-based labeling (vs Pau's single-tile) to handle La Mojana's chronic-wetland baseline
6. Labeled 115 pair samples via Claude Code agents
7. Ran Sonnet, Opus, and base LFM2.5-VL evals
8. Caught and fixed a "schema missing from prompt" bug that was crippling the base baseline
9. Decided not to fine-tune

## What worked

**The orchestration is reusable.** Every piece (SimSat client, candidate sweep, agent labeling, eval with two backends, dynamic per-run report) is generic to "VLM fine-tune for satellite-imagery classification." Drop in different `prompts.ts`, `locations.ts`, `events.ts` and you have a different domain pipeline.

**Pair input was the right call.** Single-tile labeling on La Mojana was 25–37% disagreement on `flood_present`. Pair input collapses the wetland-baseline ambiguity. Both labelers (Sonnet, Opus) agree on this part of the task at the expected level; the residual noise is in subjective enum fields (severity, water coverage), not in the binary "is there a flood".

**Cloud handling.** Candidate-sweep + parallel probes + abstention via `image_quality_limited` is the right pattern — we avoid the "hard-filter loses every wet-season tile" trap. ~75% of fetches yielded a usable lowest-cloud candidate.

**Schema injection in the local backend.** Going from 0.00 to 0.44 overall by giving the base model the schema it's supposed to emit is a real lesson: tool-use enforcement is not optional, and grammar-constrained JSON via llama.cpp's `response_format` should be the default.

**Dynamic per-run reports.** Each `evals/<ts>/report.md` shows accuracy + top mismatches per field + worst samples with image paths. Easy to debug "why did the model fail?" without writing extra tooling.

## What didn't work

**Sentinel-2 over La Mojana wet seasons.** ~50% of acquisitions are >50% cloud. The candidate-sweep recovers many, but for the May 2024 Cara de Gato breach (the most important event in our dataset) most of the "event" tiles are heavily clouded. The labels correctly say `image_quality_limited=true` but the underlying training signal is weak.

**Sentinel-2 acquisition gaps.** Mocoa 2017 had no usable pre-event Sentinel-2 acquisitions. We fetched a 2017-08-15 stand-in baseline; it's flagged in the annotation but it's not a true pre. For 2017-era events generally, Sentinel-2A coverage is spotty.

**The 0.66–0.68 noise floor is the real ceiling.** Sonnet (n=110) and Opus (n=30) self-consistency are within sampling noise of each other. The hardest fields are subjective enums:

| field | Opus oracle | Sonnet oracle | Why hard |
|---|--:|--:|---|
| `flood_severity` | 0.43 | 0.49 | Boundary calls between minor/moderate/severe are subjective |
| `water_coverage_pct_estimate` | 0.70 | 0.62 | Same — bucket boundaries are arbitrary |
| `populated_area_affected` | 0.73 | 0.69 | Depends on how "adjacent to water" is interpreted |

A student model fine-tuned on Opus labels can't exceed Opus self-consistency. So our practical fine-tune ceiling is ~0.66 overall. That's not enough for an alert system.

**Sentinel-2 cadence vs event timing.** The May 6, 2024 Cara de Gato breach: cloud-permitting Sentinel-2 acquisitions in that window were 2024-04-27 (9 days *before* the breach) and 2024-05-22 (16 days after, with 97% cloud). Our "event" tile for some locations is actually pre-event imagery. The labels are still correct ("water unchanged from baseline → no flood") but the data is useless for training a model to recognize the *event*.

## The case for stopping

1. **Optical alone isn't enough for La Mojana.** The CopernicusLAC operational pipeline uses Sentinel-1 SAR for exactly this region for exactly this reason. SAR sees through clouds. SimSat doesn't expose SAR. Switching data sources is a separate project.

2. **The labeler noise floor caps achievable accuracy.** Our schema's hardest fields (severity, water-coverage) have inter-labeler agreement of 0.43–0.70. The student can't exceed that.

3. **Sentinel-2 acquisition cadence misses the moments that matter.** When the breach happens, the next Sentinel-2 pass is 2–5 days later, often clouded. We end up training on tiles that are temporally adjacent to events but not capturing the event itself.

4. **Data volume is too small for full fine-tuning.** 115 pair samples is below the threshold where full FT (which Pau argued for over LoRA on satellite data) gives stable gains. Wildfire-prevention used ~860 train samples and saw 0.38 → 0.84. Our path requires either 5–10× more data or a less ambiguous schema.

## What would make this work

- **Sentinel-1 SAR data.** Cloud-independent, 6-day revisit, much better acquisition consistency. Requires a non-SimSat source (Copernicus Open Access Hub, Microsoft Planetary Computer, AWS Open Data). The pair structure and orchestration would all transfer.
- **Tighter schema.** Drop `flood_severity` and `water_coverage_pct_estimate` (the high-noise fields), keep the 5 booleans + `image_quality_limited`. Inter-labeler agreement on the booleans is 0.66–0.84 — the bool subset would have a higher achievable ceiling.
- **More events.** The 9 event anchors we used yield ~150 candidate windows. Operational quality needs 5–10×, ideally with regional diversity beyond Colombia.
- **Human-verified ground truth on a subset.** Calibrate the agent labelers against a few dozen expert-tagged tiles to anchor the calibration. Currently we have only labeler-vs-labeler agreement; with human ground truth we'd know where the labeler is systematically wrong.

## What's salvageable

The code. Every module in `src/` works as designed. For another VLM fine-tune project (different domain, possibly different data source), the orchestration changes only `prompts.ts`, `locations.ts`, `events.ts`, and the `simsat.ts` band selection. The candidate sweep, retry/catch, agent labeling, dual-backend evals, and dynamic reporting all transfer.

Specifically, for a Sentinel-1 SAR project: replace `simsat.ts` with a SAR-source HTTP client (Copernicus Open Access Hub or Microsoft Planetary Computer). The output bytes are still PNG (or convertible). Everything downstream stays the same.
