
Sentinel-2 is one of the most useful open satellite systems for flood mapping, damage assessment, and post-disaster monitoring, especially in humanitarian and environmental operations. Its value comes from a combination of:

* multispectral bands,
* relatively high spatial resolution,
* frequent revisit time,
* free/open access,
* and strong sensitivity to water, vegetation, soil moisture, and surface disturbance.

⸻

1. What Sentinel-2 is

Sentinel-2 is part of the European Copernicus Programme operated by ESA.

It consists of two satellites:

* Sentinel-2A
* Sentinel-2B

Together they provide:

* global coverage,
* revisit every ~5 days (faster at equator overlaps),
* multispectral optical imagery.

⸻

2. Key capabilities useful for flood detection

A. Multispectral bands sensitive to water

Sentinel-2 has 13 spectral bands.

The most important for flood work are:

Band	Resolution	Why useful
Blue (B2)	10 m	Water reflectance, turbidity
Green (B3)	10 m	Water detection
Red (B4)	10 m	Land/water separation
NIR (B8)	10 m	Strong water absorption
SWIR1 (B11)	20 m	Flood/wet soil detection
SWIR2 (B12)	20 m	Moisture and burn/water discrimination

Water absorbs strongly in NIR and SWIR, making flooded areas appear very dark.

⸻

B. High spatial resolution

Sentinel-2 provides:

* 10 m resolution for visible and NIR bands,
* 20 m for SWIR bands.

This is extremely useful because it allows:

* mapping rivers,
* identifying flooded roads,
* detecting neighborhood-scale flooding,
* estimating affected cropland,
* identifying damaged infrastructure zones.

Compared to coarser systems like MODIS (250–500 m), Sentinel-2 is much better for local humanitarian operations.

⸻

C. Frequent revisit time

With both satellites combined:

* revisit approximately every 5 days globally,
* sometimes 2–3 days at mid-latitudes.

This supports:

* before/after comparison,
* flood evolution monitoring,
* rapid emergency assessment,
* recovery tracking.

⸻

D. Open and free access

This is critical for humanitarian operations.

Data can be obtained from:

* Copernicus Browser,
* Google Earth Engine,
* Sentinel Hub,
* AWS,
* Microsoft Planetary Computer.

This makes it ideal for NGOs, UN agencies, and governments with limited budgets.

⸻

3. Flood detection methods using Sentinel-2

A. Water indices

The most common method is computing spectral indices.

NDWI — Normalized Difference Water Index

Uses Green and NIR:

NDWI = \frac{Green - NIR}{Green + NIR}

Typically:

* high NDWI → water,
* low NDWI → land.

Useful for:

* open water,
* river expansion,
* urban flooding.

⸻

MNDWI — Modified NDWI

Uses Green and SWIR:

MNDWI = \frac{Green - SWIR}{Green + SWIR}

Usually performs better in:

* urban areas,
* muddy floodwater,
* mixed terrain.

⸻

B. Change detection

Compare:

* pre-flood image,
* post-flood image.

Techniques:

* thresholding,
* spectral differencing,
* classification,
* machine learning segmentation.

Outputs:

* flood extent,
* newly inundated zones,
* duration of inundation.

⸻

C. Vegetation stress analysis

Flooding damages vegetation.

Sentinel-2 is excellent for monitoring vegetation because of:

* red edge bands,
* NIR sensitivity.

NDVI reduction

NDVI = \frac{NIR - Red}{NIR + Red}

A strong NDVI drop after flooding may indicate:

* crop loss,
* vegetation mortality,
* prolonged inundation,
* erosion.

⸻

4. Damage assessment applications

A. Agriculture damage

Sentinel-2 is particularly powerful for crop impact analysis.

You can estimate:

* flooded cropland,
* crop stress,
* yield loss proxies,
* sediment deposition,
* recovery rates.

This is heavily used by:

* FAO,
* WFP,
* insurance systems,
* climate risk programs.

⸻

B. Infrastructure exposure

At 10 m resolution, you can identify impacts near:

* roads,
* bridges,
* settlements,
* schools,
* health centers.

Limitations:

* individual buildings are difficult,
* structural damage cannot be directly assessed reliably.

But it is good for:

* access disruption,
* inundated neighborhoods,
* washed-out corridors.

⸻

C. Sediment and debris mapping

SWIR bands help identify:

* mud,
* sediment plumes,
* landslide deposits,
* debris fans.

Very relevant in:

* Andean flash floods,
* Putumayo/Mocoa-type debris flows,
* riverbank collapse events.

⸻

5. Important limitations

A. Cloud cover

This is the biggest problem.

Sentinel-2 is optical imagery.

Floods often happen during:

* heavy rain,
* storms,
* persistent cloud cover.

In tropical Colombia, clouds can make imagery unusable for days.

⸻

B. Cannot see through vegetation canopy

Flooding under forests may be missed.

Amazonian and jungle floods are harder to detect.

⸻

C. No nighttime advantage

Unlike radar systems, Sentinel-2 depends on sunlight.

⸻

6. Why Sentinel-1 is often paired with Sentinel-2

For operational flood mapping, organizations usually combine:

Satellite	Strength
Sentinel-1 (radar SAR)	Works through clouds and at night
Sentinel-2 (optical)	Better visual interpretation and damage characterization

Sentinel-1 is often the primary emergency flood detector.

Sentinel-2 adds:

* visual validation,
* water quality clues,
* vegetation damage,
* recovery analysis,
* detailed mapping.

⸻

7. Humanitarian use cases in Colombia

Sentinel-2 is commonly useful for:

Floods

* Putumayo
* Chocó
* Mojana
* Cauca basin
* Magdalena basin

Landslides and debris flows

* Mocoa
* Nariño
* Cauca
* Antioquia

Conflict and displacement contexts

* road accessibility,
* isolated communities,
* crop impacts,
* environmental degradation.

⸻

8. Typical workflow for flood response

A humanitarian geospatial workflow often looks like:

1. Acquire pre-event Sentinel-2 imagery.
2. Acquire post-event imagery.
3. Apply cloud masking.
4. Compute NDWI/MNDWI.
5. Threshold water extent.
6. Compare with permanent water layers.
7. Estimate newly flooded areas.
8. Overlay with:
    * population,
    * settlements,
    * roads,
    * schools,
    * health facilities,
    * cropland.
9. Produce exposure and impact maps.
10. Monitor recovery over time.

⸻

9. Best Sentinel-2 features specifically for flood work

Capability	Operational value
10 m resolution	Detailed flood mapping
SWIR bands	Water and wet soil detection
Red edge bands	Vegetation stress
Frequent revisit	Time series analysis
Open data	Humanitarian accessibility
Multispectral imagery	Flood + environmental impacts
Historical archive	Before/after comparison

⸻

10. Bottom line

Sentinel-2 is extremely valuable for:

* flood extent mapping,
* agricultural damage assessment,
* environmental impact analysis,
* recovery monitoring,
* humanitarian situational awareness.

Its main weakness is cloud cover, which is why operational systems usually combine it with Sentinel-1 SAR radar imagery for all-weather flood detection.