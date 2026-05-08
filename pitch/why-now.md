# Why now

Three curves crossed in the last 24 months that make this approach feasible — and a fourth that makes it urgent.

## 1. Small VLMs got good enough to run on a CubeSat

Two years ago the only options for visual reasoning were 8B+ parameter models that needed a data centre. Today **LFM2.5-VL-450M** (Liquid AI) is **450 MB** — small enough to fit on the storage of a 3U CubeSat, fast enough to inference on its CPU between data captures, and accurate enough to ground-truth-match Opus-class labellers on flood-detection tasks (per our `finetune-flood/` evals).

This is the unlock. Onboard inference was theoretical in 2023. It's a single weight-file copy in 2026.

## 2. Sentinel-1 SAR coverage of South America matured

Copernicus Sentinel-1 now offers **6-12 day revisit, free, global**, with **all-weather** capability — meaning it sees through the cloud cover that defeats Sentinel-2 over the Caribbean and Amazon during the wet season. CopernicusLAC Panama Centre's **Use Case 2** flood-extent service is operational over La Mojana with UNGRD as a partner ([Copernicus blog, April 2026](https://www.copernicuslac-panama.eu/blog-en/flooding-in-la-mojana-how-earth-observation-services-are-transforming-risk-management-in-colombia/)).

The data is there. The bottleneck is cost-of-processing and last-mile delivery — both of which our architecture targets.

## 3. Embedding-based local retrieval got dirt cheap

Ollama + Nomic embeddings + DuckDB cosine similarity now runs on a Raspberry Pi 5 with no GPU. **Local Q&A retrieval over 471 grounded pairs is a sub-second operation on hardware you can buy at an electronics store in Bogotá for under USD 100.** Two years ago this required a server, a vector DB licence, and a stable internet pipe.

## 4. The climate trajectory is making this worse, fast

- **La Niña 2021-2023** was the first triple-dip La Niña in modern record. UNGRD's official assessment counted **>500,000 people affected** in La Mojana alone. ([UNGRD Evaluación La Niña 2021-2023](../research/download-md/UNGRD-Evaluacion-La-Niña-2021-2023.md))
- **La Niña 2024-2025** brought renewed dike failures (Cara de Gato, Los Arrastres) and a peak inundation of **~860,000 ha** nationally.
- **El Niño 2026** is forecast — UNGRD has already issued **Circular 028 de 2026** with preparedness directives.
- Putumayo's 2025 rainy season was *"one of the most severe of recent years"* per OCHA, with the Río Putumayo at **11.5 m** vs a record of 12.5 m. ([OCHA SitRep, July 2025](../research/download-md/OCHA-SitRep-Inundaciones-Amazonia-Orinoquia-2025.md))

The system that's supposed to handle all of this — UNGRD, IDEAM, CDGRD, CMGRD, EHP, ELC, clusters, NGOs, first responders — is the same system that was already overwhelmed in 2021. Procuraduría ordered a special intervention into La Mojana in September 2025. The Tribunal Administrativo de Cundinamarca has *ordered* UNGRD to produce an updated ENSO plan.

The next event is not a hypothetical. It is on the calendar.

## The combination

| | 2023 | 2026 |
|---|---|---|
| VLM size for visual reasoning | 8B+ params, data-centre only | 450M params, runs on CubeSat |
| SAR coverage of La Mojana | Available but unprocessed | Operational EO services with UNGRD |
| Local retrieval cost | Cloud vector DB only | $100 device, no internet |
| Climate stressor | La Niña 2021-2023 just started | Cumulative damage; El Niño 2026 incoming |
| Policy attention | Limited | Procuraduría intervention, Tribunal order |

Two years ago this product was technically possible only on paper. Now every piece is shippable, the data is open, and the policy environment is asking for exactly this kind of intervention.

humaid is not three years too early. It is twelve months late.
