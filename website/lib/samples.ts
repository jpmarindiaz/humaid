// Pre-baked Sentinel-2 sample pairs for the flood demo.
// Each entry has 4 PNGs (pre+current × RGB+SWIR). The PNGs themselves
// live under assets/samples/ and ship with the deploy artifact.

export interface FloodSample {
  id: string;
  location: string;
  region: "la-mojana" | "putumayo";
  event_date: string;
  event_label: string;
  description: string;
  expected_summary: string;
  paths: {
    pre_rgb: string;
    pre_swir: string;
    cur_rgb: string;
    cur_swir: string;
  };
}

export const FLOOD_SAMPLES: FloodSample[] = [
  {
    id: "cara-de-gato-2024",
    location: "San Jacinto del Cauca, Bolívar",
    region: "la-mojana",
    event_date: "2024-05-06",
    event_label: "Cara de Gato dike breach · May 2024",
    description: "Sentinel-2 tile centred on the Cara de Gato dike. The pre image (28 Apr 2024) shows the seasonal wetland baseline; the current image (6 May 2024) is post-breach.",
    expected_summary: "flood_present=true · severity=moderate · river_overflow_visible=true · dike breach drives the change",
    paths: {
      pre_rgb:  "/assets/samples/cara-de-gato-2024-pre-rgb.png",
      pre_swir: "/assets/samples/cara-de-gato-2024-pre-swir.png",
      cur_rgb:  "/assets/samples/cara-de-gato-2024-cur-rgb.png",
      cur_swir: "/assets/samples/cara-de-gato-2024-cur-swir.png",
    },
  },
  {
    id: "mocoa-2017",
    location: "Mocoa, Putumayo",
    region: "putumayo",
    event_date: "2017-04-01",
    event_label: "Mocoa avalancha torrencial · Apr 2017",
    description: "Andean-foothill flash flood. The 31 Mar – 1 Apr 2017 event killed 335 people in minutes. Compare baseline (cloud-light pre) with the post-event tile.",
    expected_summary: "severe flood · populated area affected · infrastructure at risk",
    paths: {
      pre_rgb:  "/assets/samples/mocoa-2017-pre-rgb.png",
      pre_swir: "/assets/samples/mocoa-2017-pre-swir.png",
      cur_rgb:  "/assets/samples/mocoa-2017-cur-rgb.png",
      cur_swir: "/assets/samples/mocoa-2017-cur-swir.png",
    },
  },
  {
    id: "ayapel-peak-2022",
    location: "Ayapel, Córdoba",
    region: "la-mojana",
    event_date: "2022-12-15",
    event_label: "La Mojana peak inundation · Dec 2022",
    description: "Wetland-margin tile at peak inundation, third year of the 2021–2023 triple-dip La Niña. Tests the model's ability to distinguish chronic ciénaga from new flooding.",
    expected_summary: "flood_present=true · severity=moderate-to-severe · wetland baseline preserved in pre",
    paths: {
      pre_rgb:  "/assets/samples/ayapel-peak-2022-pre-rgb.png",
      pre_swir: "/assets/samples/ayapel-peak-2022-pre-swir.png",
      cur_rgb:  "/assets/samples/ayapel-peak-2022-cur-rgb.png",
      cur_swir: "/assets/samples/ayapel-peak-2022-cur-swir.png",
    },
  },
];
