// Tiny single-file app for testing the fine-tuned flood-detection model.
// Serves a single HTML page on http://localhost:8000.
//
// Two modes:
//   1. UPLOAD  — drop in 4 PNGs (pre RGB, pre SWIR, current RGB, current SWIR)
//                and get the JSON labels.
//   2. SIMSAT  — pick a location + baseline date + current date; the app
//                fetches the four bands from a running SimSat (port 9005)
//                and asks the model.
//
// Mirrors the deno-deploy-llamacpp pattern (Hono server + llama-server
// proxy) but doesn't spawn llama-server itself. Run this app alongside:
//
//   deno task serve   (separate terminal, hosts the GGUF on :8765)
//   deno task app     (this file, hosts the UI on :8000)

import { Hono } from 'hono'
import { encodeBase64 } from '@std/encoding/base64'

import { LOCATIONS } from '../src/locations.ts'
import { FLOOD_LABEL_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from '../src/prompts.ts'
import { BAND_COMBOS, fetchSentinelWithRetry } from '../src/simsat.ts'

const LLAMA_URL = Deno.env.get('LLAMA_URL') ?? 'http://localhost:8765'
const PORT = Number(Deno.env.get('PORT') ?? '8081')
const SIMSAT_BASE_URL = Deno.env.get('SIMSAT_BASE_URL') ?? 'http://localhost:9005'

const SCHEMA_INSTRUCTION = `You MUST output a single JSON object with exactly these 7 keys, no additional keys, no prose:
  flood_present: boolean
  flood_severity: one of "none" | "minor" | "moderate" | "severe"
  water_coverage_pct_estimate: one of "<10%" | "10-30%" | "30-60%" | ">60%"
  populated_area_affected: boolean
  infrastructure_at_risk: boolean
  river_overflow_visible: boolean
  image_quality_limited: boolean`

interface PredictInput {
  preRgb: Uint8Array
  preSwir: Uint8Array
  curRgb: Uint8Array
  curSwir: Uint8Array
}

async function predict(images: PredictInput): Promise<{ labels: Record<string, unknown>; latency_ms: number }> {
  const body = {
    model: 'lfm2-flood',
    max_tokens: 1024,
    temperature: 0.0,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'flood_assessment', strict: true, schema: FLOOD_LABEL_SCHEMA },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${encodeBase64(images.preRgb)}` } },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${encodeBase64(images.preSwir)}` } },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${encodeBase64(images.curRgb)}` } },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${encodeBase64(images.curSwir)}` } },
          { type: 'text', text: `${USER_PROMPT}\n\n${SCHEMA_INSTRUCTION}` },
        ],
      },
    ],
  }
  const t0 = performance.now()
  const resp = await fetch(`${LLAMA_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    throw new Error(`llama-server ${resp.status}: ${(await resp.text()).slice(0, 300)}`)
  }
  const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = json.choices?.[0]?.message?.content ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`no JSON object in response: ${text.slice(0, 200)}`)
  return { labels: JSON.parse(match[0]) as Record<string, unknown>, latency_ms: Math.round(performance.now() - t0) }
}

const app = new Hono()

app.get('/', (c) => c.html(SHELL_HTML))

app.get('/health', async (c) => {
  try {
    const r = await fetch(`${LLAMA_URL}/health`)
    const sim = await fetch(`${SIMSAT_BASE_URL}/data/current/position`).then((x) => x.ok).catch(() => false)
    return c.json({
      ok: r.ok,
      llama_url: LLAMA_URL,
      llama_status: r.status,
      simsat_url: SIMSAT_BASE_URL,
      simsat_up: sim,
    })
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 500)
  }
})

app.get('/locations', (c) => c.json(LOCATIONS))

app.post('/predict', async (c) => {
  const form = await c.req.formData()
  const fields = ['pre_rgb', 'pre_swir', 'cur_rgb', 'cur_swir'] as const
  const buffers: Record<typeof fields[number], Uint8Array> = {} as never
  for (const f of fields) {
    const file = form.get(f)
    if (!(file instanceof File)) {
      return c.json({ ok: false, error: `missing field "${f}"` }, 400)
    }
    buffers[f] = new Uint8Array(await file.arrayBuffer())
  }
  try {
    const result = await predict({
      preRgb: buffers.pre_rgb,
      preSwir: buffers.pre_swir,
      curRgb: buffers.cur_rgb,
      curSwir: buffers.cur_swir,
    })
    return c.json({ ok: true, ...result })
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 500)
  }
})

app.post('/fetch-and-predict', async (c) => {
  const body = (await c.req.json()) as {
    location_id?: string
    lon?: number
    lat?: number
    baseline_date?: string
    current_date?: string
  }
  let lon = body.lon
  let lat = body.lat
  if (body.location_id) {
    const loc = LOCATIONS.find((l) => l.id === body.location_id)
    if (!loc) return c.json({ ok: false, error: `unknown location_id ${body.location_id}` }, 400)
    lon = loc.lon
    lat = loc.lat
  }
  if (lon === undefined || lat === undefined) {
    return c.json({ ok: false, error: 'lon+lat or location_id required' }, 400)
  }
  if (!body.baseline_date || !body.current_date) {
    return c.json({ ok: false, error: 'baseline_date and current_date required (YYYY-MM-DD)' }, 400)
  }

  const fetchOne = async (date: string, bands: readonly string[]) =>
    fetchSentinelWithRetry({
      lon: lon!,
      lat: lat!,
      timestamp: `${date}T12:00:00Z`,
      spectralBands: [...bands],
      sizeKm: 5,
    })

  let preRgb, preSwir, curRgb, curSwir
  try {
    ;[preRgb, preSwir, curRgb, curSwir] = await Promise.all([
      fetchOne(body.baseline_date, BAND_COMBOS.rgb),
      fetchOne(body.baseline_date, BAND_COMBOS.swir),
      fetchOne(body.current_date, BAND_COMBOS.rgb),
      fetchOne(body.current_date, BAND_COMBOS.swir),
    ])
  } catch (err) {
    return c.json({ ok: false, error: `simsat fetch failed: ${(err as Error).message}` }, 500)
  }

  const missing = [
    !preRgb.png ? 'baseline RGB' : null,
    !preSwir.png ? 'baseline SWIR' : null,
    !curRgb.png ? 'current RGB' : null,
    !curSwir.png ? 'current SWIR' : null,
  ].filter(Boolean)
  if (missing.length > 0) {
    return c.json({ ok: false, error: `simsat returned image_available=false for: ${missing.join(', ')} — try different dates` }, 400)
  }

  let result
  try {
    result = await predict({
      preRgb: preRgb.png!,
      preSwir: preSwir.png!,
      curRgb: curRgb.png!,
      curSwir: curSwir.png!,
    })
  } catch (err) {
    return c.json({ ok: false, error: `predict failed: ${(err as Error).message}` }, 500)
  }

  return c.json({
    ok: true,
    ...result,
    images: {
      pre_rgb: `data:image/png;base64,${encodeBase64(preRgb.png!)}`,
      pre_swir: `data:image/png;base64,${encodeBase64(preSwir.png!)}`,
      cur_rgb: `data:image/png;base64,${encodeBase64(curRgb.png!)}`,
      cur_swir: `data:image/png;base64,${encodeBase64(curSwir.png!)}`,
    },
    metadata: {
      lon,
      lat,
      baseline: {
        date: body.baseline_date,
        cloud_cover: preRgb.metadata.cloud_cover,
        source: preRgb.metadata.source,
        capture_datetime: preRgb.metadata.datetime,
      },
      current: {
        date: body.current_date,
        cloud_cover: curRgb.metadata.cloud_cover,
        source: curRgb.metadata.source,
        capture_datetime: curRgb.metadata.datetime,
      },
    },
  })
})

const SHELL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>finetune-flood · live demo</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #0f1218; --panel: #161b25; --border: #2a3142; --ink: #e6edf3;
    --muted: #8b96a8; --accent: #6dd3a8; --warn: #f7b955; --bad: #ef6f6c;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif; background: var(--bg); color: var(--ink); }
  header { padding: 18px 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  header h1 { margin: 0; font-size: 17px; font-weight: 600; }
  header .health { font-size: 12px; color: var(--muted); }
  header .health .ok { color: var(--accent); } header .health .bad { color: var(--bad); }
  main { max-width: 1100px; margin: 24px auto; padding: 0 24px; }
  .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
  .tab { padding: 10px 18px; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent; user-select: none; }
  .tab.active { color: var(--ink); border-bottom-color: var(--accent); }
  .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
  .panel + .panel { margin-top: 24px; }
  .row { display: flex; gap: 16px; flex-wrap: wrap; }
  .row > * { flex: 1; min-width: 180px; }
  label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .5px; }
  input[type=text], input[type=date], input[type=number], select { width: 100%; padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--ink); font-size: 14px; font-family: inherit; }
  input[type=file] { font-size: 13px; color: var(--muted); }
  button { padding: 10px 18px; background: var(--accent); color: #0f1218; border: 0; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; }
  button:disabled { opacity: .5; cursor: progress; }
  button.ghost { background: transparent; color: var(--ink); border: 1px solid var(--border); font-weight: 500; }
  .grid4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-top: 16px; }
  .grid4 figure { margin: 0; }
  .grid4 img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 6px; background: var(--bg); border: 1px solid var(--border); }
  .grid4 figcaption { font-size: 11px; color: var(--muted); margin-top: 4px; text-align: center; }
  .result { margin-top: 24px; padding: 16px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; display: none; }
  .result.shown { display: block; }
  .result h3 { margin: 0 0 12px 0; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 13px; background: #1f2632; border: 1px solid var(--border); }
  .badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
  .badge.warn .dot { background: var(--warn); } .badge.bad .dot { background: var(--bad); } .badge.good .dot { background: var(--accent); }
  pre { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 12px; overflow-x: auto; font-size: 12px; line-height: 1.5; color: var(--ink); }
  .meta { font-size: 12px; color: var(--muted); margin-top: 8px; }
  .err { color: var(--bad); padding: 12px; background: #2a1818; border: 1px solid var(--bad); border-radius: 6px; font-size: 13px; }
  .hint { font-size: 12px; color: var(--muted); margin-top: 8px; }
</style>
</head>
<body>
<header>
  <h1>finetune-flood · fine-tuned LFM2-flood demo</h1>
  <div class="health" id="health">…checking</div>
</header>
<main>
  <div class="tabs">
    <div class="tab active" data-tab="simsat">Fetch from SimSat</div>
    <div class="tab" data-tab="upload">Upload images</div>
  </div>

  <div class="panel" id="tab-simsat">
    <div class="row">
      <div>
        <label>Location</label>
        <select id="loc"></select>
      </div>
      <div>
        <label>Baseline date</label>
        <input type="date" id="baseline_date" value="2024-04-19">
      </div>
      <div>
        <label>Current date</label>
        <input type="date" id="current_date" value="2024-05-07">
      </div>
    </div>
    <div class="hint">Pick a location and two dates ~14–28 days apart. The app fetches RGB + SWIR for each date from SimSat at <code id="simsat-url"></code> (Sentinel-2 simulator must be running). The lowest-cloud Sentinel-2 acquisition within ±10 days of each requested date is used.</div>
    <div style="margin-top: 16px;">
      <button id="run-simsat">Fetch + assess flood risk</button>
    </div>
  </div>

  <div class="panel" id="tab-upload" style="display: none;">
    <div class="row">
      <div>
        <label>Baseline RGB (.png)</label>
        <input type="file" name="pre_rgb" accept="image/png,image/jpeg" required>
      </div>
      <div>
        <label>Baseline SWIR (.png)</label>
        <input type="file" name="pre_swir" accept="image/png,image/jpeg" required>
      </div>
      <div>
        <label>Current RGB (.png)</label>
        <input type="file" name="cur_rgb" accept="image/png,image/jpeg" required>
      </div>
      <div>
        <label>Current SWIR (.png)</label>
        <input type="file" name="cur_swir" accept="image/png,image/jpeg" required>
      </div>
    </div>
    <div class="hint">Drop in 4 Sentinel-2 tiles for the same 5km location. The model expects: image 1 = RGB-baseline (true color, B4-B3-B2), image 2 = SWIR-baseline (false color, B12-B8-B4), image 3 = RGB-current, image 4 = SWIR-current.</div>
    <div style="margin-top: 16px;">
      <button id="run-upload">Assess flood risk</button>
    </div>
  </div>

  <div class="result" id="result">
    <h3>Result</h3>
    <div id="result-content"></div>
  </div>
</main>
<script>
const tabs = document.querySelectorAll('.tab');
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById('tab-simsat').style.display = t.dataset.tab === 'simsat' ? 'block' : 'none';
  document.getElementById('tab-upload').style.display = t.dataset.tab === 'upload' ? 'block' : 'none';
}));

async function loadHealth() {
  try {
    const r = await fetch('/health');
    const j = await r.json();
    const llamaOk = j.ok && j.llama_status === 200;
    document.getElementById('health').innerHTML =
      'llama-server: <span class="' + (llamaOk ? 'ok' : 'bad') + '">' + (llamaOk ? 'up' : 'down') + '</span>' +
      ' · simsat: <span class="' + (j.simsat_up ? 'ok' : 'bad') + '">' + (j.simsat_up ? 'up' : 'down') + '</span>';
    document.getElementById('simsat-url').textContent = j.simsat_url;
  } catch (e) {
    document.getElementById('health').innerHTML = '<span class="bad">backend unreachable</span>';
  }
}
loadHealth();

async function loadLocations() {
  const r = await fetch('/locations');
  const locs = await r.json();
  const sel = document.getElementById('loc');
  for (const l of locs) {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name + ' · ' + l.region;
    sel.appendChild(opt);
  }
  // Default to San Jacinto del Cauca (Cara de Gato breach municipality)
  sel.value = 'san_jacinto_del_cauca';
}
loadLocations();

function badge(text, kind) { return '<span class="badge ' + (kind || '') + '"><span class="dot"></span>' + text + '</span>'; }

function severityKind(sev) {
  return sev === 'severe' ? 'bad' : sev === 'moderate' ? 'warn' : sev === 'minor' ? 'warn' : 'good';
}

function renderResult(payload) {
  const result = document.getElementById('result');
  const div = document.getElementById('result-content');
  if (!payload.ok) {
    div.innerHTML = '<div class="err">' + (payload.error || 'unknown error') + '</div>';
    result.classList.add('shown');
    return;
  }
  const labels = payload.labels;
  let html = '<div class="badges">';
  html += badge('flood ' + (labels.flood_present ? 'present' : 'not present'), labels.flood_present ? 'bad' : 'good');
  html += badge('severity: ' + labels.flood_severity, severityKind(labels.flood_severity));
  html += badge('water: ' + labels.water_coverage_pct_estimate, 'warn');
  if (labels.populated_area_affected) html += badge('populated area affected', 'bad');
  if (labels.infrastructure_at_risk) html += badge('infrastructure at risk', 'bad');
  if (labels.river_overflow_visible) html += badge('river overflow', 'bad');
  if (labels.image_quality_limited) html += badge('image quality limited', 'warn');
  html += '</div>';

  if (payload.images) {
    html += '<div class="grid4">';
    html += '<figure><img src="' + payload.images.pre_rgb + '"><figcaption>baseline RGB</figcaption></figure>';
    html += '<figure><img src="' + payload.images.pre_swir + '"><figcaption>baseline SWIR</figcaption></figure>';
    html += '<figure><img src="' + payload.images.cur_rgb + '"><figcaption>current RGB</figcaption></figure>';
    html += '<figure><img src="' + payload.images.cur_swir + '"><figcaption>current SWIR</figcaption></figure>';
    html += '</div>';
  }
  if (payload.metadata) {
    const m = payload.metadata;
    html += '<div class="meta">' +
      'baseline ' + m.baseline.date + ' (capture ' + (m.baseline.capture_datetime || '?') + ', ' + (m.baseline.cloud_cover ?? '?').toFixed?.(0) + '% cloud) · ' +
      'current ' + m.current.date + ' (capture ' + (m.current.capture_datetime || '?') + ', ' + (m.current.cloud_cover ?? '?').toFixed?.(0) + '% cloud)' +
      '</div>';
  }
  html += '<div class="meta">latency: ' + payload.latency_ms + ' ms</div>';
  html += '<pre>' + JSON.stringify(labels, null, 2) + '</pre>';
  div.innerHTML = html;
  result.classList.add('shown');
}

async function runSimSat() {
  const btn = document.getElementById('run-simsat');
  btn.disabled = true; btn.textContent = 'Fetching from SimSat + asking the model…';
  document.getElementById('result-content').innerHTML = '';
  document.getElementById('result').classList.add('shown');
  document.getElementById('result-content').innerHTML = 'Working… (~10s)';
  try {
    const r = await fetch('/fetch-and-predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location_id: document.getElementById('loc').value,
        baseline_date: document.getElementById('baseline_date').value,
        current_date: document.getElementById('current_date').value,
      }),
    });
    renderResult(await r.json());
  } catch (e) {
    renderResult({ ok: false, error: 'fetch failed: ' + e.message });
  } finally {
    btn.disabled = false; btn.textContent = 'Fetch + assess flood risk';
  }
}

async function runUpload() {
  const btn = document.getElementById('run-upload');
  btn.disabled = true; btn.textContent = 'Asking the model…';
  document.getElementById('result-content').innerHTML = 'Working…';
  document.getElementById('result').classList.add('shown');
  try {
    const fd = new FormData();
    for (const name of ['pre_rgb', 'pre_swir', 'cur_rgb', 'cur_swir']) {
      const inp = document.querySelector('input[name=' + name + ']');
      if (!inp.files[0]) {
        renderResult({ ok: false, error: 'missing file for ' + name });
        return;
      }
      fd.append(name, inp.files[0]);
    }
    const r = await fetch('/predict', { method: 'POST', body: fd });
    renderResult(await r.json());
  } catch (e) {
    renderResult({ ok: false, error: 'fetch failed: ' + e.message });
  } finally {
    btn.disabled = false; btn.textContent = 'Assess flood risk';
  }
}

document.getElementById('run-simsat').addEventListener('click', runSimSat);
document.getElementById('run-upload').addEventListener('click', runUpload);
</script>
</body>
</html>
`

console.log(`▶ humaid flood-detection demo`)
console.log(`  app   : http://localhost:${PORT}`)
console.log(`  llama : ${LLAMA_URL}`)
console.log(`  simsat: ${SIMSAT_BASE_URL}`)
console.log()

Deno.serve({ port: PORT }, app.fetch)
