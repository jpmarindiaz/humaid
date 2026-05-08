# Users — six roles, three phases, two regions

humaid is built around the explicit recognition that **a single piece of information is useful to different people at different moments in different ways**. The same flood event triggers entirely different decisions depending on who you are, when you're acting, and where you live.

## The matrix

| Role | Pre — preparation | Event — first 72 h | Post — recovery |
|---|---|---|---|
| **local-community** | Family preparedness; emergency bag; livestock movement; JAC alert chain | Evacuation route; *albergue* assignment; family check-in | Censo registration; AHE/AHI claims; WASH safety; livelihood recovery |
| **local-authority** | CMGRD activation; Plan Municipal review; preposicionamiento | Calamidad Pública declaration; PMU; EDAN; albergue management | Plan de Acción Específico; debris management; school re-opening |
| **national-authorities** | ENSO monitoring; Plan Nacional activation; FNGRD ready; international alerts | Declaratoria nacional; AHE distribution; OCHA/CERF coordination | Damage assessment; reconstruction with risk reduction; Procuraduría/Contraloría review |
| **humanitarian-staff** | HRP/CPRP update; CERF AA trigger; cluster pre-position | Cluster activation; ELC sit-reps; intersectoral assessments | After-Action Review; PDM; AAP; nexus to development |
| **ngos** | Multi-year planning; community partner training; pre-position kits | Rapid response; safe access; cash-and-voucher; PFA | PDM; livelihoods recovery; advocacy; donor reporting |
| **first-respondants** | Equipment ready; refresher training; pre-staged on event days | Triage; swift-water rescue; manejo de cadáveres; comms relay | EDAN; debriefing; mental-health for responders; archive lessons |

**6 roles × 3 phases × 2 regions = 36 distinct user contexts.** Plus *generic* answers that apply across all regions.

That's why the knowledge base has **471 Q&A pairs** rather than a flat FAQ — the actionable answer to the same surface question shifts across this matrix, and ignoring that is what makes existing tools feel useless to everyone except the policy specialists who wrote them.

## Two regions, two response logics

| | La Mojana | Putumayo |
|---|---|---|
| Flood mechanism | Slow-onset wetland inundation; lasts months | Mocoa: flash flood / avenida torrencial (minutes-hours). Bajo Putumayo: lowland riverine (hours-days) |
| Triggering river | Cauca + San Jorge + Magdalena | Mocoa/Sangoyaco/Mulato (Andean foothills); Putumayo + Caquetá (lowland) |
| Critical infrastructure | Diques (Cara de Gato, Los Arrastres); Canal de La Esperanza | Vía Mocoa-Pasto; puente sobre Río Negro; *acueductos*; fluvial transport |
| Indigenous overlay | Zenú; Afrocolombian | Murui Muina, Inga, Kamëntsá, Siona, Kofán, Embera, Awá, Koreguaje, Huitoto |
| Armed-conflict overlay | AGC, ELN extort dike contractors | EMC factions, Comandos de la Frontera intense in Bajo Putumayo |
| Recovery time | Years; chronic — never fully recovers | Mocoa 2017 still under reconstruction in 2023 risk diagnostic |
| Local livelihoods | *cultivos transitorios*, ganado, *pesca artesanal*, mototaxi, ciénaga fishing | *cultivos transitorios*, cacao, café, ganado, *plátano*, indigenous *conuco* |

Same JSON alert from the satellite. Two completely different downstream playbooks. The local app picks the right one based on geography and the user's role.

## Beneficiaries — the volumes

- **La Mojana** (Sucre, Córdoba, Bolívar, Antioquia): 11 anchor municipalities, ~450,000 residents in flood-exposed zones. ([ACAPS 2024](../research/download-md/ACAPS-2024-La-Mojana-Flooding.md))
- **Putumayo**: 13 municipalities, **391,000** residents. 2025 rainy-season alone affected **16,975 damnificados (6,068 families)**. ([OCHA Putumayo Briefing 2025](../research/download-md/OCHA-Putumayo-Briefing-Departamental-2025.md))
- **Cumulative since Aug 2021** — La Mojana alone: 166,000+ people across 11 municipalities, 300+ communities. ([OCHA La Mojana Factsheet 2025](../research/download-md/OCHA-La-Mojana-Factsheet-No1-19062025.md))

Adjacent flood-exposed regions where the same architecture transfers immediately: Atrato basin, Cauca river basin, Magdalena-Bajo, Arauca-Casanare, Vichada-Orinoquía, Chocó-Pacífico — together a beneficiary universe in the **low millions**.

## Customers vs beneficiaries

The **users** are the people in the matrix above. The **customers** — the entities that pay or fund — are different:

- UNGRD and Fondo Adaptación at the national level
- Departmental and municipal CDGRD/CMGRD
- Multilateral donors that fund Colombia HRP (CERF, EU CPM, USAID-BHA, SIDA, ECHO)
- Cooperation-funded NGOs (Cruz Roja Colombiana, ACH, World Vision, NRC, Save, MSF)
- Climate-finance windows (Adaptation Fund, Green Climate Fund — already funding La Depresión Momposina)

See [impact-model.md](./impact-model.md) for how the funding flow is structured.
