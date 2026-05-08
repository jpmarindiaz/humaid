# humaid — one-pager

> *Offline-first humanitarian-response toolkit for flood crises. Process the flood in space, answer the questions on the ground.*

## In one paragraph

humaid is part of the **NASA Lifelines program**. We are partnered with the **United Nations in Colombia** on their data and AI governance strategy and with **indigenous water-rights organisations in Putumayo** on the field deployment. The technical pieces are built — a satellite-resident VLM, an offline-first knowledge base of 471 source-cited bilingual Q&A pairs, a working sample showcase. **What we are pitching is not a research bet but the first deployment of a system whose implementing partners are already at the table** — at the grass-roots, NGO, and UN level.

## The problem

Humanitarian flood response is **information-bound, not resource-bound**. The knowledge to save lives already exists — in 17+ authoritative PDFs, hundreds of OCHA SitReps, UNGRD damage assessments, IDEAM bulletins, academic risk diagnostics. **No one in an active emergency has time to read it.**

When the dike breaks at 2 a.m. in San Jacinto del Cauca, the JAC president has minutes to decide. The answers exist. They are unreachable.

Five compounding disconnects:
1. Risk maps are written in GIS / SAR / hydraulic-modelling jargon.
2. First responders can't search 314-page PDFs in a crisis.
3. Cloud-based satellite-imagery processing arrives days late.
4. Numerical alerts don't translate to specific human actions.
5. The network the alerts ride on goes down with the power.

## The solution

Three components that work together — and keep working when the network goes down.

```
[Satellite VLM, 450 MB onboard]  →  ~200-byte JSON alert  →  [Community sync station]  →  [Local app, offline]
```

1. **Onboard satellite inference** — fine-tuned LFM2.5-VL-450M turns a Sentinel-1/2 tile into a 200-byte structured JSON alert. No cloud bill, no bandwidth tax, no latency.
2. **Community sync station** — Raspberry-class node at a school / clinic / JAC. Pre-syncs the knowledge base, hosts it on local Wi-Fi, works without internet for days.
3. **Local app** — phone / desktop / web client. Role-personalised, phase-aware, region-specific Q&A. Every answer cites a source PDF.

## Why now

| | 2023 | 2026 |
|---|---|---|
| VLM size for visual reasoning | 8B+ params, data-centre only | 450M params, runs on CubeSat |
| Sentinel-1 SAR coverage of LATAM | Available but unprocessed | Operational EO services with UNGRD |
| Local retrieval cost | Cloud vector DB only | $100 device, no internet |
| Climate stressor | La Niña 2021-2023 just started | Cumulative damage; El Niño 2026 incoming |
| Policy attention | Limited | Procuraduría intervention, Tribunal order |

## Traction

**Programme & partnerships (the part most projects are missing):**
- **NASA Lifelines program** — humaid is an affiliated project.
- **United Nations in Colombia** — partnership on their data and AI governance strategy. humaid as a reference case.
- **Indigenous water-rights organisations in Putumayo** — co-designing the local app and stations on their territory.
- **NGO implementing partners** — humanitarian organisations with operational presence in La Mojana and Putumayo aligned for field deployment.

**Built and committed:**
- **17 source PDFs + searchable markdown corpus** (`research/`)
- **471 bilingual Q&A pairs**, role × phase × region tagged, source-cited (`knowledge-base/`)
- **Full satellite-fine-tuning pipeline** (Modal H100 + Deno, LFM2.5-VL-450M) (`finetune-flood/`)
- **Mapbox sample showcase** of the historical event record (`events-map/`)

## The Zenú anchor

La Mojana was home to the Zenú — pre-Columbian hydraulic engineers whose canal-and-camellón system embraced the floods over 500,000 hectares for 2,000 years. That knowledge was lost. Today's response system reaches the duty officer at the institution, never the family in the wetland. **humaid closes the loop the Zenú already had — through different technology, the same instinct.**

## Colombia is the first step, not the destination

The architecture is hazard-agnostic, region-agnostic, language-agnostic, and institution-agnostic — by design. Colombia is the launch site. The destination is a deployable template for the next 50 flood-exposed regions on Earth.

## Ask

USD 250-350K Year 1 funding to deploy in 14 anchor municipalities (8 La Mojana + 6 Putumayo) **with the partners already in place**. Hosted-payload satellite slot. Climate-finance inclusion in the next La Mojana / Putumayo basin programme.

→ Read [partners.md](./partners.md), [problem.md](./problem.md), [solution.md](./solution.md), [ask.md](./ask.md).
