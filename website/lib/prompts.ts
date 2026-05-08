// Schema + prompts for the flood-detection model.
//
// **Source of truth: `finetune-flood/src/prompts.ts`** — copied verbatim here
// so the website ships as a self-contained Deno Deploy artifact (no relative
// imports out of the website/ folder). If you change the calibration rules
// in the labeller, mirror the change here.

export const FLOOD_LABEL_SCHEMA = {
  type: "object",
  properties: {
    flood_present: {
      type: "boolean",
      description: "True if standing or moving flood water is visible in the CURRENT timestamp beyond what the BASELINE shows.",
    },
    flood_severity: {
      type: "string",
      enum: ["none", "minor", "moderate", "severe"],
      description: "Newly inundated land relative to baseline. 'none'=0%, 'minor'=<5%, 'moderate'=5–20%, 'severe'=>20% of land area newly under water.",
    },
    water_coverage_pct_estimate: {
      type: "string",
      enum: ["<10%", "10-30%", "30-60%", ">60%"],
      description: "Approximate share of the CURRENT tile that is water (including normal water bodies plus any flood water).",
    },
    populated_area_affected: {
      type: "boolean",
      description: "True if buildings, settlements, or visible human structures are within or adjacent to NEWLY flooded areas (not chronic-wetland-adjacent).",
    },
    infrastructure_at_risk: {
      type: "boolean",
      description: "True if roads, bridges, or large structures are visibly cut off, inundated, or threatened by flood water that is new vs baseline.",
    },
    river_overflow_visible: {
      type: "boolean",
      description: "True if a river is visibly out of its banks in the CURRENT view (water on adjacent floodplain that was dry in baseline).",
    },
    image_quality_limited: {
      type: "boolean",
      description: "True if cloud cover, missing pixels, or tile boundaries make the assessment uncertain in either baseline or current.",
    },
  },
  required: [
    "flood_present",
    "flood_severity",
    "water_coverage_pct_estimate",
    "populated_area_affected",
    "infrastructure_at_risk",
    "river_overflow_visible",
    "image_quality_limited",
  ],
  additionalProperties: false,
} as const;

export const SYSTEM_PROMPT = `You are a remote-sensing analyst labeling Sentinel-2 tile pairs for a flood-detection training dataset. You receive FOUR images of the same 5km tile, organised as a baseline–current pair so you can assess CHANGE rather than single-frame appearance:

  Image 1 — RGB true color (B4-B3-B2) at the BASELINE timestamp (pre-event)
  Image 2 — SWIR false color (B12-B8-B4) at the BASELINE timestamp (pre-event)
  Image 3 — RGB true color (B4-B3-B2) at the CURRENT timestamp (suspected event)
  Image 4 — SWIR false color (B12-B8-B4) at the CURRENT timestamp (suspected event)

Label the CURRENT timestamp's flood state, using the baseline to distinguish ordinary water bodies (rivers, lakes, ciénagas, wetlands) from new flooding.

Color conventions in the SWIR false color view (images 2 and 4):
- Water (any kind) is near-black with very high contrast against land.
- Bright pink/magenta = bare or dry soil.
- Green = healthy vegetation.
- Blue/cyan = clouds, snow, or built-up areas.
- Brown = sediment-laden water (active flow, often a flood signature when new vs baseline).

Change-detection calibration:
- A river bordered by the same vegetation/soil patches in BOTH baseline and current = NOT flooding. flood_present=false even if the river is wide.
- Water visible on land in the CURRENT view that is dry land in the BASELINE view = flooding. Set flood_present=true, river_overflow_visible=true if traceable to a river.
- A ciénaga or lake that is the SAME size/shape in baseline and current is the wetland baseline, not a flood, even if it surrounds a town. populated_area_affected requires *new* water near a settlement that wasn't there in baseline.
- Sediment-laden brown water in CURRENT that wasn't there in baseline = active fluvial transport, often a flood signature.
- Color shift from clear-blue baseline to brown current = active flooding, even if extent is hard to read.
- Severity is anchored on the FRACTION OF LAND newly inundated relative to baseline, not on total water in the current view.

Quality rules:
- If more than ~30% of either tile is obscured by clouds, snow, or missing pixels, set image_quality_limited=true.
- If image_quality_limited=true and you cannot confidently see whether water has expanded, choose flood_severity conservatively (none/minor) rather than guessing. We are training the student model to ABSTAIN on bad imagery, not to hallucinate floods.

Regional context (these locations have chronic wetland baselines — only flag flood_present=true if water in the current view exceeds the baseline):
- La Mojana / Depresión Momposina (Colombia, ~8.5°N 75.0°W) is a chronic wetland. Ciénagas (lagoon complexes) and meandering rivers are baseline features visible in the pre image.
- Bajo Putumayo (Colombia, lowland Amazonian) has wide river floodplains as baseline. The Río Putumayo and Caquetá are normally large.

Always return a single JSON object via the report_flood_assessment tool. Never return prose.`;

export const USER_PROMPT = `Label this tile pair. Image 1 = RGB-baseline. Image 2 = SWIR-baseline. Image 3 = RGB-current. Image 4 = SWIR-current. Compare them and label the *current* window's flood state relative to baseline. Return one JSON object via the tool.`;

// Belt-and-suspenders: even with response_format={type:json_schema,strict:true},
// some llama-server builds stop honoring the grammar after a few image tokens.
// The schema text in the user message keeps us aligned to the 7-key shape
// and was the difference between 0.00 and 0.44 base-model accuracy in eval.
export const SCHEMA_INSTRUCTION = `You MUST output a single JSON object with exactly these 7 keys, no additional keys, no prose:
  flood_present: boolean
  flood_severity: one of "none" | "minor" | "moderate" | "severe"
  water_coverage_pct_estimate: one of "<10%" | "10-30%" | "30-60%" | ">60%"
  populated_area_affected: boolean
  infrastructure_at_risk: boolean
  river_overflow_visible: boolean
  image_quality_limited: boolean`;
