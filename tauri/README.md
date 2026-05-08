# humaid desktop app — brief for the Tauri team

This folder is the home for the humaid desktop app, to be built with Tauri. Code does not exist yet; this README is the design brief.

## What it is

An offline-first desktop app that runs on a responder's / volunteer's laptop in (or near) a flood-risk community. Two reasons to open it:

1. **"Tell me what to do."** Browse and chat with a curated knowledge base of 471 role-tagged Q&A pairs about disaster response in Colombia (La Mojana wetlands + Putumayo basin).
2. **"Has anything happened?"** The app polls the central website. When a flood alert lands for the region this install was configured for, it pulls the relevant SOPs and surfaces a notification.

It is *not* a frontier-model client. All inference is local. Internet is only used for (a) initial KB sync and (b) polling for alerts.

## Architecture in one picture

```
┌─────────────────────── desktop app (Tauri) ────────────────────────┐
│                                                                    │
│  UI                                                                │
│  ├─ KB browser     (left pane: tree of Q&A by role / phase / region) │
│  ├─ Chat           (right pane: free-form questions, role-aware)   │
│  └─ Alerts         (banner + history when polling finds something) │
│                                                                    │
│  Local services (managed by Tauri sidecar processes):              │
│  ├─ Ollama daemon  ──────  http://localhost:11434                  │
│  │     ├─ nomic-embed-text   (embeddings)                          │
│  │     └─ lfm2 (text)        (answer synthesis, optional v1)       │
│  └─ DuckDB (in-process)   reads bundled kb.duckdb (~2.3 MB)        │
│                                                                    │
│  Local state (SQLite or DuckDB):                                   │
│  ├─ user profile    (role, region, language)                       │
│  ├─ alert history   (polling cursor, last-seen alert id)           │
│  └─ KB sync cursor  (kb.duckdb version + last update timestamp)    │
│                                                                    │
└─────────────────────────┬──────────────────────────────────────────┘
                          │ HTTPS (only when online)
                          ▼
                  humaid website / API
                  ─────────────────────
                  GET /api/kb           → KB stats
                  POST /api/qa          → retrieval (debug / reference)
                  GET /api/alerts/...   → flood alerts (NEW — see below)
```

## Component 1 — Knowledge base browser

**Source data:** `knowledge-base/qa-pairs.csv` and `knowledge-base/kb.duckdb` (2.3 MB, 471 rows × 768-dim Nomic embeddings). Both files are committed in the repo and ship inside the Tauri bundle.

**What the UI shows:** a tree / list view of Q&A pairs, filterable by:

- **role** — `local-community`, `local-authority`, `national-authorities`, `humanitarian-staff`, `ngos`, `first-respondants`
- **phase** — `pre`, `event`, `post` (when the question is most actionable)
- **region** — `la-mojana`, `putumayo`, `generic`
- **topic** — free-tag slug (`early-warning`, `wash`, `evacuation`, `dike-management`, `gbv`, …)

Each row has these fields (treat as the row schema):

```ts
type QaRow = {
  id: string;             // "qa-NNNN"
  role: string;
  phase: "pre" | "event" | "post";
  region: "la-mojana" | "putumayo" | "generic";
  topic: string;
  question_en: string;
  question_es: string;    // both languages live in every row
  answer_en: string;      // 2–6 sentences, concrete + actionable
  answer_es: string;
  references: string;     // pipe-separated source refs
  ref_types: string;      // pipe-separated; values "local" | "cloud"
};
```

The browser is essentially a faceted explorer. Selecting a row opens the full Q&A in a reading pane, with the references list rendered as links (cloud refs open externally; local refs open a bundled file viewer).

The user picks **their role** once at install time — that filter persists and biases everything they see.

## Component 2 — Chat interface

Free-form Q&A. The contract is already implemented on the website at `website/lib/qa.ts:qaSearch()` and exposed at `POST /api/qa`. The desktop app does the same thing locally:

1. User types a question in EN or ES.
2. App calls Ollama at `http://localhost:11434/api/embeddings` with model `nomic-embed-text` to embed the query.
3. App runs a cosine-similarity query against `kb.duckdb`:
   ```sql
   SELECT id, role, phase, region, question_en, answer_en, answer_es, ...
        , array_cosine_similarity(embedding, $query_vec) AS similarity
   FROM qa
   WHERE role = $user_role         -- filter by user profile
   ORDER BY similarity DESC
   LIMIT 3;
   ```
