# Agent briefing — flood Q&A knowledge base for Colombia

You are generating a knowledge-base chunk for a multi-agent build of a Q&A dataset on **water-management humanitarian crises in Colombia**, with focus on **La Mojana** (Caribbean wetlands / Depresión Momposina) and **Putumayo** (Andean–Amazon basin). Other agents are generating the other chunks in parallel — stay in your assigned lane (your role) but cover all three phases and all three region buckets.

## Source material — read what's relevant

Local research in `research/download-md/` (markdown conversions of the original PDFs):

| File | What it gives you |
|---|---|
| `ACAPS-2017-Mocoa-Floods-Mudslides.md` | Mocoa avalancha 2017 — first-72h needs, gaps |
| `ACAPS-2021-La-Mojana-Flooding.md` | La Mojana 2021 — Cara de Gato breach #1, La Niña 2021-2023 |
| `ACAPS-2024-La-Mojana-Flooding.md` | La Mojana 2024 — dual breaches, AGC/ELN context, agroecology, sediment |
| `CERF-2022-La-Mojana-Rapid-Response.md` | UN cluster response, WASH/health/food kits, multi-threat scenario |
| `FAO-La-Nina-Anticipatory-Action-Plan-Jan2025.md` | Anticipatory action menu (livelihoods, livestock, water) |
| `IASC-SOPs-Early-Action-El-Nino-La-Nina.md` | Inter-Agency early-action SOPs for ENSO |
| `IISD-Restoring-Wetlands-La-Mojana.md` | Wetland restoration vs grey infrastructure cost-benefit |
| `IOM-Colombia-Crisis-Response-Plan-2025.md` | IOM Colombia 2025 priorities |
| `Mocoa-DiagnosticoRiesgos-2023.md` | Mocoa risk diagnostic (314pp) — quebradas, periodos retorno, zoning |
| `OCHA-HRP-Colombia-2024-2025-Summary.md` | National HRP/CPRP — overall architecture |
| `OCHA-La-Mojana-Factsheet-No1-19062025.md` | June 2025 La Mojana factsheet — current crisis numbers |
| `OCHA-Putumayo-Briefing-Departamental-2025.md` | Putumayo dept profile 2025, ELC, GANE context |
| `OCHA-SitRep-Inundaciones-Amazonia-Orinoquia-2025.md` | Multi-dept 2025 flood SitRep — Putumayo, Caquetá, Arauca, Vichada, Guaviare, Amazonas |
| `SIDA-Colombia-HCA-2025.md` | Donor humanitarian crisis analysis |
| `UNAL-Catastrofe-Mocoa.md` | UNAL academic note on Mocoa 2017 |
| `UNGRD-Evaluacion-La-Nina-2021-2023.md` | Official damages/impact assessment La Niña triple-dip |
| `UNGRD-Plan-Nacional-El-Nino.md` | National El Niño contingency plan |

Also useful, in `research/`:

- `water-crisis-colombia.md` — synthesis with timeline anchors
- `flood-tagging-and-reference-points.md` — temporal/spatial anchors for La Mojana & Putumayo
- `humanitarian-aid-colombia/humanitarian-aid-context.md` — HPC phases, Colombia humanitarian architecture, Mocoa lessons

External links curated in `research/links.md` — use these when a Q&A cites material you didn't read locally (e.g., IFRC GO field reports, IDEAM bulletins, Copernicus EMS activations).

## Your output — CSV chunk

Write to: `knowledge-base/chunks/<your-role>.csv`

Schema (header is required, exactly as below):

```
id,role,phase,region,topic,question_en,question_es,answer_en,answer_es,references,ref_types
```

