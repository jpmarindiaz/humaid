# Eval 20260508_123250

- Backend: llama-server at http://localhost:8765, model=lfm2.5-vl-450m-base
- Dataset: data/raw/20260508_070216
- Samples: 110 (4-image pair samples)

| field | accuracy |
|---|---|
| valid_json | 1.00 |
| fields_present | 1.00 |
| flood_present | 0.66 |
| flood_severity | 0.29 |
| water_coverage_pct_estimate | 0.37 |
| populated_area_affected | 0.51 |
| infrastructure_at_risk | 0.54 |
| river_overflow_visible | 0.60 |
| image_quality_limited | 0.10 |
| **overall** | **0.44** |
| **avg latency (s)** | **0.53** |
