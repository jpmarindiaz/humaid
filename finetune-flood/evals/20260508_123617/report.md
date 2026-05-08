# Eval 20260508_123617

- **Backend**: llama-server at http://localhost:8765, model=lfm2.5-vl-450m-base
- **Dataset**: data/raw/20260508_070216
- **Display name**: lfm2.5 base (n=30, dynamic-report)
- **Samples**: 30 (4-image pair samples: RGB-pre + SWIR-pre + RGB-current + SWIR-current)
- **Started**: 2026-05-08T12:36:17.737Z
- **Finished**: 2026-05-08T12:36:33.032Z

## Accuracy by field

| field | accuracy |
|---|---|
| valid_json | 1.00 |
| fields_present | 1.00 |
| flood_present | 0.77 |
| flood_severity | 0.37 |
| water_coverage_pct_estimate | 0.43 |
| populated_area_affected | 0.50 |
| infrastructure_at_risk | 0.57 |
| river_overflow_visible | 0.70 |
| image_quality_limited | 0.03 |
| **overall** | **0.48** |
| **avg latency (s)** | **0.51** |

## Most-disagreed fields

### `image_quality_limited` (acc 0.03)

| sample | ground truth | prediction |
|---|---|---|
| `ayapel/cara_de_gato_2021/event` | true | false |
| `ayapel/cara_de_gato_2021/post` | true | false |
| `ayapel/cara_de_gato_2024/event` | true | false |
| `ayapel/cara_de_gato_2024/post` | true | false |
| `ayapel/cara_de_gato_2025/event` | true | false |

### `flood_severity` (acc 0.37)

| sample | ground truth | prediction |
|---|---|---|
| `ayapel/cara_de_gato_2024/post` | "minor" | "moderate" |
| `ayapel/cara_de_gato_2025/event` | "minor" | "moderate" |
| `ayapel/cara_de_gato_2025/post` | "minor" | "moderate" |
| `ayapel/la_mojana_peak_2022/event` | "none" | "moderate" |
| `ayapel/la_mojana_peak_2022/post` | "minor" | "moderate" |

### `water_coverage_pct_estimate` (acc 0.43)

| sample | ground truth | prediction |
|---|---|---|
| `ayapel/la_mojana_peak_2022/event` | "<10%" | "10-30%" |
| `ayapel/la_mojana_peak_2024/event` | "<10%" | "10-30%" |
| `ayapel/la_mojana_peak_2024/post` | "<10%" | "10-30%" |
| `caimito/cara_de_gato_2021/post` | "<10%" | "30-60%" |
| `caimito/cara_de_gato_2024/event` | "10-30%" | "30-60%" |

## Worst samples (5 with the most mismatched fields)

### `ayapel/la_mojana_peak_2022/event` — 7/7 fields wrong

Baseline: `/Users/jpmarindiaz/jprepo/humaid/finetune-flood/data/raw/20260508_070216/ayapel/la_mojana_peak_2022_pre/rgb.png`
Current: `data/raw/20260508_070216/ayapel/la_mojana_peak_2022_event/rgb.png`

Ground truth: `{"flood_present":false,"flood_severity":"none","water_coverage_pct_estimate":"<10%","populated_area_affected":false,"infrastructure_at_risk":false,"river_overflow_visible":false,"image_quality_limited":true}`

Prediction:   `{"flood_present":true,"flood_severity":"moderate","water_coverage_pct_estimate":"10-30%","populated_area_affected":true,"infrastructure_at_risk":true,"river_overflow_visible":true,"image_quality_limited":false}`

### `ayapel/la_mojana_peak_2024/event` — 7/7 fields wrong

Baseline: `/Users/jpmarindiaz/jprepo/humaid/finetune-flood/data/raw/20260508_070216/ayapel/la_mojana_peak_2024_pre/rgb.png`
Current: `data/raw/20260508_070216/ayapel/la_mojana_peak_2024_event/rgb.png`

Ground truth: `{"flood_present":false,"flood_severity":"none","water_coverage_pct_estimate":"<10%","populated_area_affected":false,"infrastructure_at_risk":false,"river_overflow_visible":false,"image_quality_limited":true}`

Prediction:   `{"flood_present":true,"flood_severity":"moderate","water_coverage_pct_estimate":"10-30%","populated_area_affected":true,"infrastructure_at_risk":true,"river_overflow_visible":true,"image_quality_limited":false}`

### `caimito/cara_de_gato_2021/post` — 7/7 fields wrong

Baseline: `/Users/jpmarindiaz/jprepo/humaid/finetune-flood/data/raw/20260508_070216/caimito/cara_de_gato_2021_pre/rgb.png`
Current: `data/raw/20260508_070216/caimito/cara_de_gato_2021_post/rgb.png`

Ground truth: `{"flood_present":false,"flood_severity":"none","water_coverage_pct_estimate":"<10%","populated_area_affected":false,"infrastructure_at_risk":false,"river_overflow_visible":false,"image_quality_limited":true}`

Prediction:   `{"flood_present":true,"flood_severity":"moderate","water_coverage_pct_estimate":"30-60%","populated_area_affected":true,"infrastructure_at_risk":true,"river_overflow_visible":true,"image_quality_limited":false}`

### `caimito/la_mojana_peak_2024/event` — 7/7 fields wrong

Baseline: `/Users/jpmarindiaz/jprepo/humaid/finetune-flood/data/raw/20260508_070216/caimito/la_mojana_peak_2024_pre/rgb.png`
Current: `data/raw/20260508_070216/caimito/la_mojana_peak_2024_event/rgb.png`

Ground truth: `{"flood_present":false,"flood_severity":"none","water_coverage_pct_estimate":"<10%","populated_area_affected":false,"infrastructure_at_risk":false,"river_overflow_visible":false,"image_quality_limited":true}`

Prediction:   `{"flood_present":true,"flood_severity":"moderate","water_coverage_pct_estimate":"10-30%","populated_area_affected":true,"infrastructure_at_risk":true,"river_overflow_visible":true,"image_quality_limited":false}`

### `caimito/la_mojana_peak_2024/post` — 7/7 fields wrong

Baseline: `/Users/jpmarindiaz/jprepo/humaid/finetune-flood/data/raw/20260508_070216/caimito/la_mojana_peak_2024_pre/rgb.png`
Current: `data/raw/20260508_070216/caimito/la_mojana_peak_2024_post/rgb.png`

Ground truth: `{"flood_present":false,"flood_severity":"none","water_coverage_pct_estimate":"<10%","populated_area_affected":false,"infrastructure_at_risk":false,"river_overflow_visible":false,"image_quality_limited":true}`

Prediction:   `{"flood_present":true,"flood_severity":"moderate","water_coverage_pct_estimate":"30-60%","populated_area_affected":true,"infrastructure_at_risk":true,"river_overflow_visible":true,"image_quality_limited":false}`