| Column | Values |
|---|---|
| `id` | `<role-slug>-NNN`, e.g. `local-community-001`. Pad to 3 digits. Sequential within your chunk. |
| `role` | Your assigned role slug (one of: `local-community`, `local-authority`, `national-authorities`, `humanitarian-staff`, `ngos`, `first-respondants`). |
| `phase` | `pre` \| `event` \| `post`. The phase when the question is most actionable. If a question is asked at multiple phases, write **separate rows** — same question text, different phase, different answer if the answer changes. |
| `region` | `la-mojana` \| `putumayo` \| `generic`. `generic` for risk-management/HPC questions that apply equally everywhere. **La Mojana ≠ Putumayo for water management** — they are different ecosystems and call for different answers. |
| `topic` | Short slug, e.g. `early-warning`, `evacuation`, `wash`, `shelter`, `food-security`, `protection`, `dike-management`, `health`, `livelihoods`, `coordination`, `data-information`, `cash-transfers`, `gbv`, `child-protection`, `mental-health`, `disability-inclusion`, `indigenous-rights`, `armed-conflict-overlap`, `cluster-activation`, `donor-funding`, `recovery`, `wetland-management`, `flash-flood`, `landslide`, `enso-forecast`, `satellite-imagery`. Free-tag — pick what fits. |
| `question_en` | English question. Phrased in the **first person of your role** ("How do I…", "When should we…"). |
| `question_es` | Spanish translation of the same question. Match register (community = informal "tú/usted" appropriate for Colombian context, technical roles = neutral). |
| `answer_en` | English answer, 2-6 sentences. Concrete, actionable, cites real procedures/structures from the source material. **Distinguish La Mojana and Putumayo when relevant.** Avoid generic platitudes. |
| `answer_es` | Spanish translation. |
| `references` | Pipe-separated list of references that back the answer. Use **relative paths** for local files (e.g. `research/download-md/OCHA-La-Mojana-Factsheet-No1-19062025.md`) and **full URLs** for external. Empty = no reference. |
| `ref_types` | Pipe-separated list, same length as `references`, each value is `local` or `cloud`. |

### CSV quoting rules — non-negotiable

- **Always** quote every cell with double quotes (`"..."`).
- **Always** escape internal double quotes by doubling them (`""`).
- Don't put line breaks inside cells — keep questions and answers single-line. Use periods/semicolons instead of newlines.
- UTF-8, no BOM.
- One Q&A pair per row. The header is row 1.

Example row (illustrative):

```
"local-community-001","local-community","pre","la-mojana","early-warning","How do I know if Cara de Gato is about to fail again?","¿Cómo sé si el dique Cara de Gato va a fallar de nuevo?","Watch IDEAM's Boletín de Alertas Hidrológicas for the Río Cauca subzone; Sucre and Bolívar municipal Consejos de Gestión del Riesgo (CMGRD) usually relay alerts via community radio and WhatsApp. Filtration of the dike — water seeping through — and rising Río Cauca levels above ~3.5m at La Coquera typically precede a breach by hours to days. Report visible filtrations to your JAC president; in 2024 communities did this and bought hours of evacuation time.","Consulta el Boletín de Alertas Hidrológicas del IDEAM para la subzona del Río Cauca; los Consejos Municipales de Gestión del Riesgo (CMGRD) de Sucre y Bolívar suelen replicar las alertas por radio comunitaria y WhatsApp. Las filtraciones en el dique — agua que se cuela — y los niveles del Río Cauca por encima de ~3.5 m en La Coquera suelen anteceder la ruptura en cuestión de horas o días. Reporta filtraciones visibles a la presidencia de tu JAC; en 2024 las comunidades lo hicieron y ganaron horas para evacuar.","research/download-md/ACAPS-2024-La-Mojana-Flooding.md|https://www.ideam.gov.co/sala-de-prensa/boletines/Boletín-de-Alertas-Hidrológicas-(BAH)","local|cloud"
```

## Coverage targets — aim high

- **Volume:** at least 60-80 Q&A pairs in your chunk. More if you can keep them substantive.
- **Phase mix:** at least 30% pre, 30% event, 25% post, with the rest where it best fits.
- **Region mix:** ~30% La Mojana, ~30% Putumayo, ~25% generic, plus some that cross-compare.
- **Same question, multiple phases:** if a question genuinely matters before, during, and after, write 3 rows — the answers should differ in their actionable content per phase.

## Stand in the role's shoes

Don't write generic procedural text. Write what a person in this role would actually ask and need to hear, given:

