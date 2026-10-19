import type { DriveLeg, GeoPoint, Scenario, Trip, TripItem } from "../shared/types.ts";

/** Rough fuel cost for a typical rental car (≈7.5 L/100 km at ≈$1.60/L). */
export const FUEL_PER_KM = 0.12;

export interface ScenarioTotals {
  items: TripItem[];
  itemCost: number;
  fuelCost: number;
  cost: number;
  flightMinutes: number;
  driveMinutes: number;
  travelMinutes: number;
  driveKm: number;
}

export function scenarioTotals(scenario: Scenario, trip: Trip): ScenarioTotals {
  const items = scenario.itemIds.map((id) => trip.items.find((i) => i.id === id)).filter((i): i is TripItem => Boolean(i));
  const itemCost = items.reduce((s, i) => s + i.cost.amount, 0);
  const driveKm = scenario.drives.reduce((s, d) => s + d.distanceKm, 0);
  const driveMinutes = scenario.drives.reduce((s, d) => s + d.durationMinutes, 0);
  const flightMinutes = items.reduce((s, i) => s + (i.durationMinutes ?? 0), 0);
  const fuelCost = Math.round(driveKm * FUEL_PER_KM);
  return { items, itemCost, fuelCost, cost: itemCost + fuelCost, flightMinutes, driveMinutes, travelMinutes: flightMinutes + driveMinutes, driveKm };
}

const distKm = (a: GeoPoint, b: GeoPoint) => {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

interface Stop {
  at: string;
  point: GeoPoint & { label: string };
}

/**
 * Walk the scenario in time order (land at the airport, check in, activities,
 * check out, return flight…) and propose a drive wherever consecutive stops
 * are in different places and no drive between them exists yet.
 */
export function suggestDrives(scenario: Scenario, trip: Trip): { from: Stop["point"]; to: Stop["point"] }[] {
  const stops: Stop[] = [];
  const named = (p: GeoPoint, fallback: string) => ({ lat: p.lat, lon: p.lon, label: p.label ?? fallback });
  for (const item of scenarioTotals(scenario, trip).items) {
    const pts = item.points ?? [];
    if (!pts.length || !item.start) continue;
    if (item.category === "flights" && pts.length >= 2) {
      const arrival = named(pts[1], "Arrival airport");
      stops.push({ at: item.start, point: arrival });
      for (const m of item.moments ?? []) stops.push({ at: m.at, point: arrival });
    } else {
      const p = named(pts[0], item.title);
      stops.push({ at: item.start, point: p });
      if (item.end && (item.category === "hotels" || item.category === "cars")) stops.push({ at: item.end, point: p });
    }
  }
  stops.sort((a, b) => a.at.localeCompare(b.at));

  const exists = (from: GeoPoint, to: GeoPoint) => scenario.drives.some((d) => distKm(d.from, from) < 0.3 && distKm(d.to, to) < 0.3);
  const out: { from: Stop["point"]; to: Stop["point"] }[] = [];
  for (let i = 1; i < stops.length && out.length < 12; i++) {
    const from = stops[i - 1].point;
    const to = stops[i].point;
    if (distKm(from, to) > 1.5 && !exists(from, to) && !out.some((o) => distKm(o.from, from) < 0.3 && distKm(o.to, to) < 0.3)) out.push({ from, to });
  }
  return out;
}

export function newScenario(name: string): Scenario {
  return { id: crypto.randomUUID(), name, itemIds: [], drives: [], notes: "", createdAt: new Date().toISOString() };
}

export function driveFromRoute(from: DriveLeg["from"], to: DriveLeg["to"], route: Pick<DriveLeg, "durationMinutes" | "distanceKm" | "source" | "geometry">): DriveLeg {
  return { id: crypto.randomUUID(), from, to, ...route };
}
