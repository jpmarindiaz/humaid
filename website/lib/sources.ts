// The 17 source PDFs that ground the knowledge base.
//
// Hand-curated metadata — title and date come from the PDFs themselves,
// publisher and region are inferred from the slug. The full markdown
// versions live at `../research/download-md/*.md` in the repo; the
// website doesn't ship those files (each is several MB combined).

export interface Source {
  slug: string;
  publisher: string;
  year: number;
  region: "la-mojana" | "putumayo" | "national" | "global";
  title: string;
  summary: string;
}

export const SOURCES: Source[] = [
  {
    slug: "ACAPS-2017-Mocoa-Floods-Mudslides",
    publisher: "ACAPS",
    year: 2017,
    region: "putumayo",
    title: "Mocoa Floods and Mudslides — Briefing Note",
    summary: "Rapid assessment of the 31 March – 1 April 2017 avalancha torrencial in Mocoa: 335 dead, 57 disappeared, 400+ injured. WASH, shelter, health gaps and indigenous-community impact.",
  },
  {
    slug: "ACAPS-2021-La-Mojana-Flooding",
    publisher: "ACAPS",
    year: 2021,
    region: "la-mojana",
    title: "La Mojana Flooding — Briefing Note",
    summary: "First wave of the 2021–2023 triple-dip La Niña: Cara de Gato dike breach (27 Aug 2021), 166,000+ affected across 11 municipalities.",
  },
  {
    slug: "ACAPS-2024-La-Mojana-Flooding",
    publisher: "ACAPS",
    year: 2024,
    region: "la-mojana",
    title: "La Mojana Flooding — 2024 Briefing Note",
    summary: "Renewed Cara de Gato + Los Arrastres dike failures, peak inundation ~860,000 ha nationally. Chronic-emergency dynamics three years on.",
  },
  {
    slug: "CERF-2022-La-Mojana-Rapid-Response",
    publisher: "CERF",
    year: 2022,
    region: "la-mojana",
    title: "La Mojana Rapid-Response Allocation",
    summary: "UN OCHA Central Emergency Response Fund allocation report for La Mojana — disbursement, cluster sectoral coverage, lessons learned.",
  },
  {
    slug: "FAO-La-Nina-Anticipatory-Action-Plan-Jan2025",
    publisher: "FAO",
    year: 2025,
    region: "national",
    title: "La Niña Anticipatory Action Plan",
    summary: "FAO's pre-event AA framework for Colombian rural livelihoods — triggers, beneficiaries, agricultural decision protocols.",
  },
  {
    slug: "IASC-SOPs-Early-Action-El-Nino-La-Nina",
    publisher: "IASC",
    year: 2024,
    region: "global",
    title: "Inter-Agency SOPs for Early Action — El Niño / La Niña",
    summary: "Standard operating procedures for cluster activation, anticipatory funding, and pre-positioning across the ENSO cycle.",
  },
  {
    slug: "IISD-Restoring-Wetlands-La-Mojana",
    publisher: "IISD",
    year: 2024,
    region: "la-mojana",
    title: "Restoring Wetlands in La Mojana",
    summary: "Adaptation Fund / GCF-aligned analysis on ecosystem-based adaptation — Zenú hydraulic legacy as design reference for nature-based response.",
  },
  {
    slug: "IOM-Colombia-Crisis-Response-Plan-2025",
    publisher: "IOM",
    year: 2025,
    region: "national",
    title: "Colombia Crisis Response Plan 2025",
    summary: "International Organization for Migration response plan — displacement tracking, mobility-related humanitarian needs.",
  },
  {
    slug: "Mocoa-DiagnosticoRiesgos-2023",
    publisher: "Alcaldía Mocoa",
    year: 2023,
    region: "putumayo",
    title: "Diagnóstico de Riesgos — Mocoa 2023",
    summary: "Municipal risk diagnostic 6 years after the 2017 avalancha. Highest-risk barrios identified: San Miguel, Miraflores, El Progreso, Puente Mulato.",
  },
  {
    slug: "OCHA-HRP-Colombia-2024-2025-Summary",
    publisher: "OCHA",
    year: 2024,
    region: "national",
    title: "Humanitarian Response Plan Colombia 2024–2025",
    summary: "OCHA HRP — overview of needs, response scenarios, cluster strategies for natural-disaster + armed-conflict overlay.",
  },
  {
    slug: "OCHA-La-Mojana-Factsheet-No1-19062025",
    publisher: "OCHA",
    year: 2025,
    region: "la-mojana",
    title: "La Mojana Factsheet No. 1 — June 2025",
    summary: "Snapshot of the chronic-emergency state four years after the 2021 breach: 300+ communities still flooded, cluster gaps, Procuraduría intervention context.",
  },
  {
    slug: "OCHA-Putumayo-Briefing-Departamental-2025",
    publisher: "OCHA",
    year: 2025,
    region: "putumayo",
    title: "Putumayo Briefing Departamental 2025",
    summary: "Department-level overview: 13 municipalities, 391,000 residents, 2025 rainy season impact (16,975 damnificados / 6,068 families).",
  },
  {
    slug: "OCHA-SitRep-Inundaciones-Amazonia-Orinoquia-2025",
    publisher: "OCHA",
    year: 2025,
    region: "putumayo",
    title: "SitRep — Inundaciones Amazonía / Orinoquía 2025",
    summary: "Situation report covering Putumayo + adjacent Amazonian / Orinoquía basins. Río Putumayo reached 11.5 m vs 12.5 m record.",
  },
  {
    slug: "SIDA-Colombia-HCA-2025",
    publisher: "SIDA",
    year: 2025,
    region: "national",
    title: "Colombia Humanitarian Crises Analysis 2025",
    summary: "Swedish International Development Agency country analysis — donor-perspective overview for funding decisions.",
  },
  {
    slug: "UNAL-Catastrofe-Mocoa",
    publisher: "UNAL",
    year: 2018,
    region: "putumayo",
    title: "Catástrofe de Mocoa — Análisis UNAL",
    summary: "Universidad Nacional de Colombia academic analysis of the Mocoa avalancha — geological precursors, response failures, reconstruction critique.",
  },
  {
    slug: "UNGRD-Evaluacion-La-Nina-2021-2023",
    publisher: "UNGRD",
    year: 2024,
    region: "national",
    title: "Evaluación La Niña 2021–2023",
    summary: "UNGRD official assessment of the triple-dip La Niña: >500,000 affected in La Mojana alone, system-level lessons for the next ENSO cycle.",
  },
  {
    slug: "UNGRD-Plan-Nacional-El-Nino",
    publisher: "UNGRD",
    year: 2026,
    region: "national",
    title: "Plan Nacional de Contingencia El Niño",
    summary: "UNGRD national contingency plan — Circular 028 de 2026 directives for the forecast El Niño 2026 onset.",
  },
];

export const SOURCES_BY_PUBLISHER = SOURCES.reduce((acc, s) => {
  (acc[s.publisher] ??= []).push(s);
  return acc;
}, {} as Record<string, Source[]>);
