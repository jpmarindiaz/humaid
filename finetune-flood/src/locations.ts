// Location anchors from research/flood-tagging-and-reference-points.md.
// Two regions: La Mojana (chronic dike-failure flooding, Depresión Momposina)
// and Putumayo (Andean-Amazon flash floods + lowland riverine).
//
// Coordinates are tile centers; SimSat samples a 5km square around each.

export interface Location {
  id: string
  name: string
  lon: number
  lat: number
  region: 'la_mojana' | 'putumayo'
  notes?: string
}

export const LOCATIONS: Location[] = [
  // === La Mojana — Depresión Momposina ===
  // Anchor municipalities, priority order from the tagging doc.
  { id: 'san_jacinto_del_cauca', name: 'San Jacinto del Cauca, Bolívar', lon: -74.7167, lat: 8.2500, region: 'la_mojana', notes: 'Site of Cara de Gato dike — primary breach location' },
  { id: 'ayapel', name: 'Ayapel, Córdoba', lon: -75.1389, lat: 8.3128, region: 'la_mojana', notes: '2024: 23% muni + 44% cropland flooded; Ciénaga de Ayapel wetland' },
  { id: 'san_benito_abad', name: 'San Benito Abad, Sucre', lon: -75.0319, lat: 8.9275, region: 'la_mojana', notes: '2024: 29% muni + 35% cropland + 32% grassland flooded' },
  { id: 'guaranda', name: 'Guaranda, Sucre', lon: -74.5392, lat: 8.4694, region: 'la_mojana', notes: 'Caño Rabón > 3.6m in 2025; Alto San Matías, Humo Candelaria, Mamón' },
  { id: 'majagual', name: 'Majagual, Sucre', lon: -74.6356, lat: 8.5417, region: 'la_mojana', notes: 'Sincelejito (Alianza Común La Mojana hub); Pumpuma, Los Ossas' },
  { id: 'caimito', name: 'Caimito, Sucre', lon: -75.1147, lat: 8.7906, region: 'la_mojana', notes: 'Persistent encharcamientos through 2025' },
  { id: 'sucre_cabecera', name: 'Sucre (cabecera), Sucre', lon: -74.7197, lat: 8.8125, region: 'la_mojana', notes: 'Urban + departmental seat impact' },
  { id: 'san_marcos', name: 'San Marcos, Sucre', lon: -75.1283, lat: 8.6622, region: 'la_mojana', notes: 'Secondary impact zone' },

  // === Putumayo — Andean-Amazon ===
  { id: 'mocoa', name: 'Mocoa, Putumayo', lon: -76.6534, lat: 1.1463, region: 'putumayo', notes: '2017 avalancha torrencial; 6 watercourses; 17 barrios destroyed' },
  { id: 'puerto_asis', name: 'Puerto Asís, Putumayo', lon: -76.4972, lat: 0.5036, region: 'putumayo', notes: '2025 calamidad pública; albergue; Río Putumayo' },
  { id: 'puerto_guzman', name: 'Puerto Guzmán, Putumayo', lon: -76.4072, lat: 0.9636, region: 'putumayo', notes: '2025 calamidad pública' },
  { id: 'colon_putumayo', name: 'Colón, Putumayo', lon: -76.9667, lat: 1.1875, region: 'putumayo', notes: 'Alto Putumayo; 2025 affected' },
  { id: 'santiago_putumayo', name: 'Santiago, Putumayo', lon: -77.0033, lat: 1.1467, region: 'putumayo', notes: 'Alto Putumayo; 2025 affected' },
  { id: 'puerto_leguizamo', name: 'Puerto Leguízamo, Putumayo', lon: -74.7822, lat: -0.1933, region: 'putumayo', notes: 'Bajo Putumayo; 10 Apr 2025 calamidad pública (Decreto)' },
]
