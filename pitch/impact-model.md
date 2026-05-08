# Impact model — how this sustains and scales

humaid is dual-purpose: a public-good knowledge-and-alert system for vulnerable communities, and a re-usable infrastructure for the entities that already pay for flood response. That duality is the funding model.

## Three revenue / funding streams

### 1. Institutional licences — UNGRD, gobernaciones, alcaldías

The community station + local app + Q&A retrieval is **enterprise-shaped infrastructure** for the Colombian disaster-risk system. Today UNGRD pays for:
- Bespoke risk diagnostics (per municipality, $XX-XXX K each)
- Custom dashboards (per project, $X-XX K/year)
- Cloud-based EO services (per-tile pricing)

humaid replaces fragments of all three with **one local-first per-municipality licence**. Pricing benchmarked against the existing cost stack.

### 2. Climate finance — Adaptation Fund, GCF, IADB, World Bank

There is **already** a $30M+ Adaptation Fund project in La Depresión Momposina ("Reducing Risk and Vulnerability to Climate Change in the Region of La Depresión Momposina") and a UNDP-GCF "Scaling up Climate Resilient Water Management Practices in La Mojana." humaid fits as the **information-delivery layer** that these projects systematically lack — they fund infrastructure works (Canal de la Esperanza, wetland restoration), not the last-mile knowledge channel.

Approach: package humaid as a **named workstream within larger climate-finance applications**, with a clear deliverable (community stations + sync layer + local app) and metrics (alert-to-action time, beneficiaries reached).

### 3. Humanitarian funders — CERF, ECHO, USAID-BHA, SIDA

For acute response in active La Niña / El Niño episodes, the same architecture is deployable rapidly with **CERF Anticipatory Action** windows or rapid-response allocations. Cooperation partners (ACH, World Vision, NRC, Cruz Roja) deploy humaid stations as part of their existing response operations under cluster guidance.

Approach: **NGO-of-record partnership** — humaid provides the platform; established humanitarian implementers deploy it under their existing donor agreements.

## Cost structure

### Marginal cost per beneficiary

**Very low.** Most of the cost is upfront engineering. After that:

| Item | Marginal cost |
|---|---|
| Adding a new municipality to coverage | <$2K (data prep, station bring-up, training) |
| Adding a new role/phase to the local app | $0 once schema established |
| Per-additional-Q&A pair | $0 (open multi-agent pipeline) |
| Per-additional-satellite-pass alert | $0 (onboard inference, bandwidth amortised) |
| Per-additional-end-user | $0 (offline app, no per-seat cost) |

This is the inverse of cloud-SaaS economics. It's **closer to public-infrastructure economics**.

### Fixed costs

| Phase | What we need to build | Estimated cost |
|---|---|---|
| Sentinel-1 retrofit + actual fine-tune | 3 weeks engineering + Modal credits | ~$5-10K |
| Community station hardware + bring-up | 6 weeks + 5 pilot devices | ~$15-25K |
| Local app v1 (mobile + desktop) | 12 weeks design + dev | ~$60-90K |
| First field pilot (La Mojana) | 6 months + field staff | ~$80-120K |
| Hosted-payload satellite partnership | 9-12 months + launch slot | ~$200-500K (varies) |

Total **path to first impact deployment**: ~$200-300K excluding the satellite payload (which can be a partnership rather than a buy).

## Public-good rails

The architecture is **fundamentally compatible with open-source release**:

- The Q&A pipeline is multi-agent over public PDFs — fully reproducible.
- The Sentinel-1/2 imagery is open Copernicus data.
- The model (LFM2.5-VL-450M) is open-weights from Liquid AI.
- The community-station stack runs on open-source components (DuckDB, Ollama, Nomic).

This means humaid can sustain *both* commercial enterprise licences and open-source community deployments without the usual "open core vs commercial" tension. The institutional licence pays for **integration, support, customisation, and the satellite payload share** — not for code that other communities need to be able to redeploy.

## Theory of change

```
satellite alert (200 bytes)
        ↓
community station (offline-first sync hub)
        ↓
local app (role-personalised, phase-aware, region-specific)
        ↓
faster decision in the affected community
        ↓
fewer lives lost; less capital destroyed; livelihoods preserved
        ↓
recurring trust + recurring funding from institutions whose mandate is exactly this
```

We are not selling a SaaS subscription. We are selling **the closure of a delivery gap that costs lives every La Niña cycle**, to actors who are already mandated and budgeted to close it but lack the architecture.

## Metrics that matter

The pitch isn't seats sold. It's:

| Metric | Goal year 1 |
|---|---|
| Anchor municipalities covered | 8 La Mojana + 6 Putumayo + 4 Atrato/Pacífico |
| Community stations deployed | 20 |
| Pre-synced devices in the field | 2,000 |
| Documented alert-to-action events | 15+ |
| Q&A retrieval queries served offline | >50K |
| Lessons-learned cycles broken | track WASH gap re-discovery; aim for 0 |
| Climate-finance applications including humaid | 2-3 |
