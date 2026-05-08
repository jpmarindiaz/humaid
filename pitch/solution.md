# Solution — process the flood in space, answer the questions on the ground

humaid closes the planning-to-action gap with **three components designed to work together, and to keep working when the network goes down**.

```
                                   SPACE
                       ┌─────────────────────────────┐
                       │  small VLM on satellite     │
                       │  (LFM2.5-VL-450M, ~450 MB)  │
                       │   Sentinel-2 / Sentinel-1   │
                       │   image  →  small JSON      │
                       │   payload (~200 bytes)      │
                       └──────────────┬──────────────┘
                                      │ tiny payload
                                      │ (low-bandwidth ground link)
                                      ▼
            ┌──────────────────────── EARTH ───────────────────────────┐
            │                                                          │
            │  ┌────────────────┐         ┌────────────────────────┐   │
            │  │ Community      │         │  Local app             │   │
            │  │ station        │ ◄────►  │  (desktop / mobile)    │   │
            │  │ (sync hub)     │ offline │  - role-personalised   │   │
            │  │                │  LAN    │  - SOPs, evac routes,  │   │
            │  │ - receives     │         │    contacts, history   │   │
            │  │   payloads     │         │  - past incidents at   │   │
            │  │ - serves       │         │    THIS location       │   │
            │  │   knowledge    │         │  - works offline once  │   │
            │  │   base         │         │    pre-synced          │   │
            │  └────────────────┘         └────────────────────────┘   │
            │                                                          │
            └──────────────────────────────────────────────────────────┘
```

## 1. Onboard satellite inference — kill the bandwidth and latency tax

A small vision-language model (LiquidAI **LFM2.5-VL-450M**, ~450 MB) running **on the satellite itself**, fine-tuned on Colombian flood events. It ingests Sentinel-1 SAR + Sentinel-2 imagery onboard and emits a **~200-byte structured JSON alert** rather than downlinking the raw tile.

What that solves:
- **Bandwidth.** A Sentinel-2 tile is megabytes. A JSON alert is a tweet. CubeSat-class downlinks can carry hundreds per orbit instead of one or two.
- **Latency.** No central data centre in the loop. Alert reaches the ground station the next time the satellite passes overhead. La Mojana cycle: hours, not days.
- **Cost.** No per-tile cloud-processing bill. The model runs on the same compute you already paid to put in orbit.
- **Coverage.** SAR sees through clouds — it works during the ~50% of wet-season acquisitions when optical imagery is useless.

Same approach used in the [Liquid AI wildfire-prevention cookbook](https://github.com/Liquid4All/cookbook/tree/main/examples/wildfire-prevention). Pipeline already built — see `finetune-flood/`.

## 2. Community station — the offline-first sync layer

A small low-power node (Raspberry Pi class, solar-tolerant) at a **school, clinic, casa de la cultura, JAC, alcaldía, or parish**. It receives the JSON alerts via radio, satellite link, or SMS gateway, and hosts the **synced response knowledge base** on its local Wi-Fi network. Anyone within range — without internet — can connect a phone or laptop and use it.

The knowledge base on the station is **pre-synced before the crisis** with the content that's hard to get hold of mid-event:

- 471 bilingual Q&A pairs (built; see `knowledge-base/`)
- Past incident reports for *this exact location*
- Evacuation routes, *albergue* assignments, contact lists for first responders
- Cluster contacts (WASH, salud, alimentación, alojamiento)
- Census-type data (children, elders, persons with disabilities, pregnant women)
- Standard Operating Procedures for AHE, AHI, EDAN, calamidad pública declarations
- Indigenous and Afrocolombian community-specific protocols (Murui Muina, Inga, Kamëntsá, Zenú)

## 3. Local app — role-personalised, phase-aware, offline forever

The user-facing piece. Runs on whatever device is on the ground — phone, tablet, laptop. Once pre-synced (one-time, before the event), it works **without any network**.

The app personalises by **role × phase × region**:

- A community leader sees: triage, shelter coordination, AHE registration, who to call.
- A *campesino* sees: livestock movement, cropland decisions, family checklist.
- A parent sees: school evacuation routes, kid-specific protocols, vaccinations.
- A municipal official sees: legal triggers (Ley 1523), CMGRD activation, EDAN forms.
- A Cruz Roja responder sees: triage protocol, swift-water rescue gates, manejo de cadáveres.

Each answer is grounded in the **same source documents** the policy specialists wrote — but presented as a Q&A in the user's language, at the user's level, with one tap to action, **and a citation back to the source so accountability stays intact**.

Q&A retrieval works locally with embeddings (`knowledge-base/rag/` — Nomic via Ollama → DuckDB). No cloud round-trip, no inference bill, no privacy concerns about sending displacement data to a third-party API.

## How the three parts close the loop

| Disconnect (from problem.md) | What humaid does |
|---|---|
| Risk maps in technical language | Q&A in plain Spanish/English, role-personalised |
| First-responders can't search PDFs in a crisis | 471 pre-tagged Q&A pairs with retrieval — answer in seconds |
| Satellite imagery too slow / too expensive | Onboard inference, ~200-byte alert payload |
| Alert doesn't translate to local action | Local app maps the alert to specific role-phase-region actions |
| Network is down precisely when needed | Pre-sync; works offline; LAN sharing; no cloud dependency |

The Zenú embraced the floods because they had landscape-literacy delivered by *living in* the landscape. We won't get that back. But we can build a system that delivers an analogous form of literacy — fast, verified, localised, purpose-specific — through a pipeline that doesn't depend on the very infrastructure floods destroy.
