import type { GeoPoint, GeoResult, RouteResult } from "../shared/types.ts";
import { searchPlaces } from "./places.ts";

/**
 * Geocoding and driving directions.
 *
 * - Geocoding: OpenStreetMap Nominatim (free, no key; max 1 request/second).
 * - Routing: Google Routes API when GOOGLE_MAPS_API_KEY is set, otherwise the
 *   public OSRM server (free, no key, real road network).
 * - If the network is unavailable, both fall back to built-in data so the app
 *   keeps working: known cities for geocoding and a straight-line estimate for
 *   routes (flagged as `source: "estimate"`).
 */

export interface MapsOptions {
  googleKey?: string;
  /** Skip network calls entirely (tests, offline use). */
  offline?: boolean;
  fetch?: typeof fetch;
}

const USER_AGENT = "TripWorkshop/0.1 (personal trip-planning prototype)";
const MAX_GEOMETRY_POINTS = 160;

export function createMaps({ googleKey, offline = false, fetch: fetchImpl = fetch }: MapsOptions = {}) {
  const geocodeCache = new Map<string, GeoResult[]>();
  const routeCache = new Map<string, RouteResult>();

  // Nominatim's usage policy allows one request per second; queue them.
  let nominatimQueue: Promise<unknown> = Promise.resolve();
  const throttled = <T>(task: () => Promise<T>): Promise<T> => {
    const run = nominatimQueue.then(task, task);
    nominatimQueue = run.catch(() => undefined).then(() => new Promise((r) => setTimeout(r, 1100)));
    return run;
  };

  async function getJson(url: string, init?: RequestInit) {
    const res = await fetchImpl(url, { ...init, headers: { "User-Agent": USER_AGENT, ...init?.headers }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
    return res.json();
  }

  async function geocode(query: string): Promise<GeoResult[]> {
    const q = query.trim();
    if (!q) return [];
    const key = q.toLowerCase();
    const cached = geocodeCache.get(key);
    if (cached) return cached;

    let results = builtInGeocode(q);
    if (!offline) {
      try {
        const rows = (await throttled(() =>
          getJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`),
        )) as { lat: string; lon: string; name?: string; display_name: string; type?: string }[];
        if (rows.length) {
          results = rows.map((r) => ({
            lat: Number(r.lat),
            lon: Number(r.lon),
            label: r.name || r.display_name.split(",")[0],
            detail: r.display_name,
          }));
        }
      } catch {
        // Keep the built-in results.
      }
    }
    geocodeCache.set(key, results);
    return results;
  }

  async function route(points: GeoPoint[]): Promise<RouteResult> {
    if (points.length < 2) throw new Error("A route needs at least two points");
    const key = points.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(";");
    const cached = routeCache.get(key);
    if (cached) return cached;

    let result: RouteResult | null = null;
    if (!offline && googleKey) result = await googleRoute(points).catch(() => null);
    if (!offline && !result) result = await osrmRoute(points).catch(() => null);
    result ??= estimateRoute(points);
    if (result.source !== "estimate") routeCache.set(key, result);
    return result;
  }

  async function osrmRoute(points: GeoPoint[]): Promise<RouteResult> {
    const coords = points.map((p) => `${p.lon},${p.lat}`).join(";");
    const data = (await getJson(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=simplified&geometries=geojson`)) as {
      code: string;
      routes?: { duration: number; distance: number; geometry: { coordinates: [number, number][] } }[];
    };
    const best = data.routes?.[0];
    if (data.code !== "Ok" || !best) throw new Error(`OSRM: ${data.code}`);
    return {
      durationMinutes: Math.round(best.duration / 60),
      distanceKm: Math.round(best.distance / 100) / 10,
      source: "osrm",
      geometry: downsample(best.geometry.coordinates.map(([lon, lat]) => [lat, lon])),
    };
  }

  async function googleRoute(points: GeoPoint[]): Promise<RouteResult> {
    const waypoint = (p: GeoPoint) => ({ location: { latLng: { latitude: p.lat, longitude: p.lon } } });
    const data = (await getJson("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleKey!,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: waypoint(points[0]),
        destination: waypoint(points[points.length - 1]),
        intermediates: points.slice(1, -1).map(waypoint),
        travelMode: "DRIVE",
      }),
    })) as { routes?: { duration: string; distanceMeters: number; polyline: { encodedPolyline: string } }[] };
    const best = data.routes?.[0];
    if (!best) throw new Error("Google Routes returned no route");
    return {
      durationMinutes: Math.round(parseInt(best.duration, 10) / 60),
      distanceKm: Math.round(best.distanceMeters / 100) / 10,
      source: "google",
      geometry: downsample(decodePolyline(best.polyline.encodedPolyline)),
    };
  }

  return { geocode, route, routingProvider: googleKey ? "Google Maps" : "OpenStreetMap (OSRM)" };
}

export type Maps = ReturnType<typeof createMaps>;

function builtInGeocode(q: string): GeoResult[] {
  return searchPlaces(q, 4).flatMap((p) => [
    { lat: p.center[0], lon: p.center[1], label: p.city, detail: `${p.city}, ${p.country}` },
    { lat: p.lat, lon: p.lon, label: `${p.code} · ${p.airport}`, detail: `Airport · ${p.city}` },
  ]);
}

/** Straight-line distance padded for roads, at typical average driving speed. */
export function estimateRoute(points: GeoPoint[]): RouteResult {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]) * 1.3;
  const speed = km < 30 ? 35 : km < 150 ? 60 : 80;
  return {
    durationMinutes: Math.round((km / speed) * 60 + 5 * (points.length - 1)),
    distanceKm: Math.round(km * 10) / 10,
    source: "estimate",
    geometry: points.map((p) => [p.lat, p.lon]),
  };
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function downsample(path: [number, number][]): [number, number][] {
  if (path.length <= MAX_GEOMETRY_POINTS) return path.map(([a, b]) => [round5(a), round5(b)]);
  const step = (path.length - 1) / (MAX_GEOMETRY_POINTS - 1);
  return Array.from({ length: MAX_GEOMETRY_POINTS }, (_, i) => path[Math.round(i * step)]).map(([a, b]) => [round5(a), round5(b)]);
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Google's encoded polyline format → [lat, lon] pairs. */
export function decodePolyline(encoded: string): [number, number][] {
  const out: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lon += next();
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}
