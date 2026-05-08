# Problem — humanitarian flood response is disconnected end to end

The information *exists*. The technology *exists*. People still drown, lose their homes, and re-learn the same lessons every cycle. Why?

## Five disconnects

### 1. Risk maps are written in a language no one in the wetland speaks

UNGRD, IDEAM, the World Bank, Copernicus all produce **risk atlases, hazard maps, severity scoring matrices**. They use GIS terminology, satellite band indices, return-period notation, hydraulic modelling outputs. A *campesino* in Caimito, a JAC president in Sincelejito, a fisherman in Puerto Leguízamo — none of them can read them. The maps are technically correct and operationally invisible.

### 2. First responders miss windows because the knowledge isn't encoded for fast lookup

The lessons of Mocoa 2017 are written down. So are the lessons of La Mojana 2021 and 2024. They are written down in **hundreds of pages of PDFs**. A Cruz Roja socorrista at a rescue point cannot stop and read a 314-page risk diagnostic. So WASH gaps that should have been anticipated get re-discovered. Triage protocols that should have been pre-staged get improvised. Same lesson, same cycle, every event.

### 3. Satellite imagery arrives too late and costs too much to process

Cloud services that turn Sentinel-2 tiles into flood maps charge by the tile and depend on a stable internet pipe to the affected area. La Mojana is **>50% cloud-cover** during the wet season, and the bandwidth from the satellite to a data centre to the response team is the bottleneck. By the time the imagery is processed centrally and downloaded by the response team, **the flood is days old** and the actionable window is gone.

### 4. When the alert finally arrives, the people on the ground can't connect it to action

An alert that says *"Río Putumayo nivel crítico 11.5 m"* tells the IDEAM duty officer something. It tells the family in the *zona ribereña* nothing. They need to know: should I leave? With what? Who is responsible for the *albergue*? Where is my child's school evacuating to? Is the road to Mocoa cut? Who is the focal point for AHE in this corregimiento? **There is no fast bridge from a numerical alert to a specific human decision.**

### 5. The infrastructure to deliver any of this is the first thing that fails

When the flood hits, **cell towers go down with the power**, the internet goes intermittent or off, roads are cut, and the very systems that would normally deliver information stop working. Cloud-based dashboards, web portals, OCHA web pages — none of them are reachable from the affected area in the first 6-72 hours, which is exactly when the most actionable decisions get made.

## What this looks like in numbers

- **300+ communities** in La Mojana have been flooded continuously since the **27 August 2021** Cara de Gato breach. ([OCHA factsheet, June 2025](../research/download-md/OCHA-La-Mojana-Factsheet-No1-19062025.md))
- **335 dead, 57 disappeared, 400+ injured** in Mocoa, March 31 - April 1, 2017 — an event with documented precursors that didn't reach the affected neighbourhoods in time. ([UNAL analysis](../research/download-md/UNAL-Catastrofe-Mocoa.md))
- **17 PDFs, ~60 MB** of authoritative reports (OCHA, UNGRD, ACAPS, CERF, FAO) in our research corpus alone — the same content that real responders are expected to absorb in the middle of a crisis.
- **>50% of Sentinel-2 wet-season acquisitions over La Mojana are >50% cloud** (per our SimSat acquisition log) — meaning the standard cloud-based pipeline silently misses most events.

## The pattern

This is **not a knowledge gap**. It's a **delivery gap**. Every actor in the system — the satellite, the modeller, the responder, the community — is generating or receiving information, but the pipeline between them is broken at five different junctions, and the breakage is worst at the precise moment information matters most.

humaid is built around closing that pipeline.
