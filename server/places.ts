import type { Place } from "../shared/types.ts";

/**
 * Reference data for common destinations: each city's main airport (IATA code
 * and coordinates) and its city centre. Used for place autocomplete, to turn
 * city names into airport codes for flight search, and as an offline
 * geocoding fallback. It holds no prices or listings.
 */
export interface KnownPlace extends Place {
  /** Airport coordinates. */
  lat: number;
  lon: number;
  /** City-centre coordinates. */
  center: [number, number];
}

export const PLACES = ([
  { code: "JFK", city: "New York", country: "United States", airport: "John F. Kennedy Intl", lat: 40.64, lon: -73.78 },
  { code: "LAX", city: "Los Angeles", country: "United States", airport: "Los Angeles Intl", lat: 33.94, lon: -118.41 },
  { code: "SFO", city: "San Francisco", country: "United States", airport: "San Francisco Intl", lat: 37.62, lon: -122.38 },
  { code: "ORD", city: "Chicago", country: "United States", airport: "O'Hare Intl", lat: 41.97, lon: -87.9 },
  { code: "MIA", city: "Miami", country: "United States", airport: "Miami Intl", lat: 25.79, lon: -80.29 },
  { code: "SEA", city: "Seattle", country: "United States", airport: "Seattle-Tacoma Intl", lat: 47.45, lon: -122.31 },
  { code: "BOS", city: "Boston", country: "United States", airport: "Logan Intl", lat: 42.36, lon: -71.01 },
  { code: "DEN", city: "Denver", country: "United States", airport: "Denver Intl", lat: 39.86, lon: -104.67 },
  { code: "YYZ", city: "Toronto", country: "Canada", airport: "Pearson Intl", lat: 43.68, lon: -79.63 },
  { code: "YVR", city: "Vancouver", country: "Canada", airport: "Vancouver Intl", lat: 49.19, lon: -123.18 },
  { code: "MEX", city: "Mexico City", country: "Mexico", airport: "Benito Juárez Intl", lat: 19.44, lon: -99.07 },
  { code: "CUN", city: "Cancún", country: "Mexico", airport: "Cancún Intl", lat: 21.04, lon: -86.87 },
  { code: "LHR", city: "London", country: "United Kingdom", airport: "Heathrow", lat: 51.47, lon: -0.45 },
  { code: "CDG", city: "Paris", country: "France", airport: "Charles de Gaulle", lat: 49.01, lon: 2.55 },
  { code: "AMS", city: "Amsterdam", country: "Netherlands", airport: "Schiphol", lat: 52.31, lon: 4.76 },
  { code: "FCO", city: "Rome", country: "Italy", airport: "Fiumicino", lat: 41.8, lon: 12.25 },
  { code: "BCN", city: "Barcelona", country: "Spain", airport: "El Prat", lat: 41.3, lon: 2.08 },
  { code: "LIS", city: "Lisbon", country: "Portugal", airport: "Humberto Delgado", lat: 38.77, lon: -9.13 },
  { code: "BER", city: "Berlin", country: "Germany", airport: "Brandenburg", lat: 52.37, lon: 13.5 },
  { code: "ATH", city: "Athens", country: "Greece", airport: "Athens Intl", lat: 37.94, lon: 23.94 },
  { code: "IST", city: "Istanbul", country: "Türkiye", airport: "Istanbul Airport", lat: 41.26, lon: 28.74 },
  { code: "KEF", city: "Reykjavík", country: "Iceland", airport: "Keflavík Intl", lat: 63.98, lon: -22.61 },
  { code: "DXB", city: "Dubai", country: "United Arab Emirates", airport: "Dubai Intl", lat: 25.25, lon: 55.36 },
  { code: "NRT", city: "Tokyo", country: "Japan", airport: "Narita Intl", lat: 35.77, lon: 140.39 },
  { code: "KIX", city: "Osaka", country: "Japan", airport: "Kansai Intl", lat: 34.43, lon: 135.24 },
  { code: "ICN", city: "Seoul", country: "South Korea", airport: "Incheon Intl", lat: 37.46, lon: 126.44 },
  { code: "BKK", city: "Bangkok", country: "Thailand", airport: "Suvarnabhumi", lat: 13.69, lon: 100.75 },
  { code: "SIN", city: "Singapore", country: "Singapore", airport: "Changi", lat: 1.36, lon: 103.99 },
  { code: "DPS", city: "Bali", country: "Indonesia", airport: "Ngurah Rai Intl", lat: -8.75, lon: 115.17 },
  { code: "SYD", city: "Sydney", country: "Australia", airport: "Kingsford Smith", lat: -33.95, lon: 151.18 },
  { code: "CPT", city: "Cape Town", country: "South Africa", airport: "Cape Town Intl", lat: -33.97, lon: 18.6 },
  { code: "GRU", city: "São Paulo", country: "Brazil", airport: "Guarulhos Intl", lat: -23.43, lon: -46.47 },
  { code: "EZE", city: "Buenos Aires", country: "Argentina", airport: "Ezeiza Intl", lat: -34.82, lon: -58.54 },
  { code: "LIM", city: "Lima", country: "Peru", airport: "Jorge Chávez Intl", lat: -12.02, lon: -77.11 },
  { code: "HNL", city: "Honolulu", country: "United States", airport: "Daniel K. Inouye Intl", lat: 21.32, lon: -157.92 },
] as Omit<KnownPlace, "center">[]) as KnownPlace[];

