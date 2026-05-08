// Joins finetune-flood/src/{locations,events}.ts into a flat events database
// and a per-location GeoJSON for the Mapbox viewer.
//
// Run from this directory:   deno run -A build.ts
//
// Outputs (under data/):
//   - events.json     flat (event × location) rows; one entry per affected
//                     location for each event. Easiest to import into SQL.
//   - events.csv      same data as csv.
//   - locations.geojson  one Point feature per location with the list of
//                        events at that location attached as a property.
//                        This is what index.html consumes.
//
// Source of truth: ../finetune-flood/src/locations.ts and events.ts. Re-run
// this script after editing those.

import { EVENTS, FloodEvent } from '../finetune-flood/src/events.ts'
import { LOCATIONS, Location } from '../finetune-flood/src/locations.ts'

interface EventRow {
  event_id: string
  date: string
  description: string
  region: 'la_mojana' | 'putumayo'
  location_id: string
  location_name: string
  municipality: string
  department: string
  lon: number
  lat: number
}

// Location names follow the convention "<municipality>, <department>".
// Split on the LAST comma so parentheticals like "Sucre (cabecera), Sucre"
// keep the parenthetical with the municipality.
function splitName(name: string): { municipality: string; department: string } {
  const idx = name.lastIndexOf(',')
  if (idx === -1) return { municipality: name, department: '' }
  return {
    municipality: name.slice(0, idx).trim(),
    department: name.slice(idx + 1).trim(),
  }
}

function locationsForEvent(ev: FloodEvent): Location[] {
  const inRegion = LOCATIONS.filter((l) => l.region === ev.region)
  if (ev.scope === 'all') return inRegion
  return inRegion.filter((l) => (ev.scope as string[]).includes(l.id))
}

const rows: EventRow[] = []
for (const ev of EVENTS) {
  for (const loc of locationsForEvent(ev)) {
    const { municipality, department } = splitName(loc.name)
    rows.push({
      event_id: ev.id,
      date: ev.date,
      description: ev.notes,
      region: ev.region,
      location_id: loc.id,
      location_name: loc.name,
      municipality,
      department,
      lon: loc.lon,
      lat: loc.lat,
    })
  }
}

rows.sort((a, b) => a.date.localeCompare(b.date) || a.location_id.localeCompare(b.location_id))

// One GeoJSON Feature per location, with all its events attached.
const features = LOCATIONS.map((loc) => {
  const { municipality, department } = splitName(loc.name)
  const locEvents = rows
    .filter((r) => r.location_id === loc.id)
    .map((r) => ({ event_id: r.event_id, date: r.date, description: r.description }))
  return {
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [loc.lon, loc.lat] },
    properties: {
      id: loc.id,
      name: loc.name,
      municipality,
      department,
      region: loc.region,
      notes: loc.notes ?? '',
      event_count: locEvents.length,
      events: locEvents,
    },
  }
})

const geojson = { type: 'FeatureCollection' as const, features }

// CSV — quote everything to keep it brain-dead simple. Description can have
// commas, em-dashes, and accents.
function toCsvCell(v: string | number): string {
  const s = String(v)
  return `"${s.replace(/"/g, '""')}"`
}
const csvHeader = ['event_id', 'date', 'description', 'region', 'location_id', 'location_name', 'municipality', 'department', 'lon', 'lat']
const csvLines = [csvHeader.map(toCsvCell).join(',')]
for (const r of rows) {
  csvLines.push(csvHeader.map((k) => toCsvCell(r[k as keyof EventRow])).join(','))
}

await Deno.mkdir('data', { recursive: true })
await Deno.writeTextFile('data/events.json', JSON.stringify(rows, null, 2) + '\n')
await Deno.writeTextFile('data/events.csv', csvLines.join('\n') + '\n')
await Deno.writeTextFile('data/locations.geojson', JSON.stringify(geojson, null, 2) + '\n')

console.log(`Wrote ${rows.length} event rows across ${LOCATIONS.length} locations.`)
console.log(`  data/events.json`)
console.log(`  data/events.csv`)
console.log(`  data/locations.geojson  (${features.length} features)`)
