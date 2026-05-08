// Event anchors from research/flood-tagging-and-reference-points.md.
// For each event we sweep three windows: pre (E−21..E−14), event (E−1..E+3),
// post (E+14..E+30). Pre/post serve as negative/recovery controls; event is
// the positive label. The labeler still gets the actual image and labels what
// it sees — these are sampling anchors, not labels.

export interface FloodEvent {
  id: string
  date: string // YYYY-MM-DD
  region: 'la_mojana' | 'putumayo'
  scope: 'all' | string[] // 'all' = all locations in region; otherwise location IDs
  notes: string
}

export const EVENTS: FloodEvent[] = [
  // === La Mojana ===
  {
    id: 'cara_de_gato_2021',
    date: '2021-08-27',
    region: 'la_mojana',
    scope: 'all',
    notes: 'Cara de Gato dike breach #1; start of La Niña 2021–2023 chronic crisis',
  },
  {
    id: 'la_mojana_peak_2022',
    date: '2022-04-17',
    region: 'la_mojana',
    scope: 'all',
    notes: '~590,000 ha flooded nationwide; ~136,000 ha La Mojana',
  },
  {
    id: 'cara_de_gato_2024',
    date: '2024-05-06',
    region: 'la_mojana',
    scope: 'all',
    notes: 'Cara de Gato breach #2 (after Feb 2024 rebuild)',
  },
  {
    id: 'los_arrastres_2024',
    date: '2024-05-08',
    region: 'la_mojana',
    scope: 'all',
    notes: 'Los Arrastres dike breach (event #2 of May 2024)',
  },
  {
    id: 'la_mojana_peak_2024',
    date: '2024-06-11',
    region: 'la_mojana',
    scope: 'all',
    notes: 'Peak inundation 2024 (~860,000 ha nationwide)',
  },
  {
    id: 'cara_de_gato_2025',
    date: '2025-08-27',
    region: 'la_mojana',
    scope: 'all',
    notes: 'Cara de Gato breach #3',
  },

  // === Putumayo ===
  {
    id: 'mocoa_avalancha_2017',
    date: '2017-04-01',
    region: 'putumayo',
    scope: ['mocoa'],
    notes: 'Avalancha torrencial; 6 watercourses; 17 barrios destroyed',
  },
  {
    id: 'putumayo_decreto_0472_2025',
    date: '2025-07-23',
    region: 'putumayo',
    scope: ['puerto_asis', 'puerto_guzman', 'colon_putumayo', 'santiago_putumayo', 'puerto_leguizamo'],
    notes: 'Gobernación emits Decreto 0472 — calamidad pública departamental',
  },
  {
    id: 'puerto_leguizamo_calamidad_2025',
    date: '2025-04-10',
    region: 'putumayo',
    scope: ['puerto_leguizamo'],
    notes: 'Puerto Leguízamo declares calamidad pública',
  },
]

// For each event we sweep multiple candidate timestamps per window at roughly
// Sentinel-2's 5-day revisit cadence. The fetcher then picks the candidate
// with the lowest cloud_cover and uses that one. This is the only viable
// optical-only strategy for La Mojana / Putumayo, which are cloudy half the
// year. We do not hard-filter on clouds — even very cloudy tiles are kept,
// and the labeler is expected to set image_quality_limited=true so the
// student model learns to abstain rather than hallucinate.

export interface CandidateSet {
  windowKind: 'pre' | 'event' | 'post'
  candidates: string[] // YYYY-MM-DD, ordered closest-to-event first
}

export function expandEvent(e: FloodEvent): CandidateSet[] {
  const E = new Date(e.date + 'T12:00:00Z')
  const day = 24 * 3600 * 1000
  const at = (d: number) => new Date(E.getTime() + d * day).toISOString().slice(0, 10)

  return [
    {
      windowKind: 'pre',
      // Pre-event baseline: 14–28 days before, 5-day spacing.
      candidates: [-14, -19, -24, -28].map(at),
    },
    {
      windowKind: 'event',
      // Event peak: ±5 days around E. Sentinel-2 revisits ~5 days, so 4
      // candidates here virtually guarantee one acquisition is in window.
      candidates: [0, +2, -2, +4].map(at),
    },
    {
      windowKind: 'post',
      // Recovery: 14–32 days after, 5-day spacing.
      candidates: [+14, +19, +24, +29].map(at),
    },
  ]
}
