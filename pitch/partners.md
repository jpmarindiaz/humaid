# Partners & program — already selected, ready to deploy

This is the part of the pitch that should reframe how the rest of the deck reads.

humaid is **not a research idea looking for a home**. It is a working set of components with **implementing partners already aligned**, sitting inside a major NASA program, with deployment paths that span from grass-roots indigenous organisations to the United Nations.

## Program affiliation — NASA Lifelines

humaid is part of the **NASA Lifelines program**.

That gives us:
- Direct alignment with NASA's Earth-observation mission and the Disasters Charter ecosystem.
- A credible institutional umbrella for satellite-data access, hosted-payload conversations, and downlink partnerships.
- Cross-pollination with adjacent humanitarian-tech work in the same program.

This is the *technical-credibility rail* of the project. It means we are not starting from zero on space-segment partnerships — they are already in motion.

## Implementing partners — full spectrum, already engaged

The most expensive part of any humanitarian-tech deployment is **finding the field partner who will actually run the thing on the ground, in the affected community, when the network is down and the road is cut**. Most projects fail here.

We have those partnerships in place across the full institutional spectrum.

### Grass-roots — indigenous water-rights organisations in Putumayo

We are working with **associations of indigenous communities defending water rights in Putumayo**. These are the people who:
- Live in the Bajo Putumayo and Medio Putumayo subregions where the Putumayo and Caquetá rivers overflow annually.
- Have been organising for decades around the rivers, oil-spill protection, and community-controlled monitoring.
- Hold legal and cultural standing as *autoridades tradicionales* in their *resguardos* and *consejos comunitarios*.
- Will be the actual end-users of the local app and community stations in their territories.

This is where the *local-knowledge co-design* of the system happens — Murui Muina, Inga, Kamëntsá, Siona, Kofán knowledge of the rivers feeding directly into the Q&A and the alert playbooks.

### Mid-tier — humanitarian and development NGOs

Multiple NGOs working in Colombian humanitarian aid are aligned as **implementing partners** for the field deployment of humaid stations and the local app. They bring:
- Existing operational presence in La Mojana and Putumayo.
- Active CMGRD/CDGRD relationships at the municipal and departmental level.
- Donor agreements with CERF, ECHO, USAID-BHA, SIDA, and the Colombia HRP cluster system.
- The legal and operational mandate to work in armed-conflict-affected zones (AGC, ELN, EMC factions).

These partners are the channel that turns "we built it" into "it's running in 14 municipalities."

### Top-tier — United Nations in Colombia

We are partnered with the **United Nations in Colombia** on the development of their **data and AI governance strategy**.

That is not the same thing as a deployment partnership — it is something bigger. It means:
- The UN system in Colombia is treating our work as one of the **reference cases** for how AI should responsibly be used in humanitarian contexts.
- The architectural decisions we make on humaid (citation-backed retrieval, source-grounded answers, role-aware delivery, indigenous co-design, offline-first sovereignty) are being absorbed into how the UN frames its own AI governance for humanitarian work.
- This positions humaid as **policy-level material**, not just a tool.

For a funder, this is the strongest possible signal that the architectural choices have been vetted by the most demanding possible scrutiny — the UN's own data-governance and humanitarian-principles framework.

## What this means for the pitch

| Without this | With this |
|---|---|
| "We have a working prototype" | "We have a working prototype *and* the partners ready to deploy it" |
| "We need to find a field partner" | "Our field partners are co-designing the product" |
| "We hope this gets used by the UN system" | "The UN system is partnered with us to define how this kind of work should be governed" |
| "If it works in Colombia, maybe it transfers" | "Colombia is the first step — by design — and the architecture is built to transfer" |

## First step, not the destination

Colombia is the **right first step** for three reasons:

1. **Acute, recurring need.** La Mojana and Putumayo together have generated continuous flood-displacement crises for the past five years and the next event is on the calendar.
2. **Institutional density.** UNGRD, IDEAM, OCHA Colombia, the EHP/ELC system, an active HRP-CPRP cycle, multiple international NGOs, indigenous-rights movements with technical capacity — there is no other country with this combination of acute need and coordination depth.
3. **NASA Lifelines + UN partnership give us institutional cover** to do this at scale here without re-litigating credibility every time we engage a new actor.

But the architecture is **deliberately portable**:

- **Hazard-agnostic** — same satellite-VLM-onboard + JSON-alert + offline-Q&A pattern works for wildfires (already proven in the [Liquid AI wildfire cookbook](https://github.com/Liquid4All/cookbook/tree/main/examples/wildfire-prevention)), volcanic eruptions, landslides, severe weather.
- **Region-agnostic** — the role × phase × region matrix scales by adding region buckets. The Andean-Amazon basin extends naturally into Ecuador, Peru, Bolivia. Caribbean-wetland systems extend to the Atrato (Chocó), the Mississippi delta in the US, the Mekong delta in Vietnam, the Sundarbans in Bangladesh.
- **Language-agnostic** — same multi-agent Q&A pipeline operates over any source corpus in any language.
- **Institution-agnostic** — works with national civil-protection agencies *or* NGO consortia *or* indigenous *cabildos* *or* multilateral programmes, depending on context.

The Colombia deployment is the **proving ground**. The destination is a **global humanitarian-response rail** that any region can deploy with their own knowledge, their own languages, their own response institutions.

## Why this matters for funders

If you fund humaid in Colombia in 2026, you are funding:
- The first deployment of a NASA-Lifelines-affiliated humanitarian-AI system at municipal scale.
- A reference case that the UN in Colombia is co-defining as governance template.
- A partnership with indigenous rights organisations that gives the work standing far beyond a typical tech pilot.
- The **first node of a network** that — if it works here — provides a deployable template for the next 50 flood-exposed regions on Earth.

This is not "Colombia tech for Colombia." It is **Colombia as the launch site for global humanitarian-response infrastructure**.
