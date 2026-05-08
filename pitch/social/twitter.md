# Twitter copy bank — humaid

Drafts for X / Twitter. Two main angles:
1. **Why humaid matters** — the project, the Colombia case, the partnership stack.
2. **Why local models matter** — the technical and political argument for on-device / on-orbit AI in humanitarian contexts.

Each tweet has a character count after it. Threads are numbered `1/N`. Edit voice freely.

---

## A · Single-tweet hooks — why humaid matters

### A1 · The Zenú irony (historical opener)

> La Mojana was home to the Zenú. For 2,000 years they ran one of the most advanced hydraulic systems in pre-Columbian America — canals and *camellones* across 500,000 hectares. They embraced the floods.
>
> Today the dike that replaced them breaks every year.
>
> humaid. *(280 chars)*

### A2 · The information-bound claim

> Humanitarian flood response is information-bound, not resource-bound.
>
> The knowledge to save lives already exists — in hundreds of PDFs nobody has time to read in an emergency.
>
> humaid is the rail to deliver it. *(220 chars)*

### A3 · The 5-disconnect summary

> Risk maps in GIS jargon nobody reads. 314-page PDFs nobody searches. Cloud imagery that arrives days late. Numerical alerts that don't translate to action. A network that goes down with the power.
>
> Five disconnects. Same lessons re-learned every La Niña cycle. *(279 chars)*

### A4 · Cara de Gato (specific, recent)

> The Cara de Gato dike in San Jacinto del Cauca, Bolívar.
>
> Broken: Aug 2021. May 2024. Aug 2025.
>
> Each break: months of flooding, hundreds of communities displaced, the same WASH gaps re-discovered.
>
> The lessons are in the reports. The reports are unreachable. *(275 chars)*

### A5 · Mocoa anniversary tone

> Night of 31 March 2017, Mocoa, Putumayo.
>
> 335 dead. 57 disappeared. 17 barrios destroyed by an *avenida torrencial* whose precursors were known.
>
> The early-warning signal existed. It didn't reach the families in time.
>
> That delivery gap is the work. *(264 chars)*

### A6 · Partnership stack (the "not a research bet" tweet)

> humaid:
> · NASA Lifelines program
> · UN Colombia partner on AI governance
> · Indigenous water-rights organisations in Putumayo co-designing the build
> · NGO field implementers ready to deploy
>
> The technical pieces are built. The partners are at the table. *(269 chars)*

### A7 · The Zenú-modernity loop

> The Zenú lost their hydraulic literacy in three centuries.
>
> We have satellites, SAR, small VLMs, open data, and offline-first compute.
>
> What's missing is the rail that delivers the knowledge in time. We're building it.
>
> humaid · NASA Lifelines · UN Colombia *(269 chars)*

### A8 · The "PDF problem" punchy version

> The lessons of Mocoa 2017 are written down. So are the lessons of La Mojana 2021.
>
> They are written down in hundreds of pages of PDFs.
>
> When the dike breaks at 2 a.m., the JAC president can't search them.
>
> humaid: same knowledge, role-tagged, offline. *(269 chars)*

---

## B · Single-tweet hooks — why local models matter

### B1 · The one-liner that does the work

> The flood is destroying the network the cloud LLM lives on.
>
> Run the model on the device. *(89 chars)*

### B2 · Bandwidth math

> A Sentinel-2 tile: 5–20 MB.
> A flood-alert JSON: ~200 bytes.
>
> Same information density. Five orders of magnitude less downlink.
>
> If the model is on the satellite, you ship the answer, not the question.
>
> Why local models matter. *(245 chars)*

### B3 · The cost-at-scale point

> Per-orbit flood inference for one region:
> · GPT-5 API: thousands of dollars
> · Local 450M VLM on the satellite: zero marginal cost
>
> Frontier APIs solve the prototype. Local models solve the deployment. *(215 chars)*

### B4 · Latency

> 0.5s local on a 450M VLM.
> 3–5s round-trip to a frontier API.
>
> 7× faster matters when you're trying to get a flood alert out in the first 10 minutes. *(166 chars)*

### B5 · Sovereignty / privacy

> Census of displaced families. Locations of indigenous communities. Photos of damaged homes.
>
> This data should not leave the device.
>
> Local models aren't a performance choice. They're a sovereignty choice. *(218 chars)*

### B6 · Energy / form factor

> A frontier model needs a data center.
> A CubeSat has 5W of compute.
>
> The model that runs on the satellite is the model the satellite can run.
>
> 450M params. 450 MB on disk. Lives in orbit, not in AWS. *(212 chars)*

### B7 · The disaster-resilience argument

> Cloud-first AI assumes the network works.
> Disasters break the network.
>
> Disaster-response AI must be local.
>
> This is not a preference. It is a definition. *(168 chars)*

### B8 · The Ollama / llama.cpp split-runtime story