| Role | Mindset |
|---|---|
| `local-community` | Plain language. Family-level decisions. Mobility, kids, livestock, food, valuables, neighbours, JAC, what to listen for, who to trust. La Mojana = "el agua sube despacio pero no se va por meses"; Putumayo lowland = "el río puede subir 5 m en una noche"; Mocoa = "puede venir piedra y lodo, no sólo agua". |
| `local-authority` | Alcalde, secretaría de gobierno, CMGRD, secretaría de salud, secretaría de educación. Censos, calamidad pública declarations, AHI activation, bomberos coordination, school suspensions, albergues, debris management. |
| `national-authorities` | UNGRD, Ministerio del Interior, Unidad para las Víctimas, IDEAM, Defensoría, Fondo Adaptación. Decretos nacionales, articulación interinstitucional, recursos del FNGRD, Plan Mojana, Plan Nacional El Niño. |
| `humanitarian-staff` | OCHA, EHP, ELC, UMAIC, UN agencies. HPC cycle, cluster activation, severity scoring, CERF allocations, AAP/Flagship, sit-reps, intersectoral assessments. |
| `ngos` | National + international NGOs — ACH, World Vision, NRC, Sahed, MSF, Save, Plan, etc. Operational implementation under cluster guidance, community engagement, partner coordination, due-diligence under armed-conflict overlay. |
| `first-respondants` | Cruz Roja, Defensa Civil, Bomberos, Fuerza Pública, brigades. Búsqueda y rescate, primeros auxilios, manejo de cadáveres, EDAN, evacuation, road clearance, swift-water rescue, comms relays. |

## Things that should differ between La Mojana and Putumayo

| Theme | La Mojana | Putumayo |
|---|---|---|
| Flood mechanism | Slow-onset wetland inundation from dike breaches; lasts months | Fast-onset Andean flash floods (Mocoa); slower lowland riverine (Bajo Putumayo, Caquetá) |
| Triggers | La Niña + Cauca/San Jorge/Magdalena overflow + dike failure | Heavy convective rainfall in Andes-Amazon foothills + saturated soils |
| Pre-flood signals | Filtraciones at Cara de Gato; Río Cauca levels at La Coquera; sustained La Niña | Quebradas Taruca/Mulato/Sangoyaco rapid rise; landslides on hillsides; río Putumayo at Puerto Asís |
| Local livelihoods at risk | Cultivos transitorios, ganado, pesca artesanal, mototaxi, ciénaga-based fishing | Cultivos transitorios, cacao, café, ganado, pesca, plátano, comunidades indígenas con conuco |
| Indigenous overlay | Zenú, some Afrocolombian | Murui Muina, Inga, Kamëntsá, Siona, Kofán, Embera, Awá, Koreguaje, Huitoto |
| Armed-conflict overlay | AGC, ELN extort dike contractors; restrict humanitarian access | EMC factions (Iván Mordisco, Raúl Reyes), Comandos de la Frontera; intense in Bajo Putumayo |
| Recovery time | Years; chronic — never fully recovers between cycles | Mocoa 2017 still under reconstruction in 2023 diagnostic |
| Critical infra | Diques (Cara de Gato, Los Arrastres), Canal de La Esperanza, jarillones comunitarios | Vía Mocoa-Pasto, puente sobre Río Negro, acueductos, infraestructura fluvial |

When you can hang an answer on one of these region-specific facts, do.

## Avoid

- Bilingual mismatch — don't have an English answer that says one thing and a Spanish one that says another. They're translations of the same answer.
- Padding. If you don't know, don't write the row.
- Western-centric framing for indigenous communities. Where indigenous knowledge or autonomous governance applies, name it (e.g., Murui Muina autonomous response in Puerto Leguízamo 2025).
- Inventing source citations. If you can't ground an answer in the listed sources or general knowledge, leave `references` empty.

When you finish, return a one-line summary: `Wrote N rows to knowledge-base/chunks/<role>.csv. Phase: pre=A event=B post=C. Region: la-mojana=X putumayo=Y generic=Z.`