4. Top-k matches are shown directly (V1 acceptable: just show the answers).
5. **V2 enhancement**: synthesize a single natural-language answer by passing top-k context to local `lfm2` (also via Ollama). Prompt template lives at `website/lib/prompts.ts` (mirrors `finetune-flood/src/prompts.ts`) — reuse the schema there.

**Same DuckDB query the website uses.** `@duckdb/node-api` works under Deno; for Tauri, use the Rust [`duckdb` crate](https://crates.io/crates/duckdb) to keep the runtime native. The SQL is identical.

Users with the `local-community` role get answers in `answer_es` by default; users with `humanitarian-staff` / `ngos` may want EN — make the language toggle visible.

## Component 3 — Alert polling

This is the new piece — the website doesn't expose this endpoint yet, so coordinate with the website team. Proposed contract:

```
GET /api/alerts?region=la-mojana&since=<iso8601>
→ {
    alerts: [
      {
        id: "alert-2026-05-08-001",
        timestamp: "2026-05-08T14:22:00Z",
        region: "la-mojana",
        location: "san_jacinto_del_cauca",
        severity: "moderate" | "severe",
        labels: {
          flood_present: true,
          flood_severity: "moderate",
          water_coverage_pct_estimate: "30-60%",
          populated_area_affected: true,
          infrastructure_at_risk: true,
          river_overflow_visible: true,
          image_quality_limited: false
        },
        recommended_qa_ids: ["qa-0042", "qa-0117", "qa-0203"]
      }
    ],
    cursor: "<iso8601 to use as next ?since=>"
  }
```

The 7-key `labels` shape is already canonical — it's what the satellite-side flood model emits. See `finetune-flood/docs/06-deploy-website.md` and `website/lib/prompts.ts:FLOOD_LABEL_SCHEMA`.

**Polling behavior:**

- Configured at install time with one `region` per device (e.g. `la-mojana`).
- Poll every N minutes when online (default 5 min when foregrounded, 30 min when background, configurable).
- Persist `since` cursor in local SQLite so the app never replays the same alert.
- When a new alert arrives:
  1. Show OS-native notification ("Flood alert in La Mojana — moderate severity").
  2. Auto-fetch the `recommended_qa_ids` from the local `kb.duckdb` (already present, no network needed).
  3. Surface them in an "Alert" tab pre-filtered for the user's role.

**Offline graceful degradation.** When offline, polling fails silently; the KB browser + chat keep working. When the user comes back online, the cursor catches up.

## Component 4 — KB sync

The committed `kb.duckdb` is a snapshot. Over time the corpus will grow. The app should periodically (daily, when online) check for an updated KB:

```
GET /api/kb/version  → { version: "2026-05-08", size_bytes: 2384921, sha256: "..." }
GET /api/kb/download → binary kb.duckdb (full file; corpus is small)
```

If the version is newer than the bundled one, download to a side-by-side path and atomically swap. Don't rebuild the index locally — the website ships the rebuilt one.

## Stack notes

- **Tauri** — single-binary install, ~10 MB shell. The framework's webview is fine for the UI.
- **Ollama as a sidecar.** Tauri can spawn / supervise the Ollama daemon. Bundle the binary or detect a user-installed one. Pull `nomic-embed-text` (~270 MB) on first run with a progress indicator. `lfm2` for synthesis is optional in V1.
- **DuckDB** via the Rust crate — read-only access to the bundled `kb.duckdb`.
- **Local state**: SQLite (Tauri has a plugin) or another DuckDB file. Up to you.
- **UI framework** inside the webview: React, Solid, Svelte — pick what's fastest for your team. The website's `client/chat.tsx` is React; you can crib the chat layout but **don't share runtime code** — the desktop app talks to local services, not website APIs, for all inference.

## What to coordinate with the website team

These are the open API contracts the desktop app needs that *don't yet exist on the website*:

1. `GET /api/alerts?region=&since=` — the alert polling endpoint above. Currently `website/main.tsx` only has `/api/qa`, `/api/flood`, `/api/kb`, `/api/health`, `/api/chat`. **Adding `/api/alerts` is on the website team.**
2. `GET /api/kb/version` and `GET /api/kb/download` — KB sync endpoints. Same: not built yet.
3. The format of `recommended_qa_ids` and how alerts get tagged with KB pair IDs — the satellite model emits the 7-key labels JSON, but mapping that to "which Q&A rows are relevant" is a server-side rule the website team needs to implement.

## Reference files in this repo

- `../website/main.tsx` — Hono routes, eager-init pattern, multipart vs JSON routing.
- `../website/lib/qa.ts` — the canonical retrieval function. Port the SQL to Rust + `duckdb` crate.
- `../website/lib/ollama.ts` — Ollama daemon supervision pattern (sidecar lifecycle).
- `../website/client/chat.tsx` — reference UI for the chat tab.
- `../knowledge-base/README.md` — full schema, role/phase/region semantics, how the corpus was built.
- `../knowledge-base/qa-pairs.csv` — the 471 rows in source form.
- `../knowledge-base/kb.duckdb` — the embedded index (ship this in the Tauri bundle).
- `../docs/ARCHITECTURE.md` — the full two-systems story; Parts 2 + 4 are the relevant ones for the desktop app.

## Building for Android

Tauri Mobile reuses the same Rust crate + React UI, so 95 % of the code is shared with desktop. The only platform-specific divergences are inside `src-tauri/src/`:

- **Resources are embedded, not bundled.** `kb.duckdb` and the `research/*.md` files are baked into the Rust binary via `include_bytes!` / `include_dir!` (see `src-tauri/src/assets.rs`) and staged to `app_data_dir()` on first launch. This sidesteps Android's AssetManager — `std::fs` and the `duckdb` crate just see a normal file path. Adds ~3.5 MB to the binary; worth it.
- **No Ollama on Android.** The `qa_search` command tries the local Ollama daemon first, and if that fails (always on Android), it transparently falls back to `POST https://humaid.app/api/qa` — same engine running server-side. Chat works online; KB and Documents work offline.
- **Mobile UI.** All major layouts (header, Documents, Alerts, Chat) collapse to single-column with a bottom tab bar at `<768px`. List/detail views use a push-stack pattern with a back arrow.

### Prerequisites

```bash
# Android Studio with SDK + NDK + cmdline-tools
# Then in your shell:
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk | tail -1)"

# Rust Android targets
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

### Run on emulator or device

```bash
# Start an emulator from Android Studio Device Manager, or plug a phone in (USB debugging on)
cd humaid/tauri
deno install
deno task tauri android dev
```

First build cross-compiles DuckDB + ~400 crates and takes 5–10 min. Subsequent runs are fast. The app stages assets to `/data/data/co.datasketch.humaid/files/` on first launch (you'll see `staged kb.duckdb (2895872 bytes)` in `adb logcat`).

### Release APK / AAB

```bash
deno task tauri android build
# APKs in src-tauri/gen/android/app/build/outputs/apk/
# AAB  in src-tauri/gen/android/app/build/outputs/bundle/
```

### Common gotchas

- **DuckDB cross-compile errors.** Make sure `NDK_HOME` is set and points at NDK 25+. If `cmake` complains, try `rustup default stable && cargo clean` and rebuild.
- **Mapbox token on Android.** `VITE_MAPBOX_TOKEN` is read from the Vite environment when the dev server starts. Set it in your shell before `deno task tauri android dev`. Without it, the offline SVG map is shown.
- **HTTP cleartext on emulator.** The manifest already enables `usesCleartextTraffic` for dev builds so `http://tauri.localhost/` (Vite) loads. Production builds use `https://` for any external requests.
- **Notifications.** Already wired via `tauri-plugin-notification`. Android prompts for the runtime POST_NOTIFICATIONS permission on first alert.

## Out of scope for V1

- The flood-detection (vision) model. That runs on the satellite, not on the laptop. The desktop app *consumes* alerts; it doesn't run llama-server or load any GGUF.
- Real-time peer-to-peer between desktop apps. Polling is enough.
- iOS. Tauri Mobile supports it but the toolchain (Xcode + signing identities) is a separate dance.