> Two AI systems on humaid:
> · Satellite: llama.cpp + LFM2.5-VL-450M (vision, mmproj)
> · Laptop: Ollama + LFM2 (text) + Nomic (embeddings)
>
> Both local. Different runtimes for different physics: orbit vs offline laptop.
>
> Same constraint underneath. *(280 chars)*

### B9 · The "your phone with no signal" framing

> The win condition for humanitarian AI:
>
> "How do I evacuate?" — answered in 10 seconds, in plain Spanish, with citations to a real source, on a phone with no signal.
>
> No frontier model in a data center can do this.
>
> Local + grounded + small. *(257 chars)*

### B10 · Citations + grounded retrieval

> Local models become trustworthy when they retrieve before they answer.
>
> humaid: 471 source-cited Q&A pairs, embedded with Nomic, queried via DuckDB cosine, all on the laptop.
>
> Every answer has a citation back to the original PDF. *(252 chars)*

### B11 · "Onboard inference" punchline

> What if we did it on the satellites themselves?
>
> Then we'd ship the alert, not the imagery.
> Then bandwidth stops being the bottleneck.
> Then the data center stops being the dependency.
>
> humaid puts a 450M VLM in orbit. *(228 chars)*

### B12 · Counter to "just call GPT-5"

> "Why not just call GPT-5?"
>
> Because:
> · the satellite can't reach a data center
> · the responder doesn't have signal
> · the displaced family's data shouldn't be uploaded
> · the per-orbit inference bill would be five figures
>
> Local. Small. Grounded. *(258 chars)*

---

## C · Threads

### Thread C1 — Why local models matter for humanitarian AI (5 tweets)

**1/5**
> Cloud-based AI assumes the network works.
> Disasters break the network.
>
> So when we built humaid — an offline-first humanitarian-response toolkit for floods in Colombia — we made every model local. Here's why local models actually matter, not as a vibe but as physics. *(292 → trim)*

(Trim to:)
> Cloud-based AI assumes the network works.
> Disasters break it.
>
> When we built humaid — offline-first flood response for Colombia — every model is local. Why local matters, not as vibe but as physics. 1/5 *(220 chars)*

**2/5**
> Bandwidth.
>
> A Sentinel-2 satellite tile is 5–20 MB. A flood-alert JSON is ~200 bytes.
>
> Run the model on the satellite, you ship the answer, not the question. Five orders of magnitude less downlink. The orbit-to-ground link is the bottleneck — local inference removes it. 2/5 *(279 chars)*

**3/5**
> Latency and cost.
>
> 0.5s local on a 450M VLM. 3–5s on a frontier API.
> Per-orbit inference for one region: ~$0 local vs thousands on API.
>
> Prototypes survive on frontier APIs. Deployments don't. 3/5 *(212 chars)*

**4/5**
> Sovereignty.
>
> Displaced-family censuses. Locations of indigenous communities. Photos of damaged homes.
>
> That data has no business in someone else's data center. Local models are a sovereignty choice as much as a technical one. 4/5 *(231 chars)*

**5/5**
> Trust.
>
> Local models become reliable when they retrieve before they answer.
>
> humaid: 471 source-cited Q&A pairs, embedded with Nomic, queried via DuckDB on the laptop, every answer cites the original PDF.
>
> Local + grounded + small. That's the recipe. 5/5 *(269 chars)*

### Thread C2 — humaid project announcement (6 tweets)

**1/6**
> Today: humaid.
>
> An offline-first humanitarian-response toolkit for floods in Colombia, built around the constraint that every system you'd normally rely on — internet, cell signal, power, the cloud — fails exactly when the flood hits. 1/6 *(243 chars)*

**2/6**
> The problem isn't a knowledge gap. It's a delivery gap.
>
> The lessons of Mocoa 2017 and La Mojana 2021 are documented. They are documented in hundreds of pages of PDFs that nobody can search at 2 a.m. when the dike breaks. 2/6 *(232 chars)*

**3/6**
> The architecture, in three parts:
> · A small VLM on a satellite, turning imagery into a 200-byte JSON alert
> · A community sync station receiving alerts and hosting the knowledge base on its local network
> · A desktop / mobile app that works offline once pre-synced 3/6 *(280 chars)*

**4/6**
> The knowledge layer:
> 471 bilingual (EN/ES) Q&A pairs distilled from 17 source PDFs, role-tagged (community, authority, NGO, first-responder), phase-tagged (pre / event / post), region-tagged (La Mojana / Putumayo / generic).
>
> Every answer cites its source. 4/6 *(280 chars)*

**5/6**
> The partnerships:
> · NASA Lifelines program affiliation
> · United Nations in Colombia — partnership on their data and AI governance strategy
> · Indigenous water-rights organisations in Putumayo, co-designing on their territory
> · NGO field implementers in La Mojana 5/6 *(280 chars)*

**6/6**
> Colombia is the launch site, not the destination.
>
> The architecture is hazard-agnostic, region-agnostic, language-agnostic. La Mojana and Putumayo first; the next 50 flood-exposed regions on Earth after.
>
> humaid → humaid.app 6/6 *(245 chars)*

