// Typed client for the SimSat data API (default http://localhost:9005).
// We use the historical endpoint /data/image/sentinel so we can sweep
// arbitrary (lon, lat, timestamp) combinations independent of the simulation.

const SIMSAT_BASE_URL = Deno.env.get('SIMSAT_BASE_URL') ?? 'http://localhost:9005'

export interface SentinelMetadata {
  image_available: boolean
  source?: string
  spectral_bands: string[]
  footprint?: [number, number, number, number]
  size_km?: number
  cloud_cover?: number
  datetime?: string
}

export interface SentinelImage {
  metadata: SentinelMetadata
  png: Uint8Array | null
}

export interface FetchSentinelOptions {
  lon: number
  lat: number
  timestamp: string
  spectralBands: string[]
  sizeKm?: number
  windowSeconds?: number
}

// Wrap fetchSentinel with bounded retries. SimSat proxies to AWS Element84
// STAC and occasionally drops connections under concurrent load — retrying
// with a short backoff usually clears it. The probe phase already swallows
// errors per-candidate; this is for the post-probe RGB+SWIR fetches where
// a thrown error would otherwise kill the whole run.
export async function fetchSentinelWithRetry(
  opts: FetchSentinelOptions,
  retries = 3,
): Promise<SentinelImage> {
  let lastErr: Error | null = null
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchSentinel(opts)
    } catch (err) {
      lastErr = err as Error
      if (i < retries) {
        const wait = 500 * (i + 1)
        console.log(`    fetch retry ${i + 1}/${retries} after ${wait}ms: ${lastErr.message.slice(0, 100)}`)
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }
  throw lastErr ?? new Error('unknown fetch failure')
}

// SimSat returns the PNG bytes as the body and the metadata in the
// `sentinel_metadata` response header (JSON-encoded).
export async function fetchSentinel(opts: FetchSentinelOptions): Promise<SentinelImage> {
  // SimSat passes spectral_bands straight to odc.stac.load, which wants a list,
  // not a comma-joined string. URLSearchParams.append → repeated query params.
  const params = new URLSearchParams({
    lon: String(opts.lon),
    lat: String(opts.lat),
    timestamp: opts.timestamp,
    size_km: String(opts.sizeKm ?? 5.0),
    return_type: 'png',
    window_seconds: String(opts.windowSeconds ?? 864000),
  })
  for (const band of opts.spectralBands) params.append('spectral_bands', band)

  const url = `${SIMSAT_BASE_URL}/data/image/sentinel?${params}`
  const resp = await fetch(url)
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`SimSat ${resp.status} on ${url}: ${body.slice(0, 300)}`)
  }

  const metaHeader = resp.headers.get('sentinel_metadata')
  if (!metaHeader) {
    throw new Error(`SimSat returned no sentinel_metadata header for ${url}`)
  }
  const metadata = JSON.parse(metaHeader) as SentinelMetadata

  if (!metadata.image_available) {
    // Drain the body so the connection is reusable.
    await resp.arrayBuffer()
    return { metadata, png: null }
  }

  const buf = new Uint8Array(await resp.arrayBuffer())
  return { metadata, png: buf }
}

// Two band combos per tile.
//   rgb  = true color (B4-B3-B2) — spatial context: cities, terrain, normal rivers.
//   swir = false color (B12-B8-B4) — primary water + sediment channel for floods.
//
// Why SWIR-NIR-Red and not just NIR-Red-Green:
// - Water absorbs even more strongly in SWIR (~2.2 µm) than in NIR, so flood
//   water reads as near-black with very high contrast against dry land.
// - SWIR also separates muddy/sediment-laden floodwater (key for the Cauca,
//   Río Putumayo, Mocoa debris-flow cases) from clear water.
// - MNDWI = (Green − SWIR)/(Green + SWIR) outperforms NDWI in urban / turbid-
//   water settings; SWIR-NIR-Red carries that signal in a 3-channel image
//   the VLM can consume directly.
// - Same combo Pau Labarta Bajo used for the wildfire example, so the band
//   handling stays consistent across the cookbook.
export const BAND_COMBOS = {
  rgb: ['red', 'green', 'blue'],
  swir: ['swir22', 'nir', 'red'],
} as const

export type BandComboName = keyof typeof BAND_COMBOS
