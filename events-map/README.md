# events-map

> **Sample showcase.** This folder is a self-contained demo we will embed in the project website. It pulls the flood event anchors out of `finetune-flood/src/{events,locations}.ts`, joins them into a small geo-database, and renders the result on a Mapbox map. The point is to make the historical event record — the same record the model is being trained against and that the [`knowledge-base/`](../knowledge-base/) Q&A draws on — legible at a glance: where things happened, when, and what was affected. It is a sketch, not the final product.

Static viewer for the Colombia flood-event anchors used by `finetune-flood/` to pull Sentinel-2 training tiles. Each location is a Point on a Mapbox map with the list of events that affected it; you can filter by region, event, and year.

## Files

```
events-map/
├── build.ts                       Deno script — joins finetune-flood/src/locations.ts
│                                  and events.ts into the database files below.
├── data/
│   ├── events.json                flat (event × location) rows — 55 entries.
│   ├── events.csv                 same data as csv (sqlite/spreadsheet import).
│   └── locations.geojson          one Point per location with attached events
│                                  (consumed by index.html).
├── index.html                     Mapbox GL JS viewer.
└── README.md
```

The flat schema is:

| field | example |
|---|---|
| event_id | `cara_de_gato_2024` |
| date | `2024-05-06` |
| description | `Cara de Gato breach #2 (after Feb 2024 rebuild)` |
| region | `la_mojana` \| `putumayo` |
| location_id | `san_jacinto_del_cauca` |
| location_name | `San Jacinto del Cauca, Bolívar` |
| municipality | `San Jacinto del Cauca` |
| department | `Bolívar` |
| lon | `-74.7167` |
| lat | `8.25` |

## Regenerate the database

After editing `finetune-flood/src/events.ts` or `locations.ts`:

```bash
deno run -A build.ts
```

## Run the map

The page is a single static HTML file — no build, no server needed beyond a static file server (it uses `fetch` so `file://` won't work in most browsers).

```bash
# any static server works; here are two
python3 -m http.server 8000
# or
deno run --allow-net --allow-read jsr:@std/http/file-server --port 8000
```

Then open <http://localhost:8000>.

## Mapbox token

The HTML expects a public Mapbox token (`pk.*`). Three options, any one works:

1. Replace `MAPBOX_TOKEN` in `index.html` with your token.
2. Append `?token=pk.your-token` to the URL.
3. In the browser devtools console: `localStorage.setItem('mapboxToken', 'pk.your-token')` and reload.

You can get a token at <https://account.mapbox.com/access-tokens/>.

## What the map shows

- **Blue circles** — La Mojana anchor municipalities (8). Circle size scales with the number of events on file at that location.
- **Orange circles** — Putumayo anchor municipalities (6).
- **Click** a circle to see the events at that location.
- **Sidebar** lets you filter by region, event, and year, and lists the matching events; clicking an event flies the camera to its location.

## Backing data sources

These coordinates and event dates come from `research/flood-tagging-and-reference-points.md`, which was distilled from the OCHA, UNGRD, ACAPS, CERF, and academic reports under `research/download-md/`.
