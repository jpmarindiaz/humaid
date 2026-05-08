/** @jsxImportSource hono/jsx */
// Landing page — server-rendered Hono JSX, custom CSS in /static/landing.css.
// All copy and imagery sourced from ../pitch/.

import type { FC } from "hono/jsx";

export const Landing: FC = () => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>humaid — offline-first flood-response toolkit</title>
      <meta name="description" content="Process the flood in space. Answer the questions on the ground. An offline-first humanitarian-response toolkit for flood crises in Colombia." />
      <meta property="og:title" content="humaid — offline-first flood-response toolkit" />
      <meta property="og:description" content="Process the flood in space. Answer the questions on the ground." />
      <meta property="og:image" content="/assets/la-mojana-ancient-canals.jpeg" />
      <link rel="stylesheet" href="/static/landing.css" />
    </head>
    <body>

      <header class="nav">
        <a class="brand" href="#top">
          <span class="dot"></span>
          <span>humaid</span>
        </a>
        <nav>
          <a href="#problem">Problem</a>
          <a href="#solution">Solution</a>
          <a href="#zenu">Zenú</a>
          <a href="#why-now">Why now</a>
          <a href="#built">Built</a>
          <a href="/app" class="nav-cta">Live demo</a>
        </nav>
      </header>

      <main id="top">

        <section class="hero">
          <div class="hero-inner">
            <p class="eyebrow">Colombia · La Mojana · Putumayo</p>
            <h1>
              Process the flood in space.<br />
              Answer the questions on the&nbsp;ground.
            </h1>
            <p class="lede">
              Humanitarian flood response is information-bound, not resource-bound.
              The knowledge to save lives already exists in hundreds of PDFs that
              nobody can read in an emergency.
            </p>
            <p class="lede strong">
              humaid puts a small AI on a satellite to spot the flood, sends a
              tiny alert to ground, and unlocks a pre-synced, role-specific Q&amp;A
              on a local device that works without internet.
            </p>
            <div class="hero-ctas">
              <a class="btn primary" href="/app">Try both demos →</a>
              <a class="btn ghost" href="#solution">How it works</a>
            </div>
            <p class="hero-demos">
              Two live model systems on this page:{" "}
              <a href="/app">ask the knowledge base</a> (471 bilingual Q&amp;A pairs ·
              Nomic + DuckDB) or <a href="/app">run flood detection</a> on a
              before/after Sentinel-2 pair (fine-tuned LFM2-VL-450M).
            </p>
            <ul class="hero-stats">
              <li><strong>471</strong><span>bilingual Q&amp;A pairs</span></li>
              <li><strong>17</strong><span>source PDFs indexed</span></li>
              <li><strong>~200 B</strong><span>alert payload size</span></li>
              <li><strong>0</strong><span>internet required, post-sync</span></li>
            </ul>
          </div>
        </section>

        <section id="problem" class="section problem">
          <div class="section-head">
            <p class="kicker">The problem</p>
            <h2>Five disconnects between the knowledge and the people who need it</h2>
            <p class="dek">
              The information exists. The technology exists. People still drown,
              lose their homes, and re-learn the same lessons every cycle. The gap
              isn't knowledge — it's <em>delivery</em>.
            </p>
          </div>
          <ol class="disconnects">
            <li>
              <span class="num">01</span>
              <h3>Risk maps speak a language no one in the wetland reads</h3>
              <p>UNGRD, IDEAM, the World Bank and Copernicus produce hazard atlases in GIS, SAR and hydraulic-modelling jargon. A campesino in Caimito or a JAC president in Sincelejito can't use them.</p>
            </li>
            <li>
              <span class="num">02</span>
              <h3>Responders can't search 314-page PDFs in a crisis</h3>
              <p>The lessons of Mocoa 2017 and La Mojana 2021 are written down — in hundreds of pages of reports. So WASH gaps get re-discovered, triage protocols get improvised, the same lesson is re-learned every cycle.</p>
            </li>
            <li>
              <span class="num">03</span>
              <h3>Cloud-based satellite imagery arrives days late</h3>
              <p>La Mojana is &gt;50% cloud-cover during the wet season. The bandwidth from satellite to data centre to response team is the bottleneck. By the time the imagery is processed centrally, the actionable window is gone.</p>
            </li>
            <li>
              <span class="num">04</span>
              <h3>Numerical alerts don't translate to human actions</h3>
              <p>"Río Putumayo nivel crítico 11.5 m" tells the IDEAM duty officer something. It tells the family in the zona ribereña nothing — about whether to leave, with what, where the albergue is, who to call.</p>
            </li>
            <li>
              <span class="num">05</span>
              <h3>The network goes down with the power</h3>
              <p>Cell towers fail, internet drops, roads cut — exactly when the most actionable decisions are being made. Cloud dashboards and web portals are unreachable in the first 6–72 hours.</p>
            </li>
          </ol>
        </section>

        <section id="solution" class="section solution">
          <div class="section-head">
            <p class="kicker">The solution</p>
            <h2>Three components that close the loop — and keep working when the network goes down</h2>
          </div>

          <div class="diagram">