### Thread C3 — The Zenú lens (4 tweets, more poetic)

**1/4**
> Before the conquest, La Mojana was civilised.
>
> The Zenú built canals and *camellones* across 500,000 hectares. They moved water through the landscape in the wet season, stored it in the dry. The system supported hundreds of thousands of people for two thousand years. 1/4 *(280 chars)*

**2/4**
> Then the system was lost.
>
> Three centuries of disconnection silted up the canals, broke the drainage logic, and inverted the relationship: build dikes that try to keep water out, instead of channels that move it through.
>
> The Cara de Gato dike, today, is the symbol. 2/4 *(272 chars)*

**3/4**
> The Zenú had no satellites. They had landscape literacy delivered by living in the landscape.
>
> We have the satellites and the SAR and the AI. What we don't have is a way to deliver the knowledge to the wetland.
>
> humaid is one attempt to close that loop. 3/4 *(263 chars)*

**4/4**
> Modern technology, ancient instinct.
>
> Process the flood in space. Answer the questions on the ground. Don't fight the water — get the knowledge to the people who already live with it.
>
> humaid · NASA Lifelines · UN Colombia · Indigenous water-rights orgs in Putumayo 4/4 *(280 chars)*

### Thread C4 — Two AI systems, one constraint (5 tweets, technical audience)

**1/5**
> humaid runs two AI systems on purpose. One in orbit. One on a laptop. Different runtimes. Same constraint underneath: no internet between them.
>
> Here's why that split exists. 1/5 *(184 chars)*

**2/5**
> System A — the satellite-side detector.
> · LFM2.5-VL-450M, fine-tuned on La Mojana / Putumayo events
> · Runs under llama.cpp (the only thing that loads multimodal LFM2 with mmproj)
> · 4 PNGs in (RGB+SWIR, baseline+current), 7-key JSON out (~200 bytes) 2/5 *(279 chars)*

**3/5**
> System B — the laptop-side knowledge base.
> · LFM2 (text) + Nomic (embeddings) under Ollama (one-binary install for non-technical users)
> · DuckDB index over 471 role-tagged Q&A pairs, 2.3 MB on disk
> · Sub-second cosine retrieval. No GPU assumed. 3/5 *(266 chars)*

**4/5**
> Why two runtimes?
>
> · llama.cpp loads VLMs correctly with mmproj. Ollama can't. So orbit = llama.cpp.
> · Ollama is the cleanest install path on macOS / Windows / Linux. So laptop = Ollama.
>
> Same architectural premise: local + small + grounded. 4/5 *(259 chars)*

**5/5**
> The point isn't "local models good." The point is: when the user is in a flood, the network is down, the satellite passes overhead, and the model has to be wherever the compute survives.
>
> Different physics, different runtimes, same answer. 5/5 *(257 chars)*

---

## D · Hashtags & handles to consider

When relevant, tag:
- `@NASA` (Lifelines program affiliation)
- `@UNColombia` / `@unocha`
- `@LiquidAI_` (LFM2.5-VL is theirs)
- `@CopernicusEU` / `@CopernicusEMS` / `@UNOSAT`
- `@IDEAMColombia` / `@UNGRDColombia`

Hashtags (use sparingly, max 2 per tweet):
- `#humaid`
- `#OpenSourceAI`
- `#LocalAI`
- `#EdgeAI`
- `#HumanitarianTech`
- `#DRR` (disaster risk reduction)
- `#EarthObservation`
- `#NASA #Lifelines`
- `#LaMojana #Putumayo` (Spanish-audience reach)
- `#OnboardAI` / `#SatelliteAI`

---

## E · Visuals to pair with tweets

In `pitch/images/`:
- `la-mojana-map-position.jpeg` — for any "where" tweet
- `la-mojana-current-state-poorly-managed.png` — pairs with chronic-crisis tweets (A4, A5)
- `lamojana-ancient-hydaulic.jpeg` — pairs with Zenú tweets (A1, A7, C3)
- `la-mojana-ancient-canals.jpeg` — same

Architecture diagram from `docs/ARCHITECTURE.md` (the SPACE → EARTH ASCII block) renders well as a screenshot for any technical tweet (B8, C2/3, C4/2).

---

## F · Voice notes

- **Specific over abstract.** Names: Cara de Gato, Mocoa, Cauca, Putumayo, Zenú, NASA Lifelines, UN Colombia, IDEAM, UNGRD, San Jacinto del Cauca. Numbers: 335 dead, 200 bytes, 471 Q&A, 450 MB, 0.5s.
- **No hype words.** Skip "revolutionary", "game-changing", "AI-powered". Earn the claim with the spec.
- **Spanish phrases land in EN-language tweets.** *avenida torrencial*, *zona ribereña*, *campesino*, *jarillón*. Keeps it grounded in place.
- **Short closes.** "humaid." or "Why local models matter." End cleanly.
- **One claim per tweet.** Never two arguments in one. Use threads.