// City centres, which can be far from the airport (Narita is ~60 km from Tokyo).
const CENTERS: Record<string, [number, number]> = {
  JFK: [40.758, -73.9855], LAX: [34.0522, -118.2437], SFO: [37.7749, -122.4194], ORD: [41.8781, -87.6298],
  MIA: [25.7617, -80.1918], SEA: [47.6062, -122.3321], BOS: [42.3601, -71.0589], DEN: [39.7392, -104.9903],
  YYZ: [43.6532, -79.3832], YVR: [49.2827, -123.1207], MEX: [19.4326, -99.1332], CUN: [21.1619, -86.8515],
  LHR: [51.5074, -0.1278], CDG: [48.8566, 2.3522], AMS: [52.3676, 4.9041], FCO: [41.9028, 12.4964],
  BCN: [41.3874, 2.1686], LIS: [38.7223, -9.1393], BER: [52.52, 13.405], ATH: [37.9838, 23.7275],
  IST: [41.0082, 28.9784], KEF: [64.1466, -21.9426], DXB: [25.2048, 55.2708], NRT: [35.6762, 139.6503],
  KIX: [34.6937, 135.5023], ICN: [37.5665, 126.978], BKK: [13.7563, 100.5018], SIN: [1.2903, 103.852],
  DPS: [-8.5069, 115.2625], SYD: [-33.8688, 151.2093], CPT: [-33.9249, 18.4241], GRU: [-23.5505, -46.6333],
  EZE: [-34.6037, -58.3816], LIM: [-12.0464, -77.0428], HNL: [21.2793, -157.8292],
};
for (const p of PLACES) p.center = CENTERS[p.code] ?? [p.lat, p.lon];

const byCode = new Map(PLACES.map((p) => [p.code, p]));

/**
 * Resolve free text ("tokyo", "NRT", "Tokyo, Japan") to a known place, or
 * undefined when it isn't one of them.
 */
export function resolvePlace(query: string): KnownPlace | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const exact = byCode.get(q.toUpperCase());
  if (exact) return exact;
  return (
    PLACES.find((p) => p.city.toLowerCase() === q) ??
    PLACES.find((p) => q.startsWith(p.city.toLowerCase()) || p.city.toLowerCase().startsWith(q)) ??
    PLACES.find((p) => q.includes(p.city.toLowerCase()) || p.country.toLowerCase() === q)
  );
}

export function searchPlaces(query: string, limit = 8): KnownPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return PLACES.slice(0, limit);
  return PLACES.filter(
    (p) =>
      p.code.toLowerCase().startsWith(q) ||
      p.city.toLowerCase().includes(q) ||
      p.country.toLowerCase().includes(q),
  ).slice(0, limit);
}

export function airportPoint(place: KnownPlace) {
  return { lat: place.lat, lon: place.lon, label: `${place.code} · ${place.airport}` };
}