<pre>{`                             SPACE
              ┌─────────────────────────────┐
              │  small VLM on satellite     │
              │  (LFM2.5-VL-450M, ~450 MB)  │
              │  Sentinel-2 / Sentinel-1    │
              │  image  →  ~200 B JSON      │
              └──────────────┬──────────────┘
                             │
                             ▼
   ┌─────────────────────── EARTH ─────────────────────────┐
   │  ┌─────────────┐         ┌──────────────────────┐     │
   │  │ Community   │ offline │ Local app            │     │
   │  │ station     │  LAN    │ - role-personalised  │     │
   │  │ (sync hub)  │ ◄────►  │ - phase-aware        │     │
   │  │             │         │ - region-specific    │     │
   │  └─────────────┘         │ - works offline      │     │
   │                          └──────────────────────┘     │
   └───────────────────────────────────────────────────────┘`}</pre>
          </div>

          <div class="components">
            <article>
              <p class="step">01</p>
              <h3>Onboard satellite inference</h3>
              <p>A 450 MB vision-language model fine-tuned on Colombian flood events runs on the satellite itself. It ingests Sentinel-1 SAR + Sentinel-2 imagery onboard and emits a ~200-byte JSON alert instead of downlinking the raw tile.</p>
              <ul>
                <li>No central data centre in the loop — alert reaches ground next overpass</li>
                <li>SAR sees through cloud cover that defeats optical imagery</li>
                <li>No per-tile cloud bill; runs on compute already in orbit</li>
              </ul>
            </article>
            <article>
              <p class="step">02</p>
              <h3>Community station — offline-first sync</h3>
              <p>A solar-tolerant Raspberry-class node at a school, clinic, JAC or alcaldía. Receives JSON alerts via radio, satellite link or SMS gateway; serves the synced knowledge base over local Wi-Fi.</p>
              <ul>
                <li>Pre-synced before the crisis with the content that's hard to reach mid-event</li>
                <li>Past incident reports for <em>this exact location</em></li>
                <li>Evacuation routes, albergue assignments, cluster contacts</li>
              </ul>
            </article>
            <article>
              <p class="step">03</p>
              <h3>Local app — role × phase × region</h3>
              <p>Phone, tablet, or laptop client. Works without any network once pre-synced. The same JSON alert routes to a different first screen based on who you are and where you live.</p>
              <ul>
                <li>A community leader sees triage, shelter, AHE registration</li>
                <li>A municipal official sees Ley 1523 triggers, EDAN forms</li>
                <li>A Cruz Roja responder sees swift-water gates, manejo de cadáveres</li>
                <li>Every answer cites the source PDF — accountability stays intact</li>
              </ul>
            </article>
          </div>

          <div class="solution-cta">
            <div class="solution-cta-text">
              <p><strong>Both systems are running on this page.</strong></p>
              <p>
                The knowledge base side uses Ollama + Nomic embeddings + DuckDB
                cosine search — the same stack that runs on a Raspberry Pi at
                a community station.
              </p>
              <p>
                The flood-detection side runs the fine-tuned LFM2-VL-450M
                directly via llama.cpp — the same compact build we want to
                run on a CubeSat.
              </p>
            </div>
            <a class="btn primary" href="/app">Open the demos →</a>
          </div>
        </section>

        <section id="zenu" class="section zenu">
          <div class="zenu-inner">
            <div class="zenu-text">
              <p class="kicker">The Zenú already solved this — once</p>
              <h2>500,000 hectares. 2,000 years. Then it was forgotten.</h2>
              <p>
                La Mojana is a 500,000-hectare wetland in northern Colombia where
                the Cauca, San Jorge and Magdalena rivers meet. For roughly two
                millennia before the Spanish arrived, it was home to the
                <strong> Zenú </strong>— pre-Columbian hydraulic engineers whose
                canal-and-camellón system <em>embraced</em> the seasonal floods
                rather than fighting them.
              </p>
              <p>
                The faint herringbone patterns still visible from satellites today
                are theirs. So is the population estimated in the hundreds of
                thousands — denser than today.
              </p>
              <p>
                Then European contact, depopulation and centuries of neglect
                collapsed the system. The drainage logic was forgotten. By the
                20th century, the response had inverted: <em>build dikes that try
                to keep water out</em> instead of channels that move it through.
                The Cara de Gato dike has broken in 2021, 2024 and 2025.
              </p>
              <p class="pull">
                The Zenú had landscape-literacy delivered by living in the
                landscape. We won't get that back. But we can build a system that
                delivers an analogous form of literacy — fast, verified, localised
                — through a pipeline that doesn't depend on the very
                infrastructure floods destroy.
              </p>
            </div>
            <div class="zenu-images">
              <figure>
                <img src="/assets/la-mojana-ancient-canals.jpeg" alt="Zenú canal remnants visible from above" />
                <figcaption>Zenú canal remnants — visible from above, still etched into the landscape.</figcaption>
              </figure>
              <figure>
                <img src="/assets/lamojana-ancient-hydaulic.jpeg" alt="Reconstruction of the Zenú hydraulic system" />
                <figcaption>The hydraulic system: canals + camellones across 500,000 ha.</figcaption>
              </figure>
              <figure>
                <img src="/assets/la-mojana-current-state-poorly-managed.png" alt="Contemporary La Mojana under chronic flooding" />
                <figcaption>Today: chronic flooding under a dike-failure regime. Cara de Gato has broken in 2021, 2024 and 2025.</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section id="why-now" class="section why-now">
          <div class="section-head">
            <p class="kicker">Why now</p>
            <h2>Three curves crossed in 24 months. A fourth makes it urgent.</h2>
          </div>
          <div class="why-grid">
            <div class="why-table">
              <div class="why-row head"><div></div><div>2023</div><div>2026</div></div>
              <div class="why-row">
                <div>VLM size for visual reasoning</div>
                <div>8B+ params, data-centre only</div>
                <div><strong>450M params, runs on a CubeSat</strong></div>
              </div>
              <div class="why-row">
                <div>SAR coverage of La Mojana</div>
                <div>Available but unprocessed</div>
                <div><strong>Operational EO services with UNGRD</strong></div>
              </div>
              <div class="why-row">
                <div>Local retrieval cost</div>
                <div>Cloud vector DB only</div>
                <div><strong>$100 device, no internet</strong></div>
              </div>
              <div class="why-row">
                <div>Climate stressor</div>
                <div>La Niña 2021-23 just started</div>
                <div><strong>Cumulative damage; El Niño 2026 incoming</strong></div>
              </div>
              <div class="why-row">
                <div>Policy attention</div>
                <div>Limited</div>
                <div><strong>Procuraduría intervention; Tribunal order</strong></div>
              </div>
            </div>
            <aside class="why-aside">
              <p class="urgent">The next event is not hypothetical.<br />It is on the calendar.</p>
              <ul>
                <li>IDEAM forecasts El Niño 2026 onset</li>
                <li>UNGRD has issued <em>Circular 028 de 2026</em> for preparedness</li>
                <li>Procuraduría ordered special intervention into La Mojana, Sept 2025</li>
                <li>2025 Putumayo rainy season hit modern records</li>
              </ul>
            </aside>
          </div>
        </section>

        <section id="built" class="section built">
          <div class="section-head">
            <p class="kicker">Traction</p>
            <h2>This is not a slide deck. It's a working set of components.</h2>
          </div>
          <div class="built-grid">
            <article>
              <header>
                <span class="tag ready">Ready</span>
                <h3>Research corpus</h3>
              </header>
              <p class="big">17 PDFs · ~60 MB</p>
              <p>OCHA, UNGRD, ACAPS, CERF, FAO, IASC, UNICEF, IOM, IISD, SIDA, UNAL — all mirrored as searchable markdown. Plus ~80 curated external sources by theme.</p>
            </article>
            <article>
              <header>
                <span class="tag ready">Ready</span>
                <h3>Knowledge base</h3>
              </header>
              <p class="big">471 Q&amp;A pairs</p>
              <p>Bilingual EN/ES, role × phase × region tagged, source-cited. Built by 6 parallel agents in ~16 minutes wall time. Local sub-second retrieval via Nomic + DuckDB.</p>
            </article>
            <article>
              <header>
                <span class="tag paused">Pipeline built</span>
                <h3>Satellite fine-tune</h3>
              </header>
              <p class="big">LFM2.5-VL-450M</p>
              <p>Full Modal H100 fine-tuning pipeline in Deno/TypeScript. Anthropic auto-labeller. 14 anchor locations, 9 events, ~115 paired samples. Sentinel-1 SAR re-attempt is a 2-week swap.</p>
            </article>
            <article>
              <header>
                <span class="tag ready">Demo</span>
                <h3>Events showcase</h3>
              </header>
              <p class="big">55-row geo-database</p>
              <p>Static Mapbox viewer joining locations × events for La Mojana and Putumayo. JSON / CSV / GeoJSON export.</p>
            </article>
          </div>
        </section>

        <section class="section contact">
          <div class="contact-inner">
            <p class="kicker">The ask</p>
            <h2>USD 250–350K · Year 1 · 14 anchor municipalities</h2>
            <p class="dek">
              Funding, partnerships, and first-pilot access to take humaid from
              working prototype to deployed system before the next ENSO cycle.
            </p>
            <div class="contact-cta">
              <p>If any of this resonates — start with a 30-minute working call. We'll show the components live and walk through the architecture.</p>
              <a class="btn primary big" href="mailto:hello@humaid.org">hello@humaid.org</a>
            </div>
          </div>
        </section>

      </main>

      <footer>
        <div class="footer-inner">
          <div>
            <p class="brand-foot"><span class="dot"></span> humaid</p>
            <p>Offline-first humanitarian-response toolkit for flood crises.</p>
          </div>
          <nav>
            <a href="#problem">Problem</a>
            <a href="#solution">Solution</a>
            <a href="#zenu">Zenú</a>
            <a href="#built">What's built</a>
            <a href="/app">Live demo</a>
          </nav>
          <p class="fineprint">
            Built on the research corpus, knowledge base, satellite fine-tune
            pipeline and events-map showcase committed in this repository.
          </p>
        </div>
      </footer>

    </body>
  </html>
);
