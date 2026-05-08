# Landscape — what exists today and where the gap is

A lot of good work is happening on Colombia floods. None of it closes the planning-to-action loop end to end.

## What's already in production

### Earth observation services

| Provider | What they do | What they don't |
|---|---|---|
| **Copernicus EMS** | On-demand rapid mapping; activations for major events (EMSR865 Córdoba 2026, EMSR286 Ituango 2018) | Activated *after* the event; output is GeoTIFF/PDF; doesn't reach community level |
| **CopernicusLAC Panama Centre** (UNGRD partner) | Operational Sentinel-1 flood-extent + flood-frequency + flood-depth services for La Mojana | Gated to "authorised entities"; web-portal access only; needs internet pipe |
| **UNOSAT** | Damage-proxy maps from InSAR; activated for Colombia Nov 2024 | Same access pattern — central institution to central institution |
| **Disasters Charter** | International tasking of commercial + government satellites | No onboard processing; raw imagery delivered |

These are excellent at producing the imagery. They are not designed to deliver **role-specific actions in plain language to a JAC president whose neighbourhood is being evacuated**.

### Early warning

| System | Coverage |
|---|---|
| **IDEAM** (national meteo) | ENSO bulletins, hydrological alerts (BAH), storm warnings |
| **UNGRD SAT inventory** | Catalogue of departmental + municipal early-warning systems |
| **Local SATs** (Barranquilla, La Guajira, Mojana CRP) | River-level monitoring with community sirens / SMS |

These reach **the duty officer at the entity that runs them**. Translating from "Río Putumayo nivel 11.5 m" to "evacuate now via *vereda* X to *albergue* Y" still happens in someone's head — sometimes correctly, sometimes too late, often not at all.

### Humanitarian information products

| Product | What it does |
|---|---|
| **OCHA SitReps + Flash Updates** | Authoritative situation reports, but produced in Bogotá and downstream — typically days behind |
| **UMAIC** (OCHA info-management) | Maps, dashboards, factsheets — same delay, same audience |
| **ReliefWeb** | Aggregator of all of the above, web only |
| **HDX** | Datasets, very technical audience |

These are the canonical record. Useful for accountability, replanning, and donor reporting. Not useful as the *primary decision aid* for a person in the wetland in the first 6 hours.

### Anticipatory action

| Mechanism | What it triggers |
|---|---|
| **CERF Anticipatory Window** | Pre-positioned UN funding, released on forecast triggers |
| **FAO La Niña AA Plan** (Jan 2025) | Sectoral menu for livestock, water, agricultural inputs |
| **IASC SOPs for Early Action** | Inter-agency procedure for ENSO episodes |

These exist. They work where there is a clear forecast trigger and a partner network already in place. They do not address the **last-mile delivery problem**: how the prepared family in San Jacinto del Cauca actually finds out, in the 10 minutes between alert and action, what to do with their cattle / their grandmother / their school-age child.

### Commercial and start-up players

| Player | Approach |
|---|---|
| **Cloud-to-Street, Floodbase** | Web SaaS flood mapping for insurance/reinsurance |
| **Planet Labs Disasters Data Programme** | Free post-event imagery via Disasters Charter; commercial elsewhere |
| **ICEYE** | Commercial SAR satellite operator |
| **Climate-tech startups** | Almost universally cloud-first, dashboard-style, paid |

Most assume the user is an enterprise risk officer with a stable internet connection. None solve the offline-first, role-personalised, indigenous-overlay-aware problem space.

## What humaid does that is different

| Existing | humaid |
|---|---|
| Cloud-based image processing → GeoTIFF | **Onboard inference → 200-byte JSON** |
| Web portal access only | **Offline-first; works without network** |
| Single technical audience | **Six roles × three phases × two regions** |
| English / Spanish bureaucratic register | **Plain Spanish/English, indigenous overlay** |
| Reach the duty officer | **Reach the JAC president, the *campesino*, the parent** |
| Information delivery | **Action delivery** (citation-backed Q&A → next-step cards) |
| Days post-event | **Hours during event** |
| Per-tile cloud bill | **Onboard inference; near-zero marginal cost** |

## Why this hasn't been built before

- **Two years ago** the model wasn't small enough to run on a CubeSat.
- **Two years ago** local retrieval cost a vector DB licence and a server.
- **Eighteen months ago** Sentinel-1 SAR over Colombia wasn't operational at the cadence needed.
- **Six months ago** the Cara de Gato corruption case + Procuraduría intervention made the political will visible.

The window is open *now*.
