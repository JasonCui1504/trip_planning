import type { FlightLeg, FlightSearch, Offer } from "../../../shared/types.ts";
import { atMinutes } from "../../dates.ts";
import { links } from "../links.ts";
import { distanceKm, PLACES, resolvePlace, type MockPlace } from "./places.ts";
import { seededRandom, type Rng } from "./random.ts";

const AIRLINES = [
  { name: "Skyline Air", code: "SK" },
  { name: "Meridian Airways", code: "MR" },
  { name: "Northstar", code: "NS" },
  { name: "Pacific Crest", code: "PC" },
  { name: "Atlas Global", code: "AG" },
  { name: "Horizon Jet", code: "HJ" },
  { name: "Aurora Airlines", code: "AU" },
  { name: "Coastal Wings", code: "CW" },
];

const CABIN_MULTIPLIER: Record<FlightSearch["cabin"], number> = {
  economy: 1,
  premium: 1.7,
  business: 3.6,
  first: 6,
};

const BAGGAGE: Record<FlightSearch["cabin"], string> = {
  economy: "Carry-on included, checked bag from $35",
  premium: "1 checked bag included",
  business: "2 checked bags included",
  first: "3 checked bags included",
};

function makeLeg(rng: Rng, from: MockPlace, to: MockPlace, date: string, airline: (typeof AIRLINES)[number]): FlightLeg {
  const km = distanceKm(from, to);
  const direct = Math.round((km / 820) * 60 + 35);
  const maxStops = km < 1200 ? 1 : km < 6000 ? 1 : 2;
  const stops = rng.chance(0.45) ? 0 : rng.int(1, maxStops);
  const hubs = PLACES.filter((p) => p.code !== from.code && p.code !== to.code);
  const stopCities = rng.shuffle(hubs).slice(0, stops).map((p) => p.code);
  const layovers = Array.from({ length: stops }, () => rng.int(55, 210)).reduce((a, b) => a + b, 0);
  const durationMinutes = Math.round(direct * (1 + stops * 0.12) + layovers);
  const departMinutes = rng.int(6 * 12, 22 * 12) * 5; // 06:00 – 22:00 in 5 minute steps
  return {
    from: from.code,
    to: to.code,
    depart: atMinutes(date, departMinutes),
    arrive: atMinutes(date, departMinutes + durationMinutes),
    durationMinutes,
    stops,
    stopCities,
    carrier: airline.name,
    flightNumber: `${airline.code}${rng.int(100, 2999)}`,
  };
}

function legPrice(rng: Rng, leg: FlightLeg, km: number): number {
  const base = 45 + km * 0.085;
  const stopDiscount = leg.stops === 0 ? 1.18 : leg.stops === 1 ? 0.92 : 0.8;
  const redEye = Number(leg.depart.slice(11, 13)) >= 21 ? 0.9 : 1;
  return base * stopDiscount * redEye * (0.75 + rng.next() * 0.6);
}

export function hhmm(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function stopsLabel(stops: number): string {
  return stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`;
}

export async function searchFlights(params: FlightSearch): Promise<Offer[]> {
  const from = resolvePlace(params.origin);
  const to = resolvePlace(params.destination);
  const rng = seededRandom(`flights|${from.code}|${to.code}|${params.departDate}|${params.returnDate ?? ""}|${params.cabin}`);
  const km = distanceKm(from, to);
  const adults = Math.max(1, params.adults);

  const offers: Offer[] = [];
  for (let i = 0; i < 14; i++) {
    const airline = rng.pick(AIRLINES);
    const legs = [makeLeg(rng, from, to, params.departDate, airline)];
    if (params.returnDate) legs.push(makeLeg(rng, to, from, params.returnDate, airline));
    const perPerson = Math.round(legs.reduce((sum, leg) => sum + legPrice(rng, leg, km), 0) * CABIN_MULTIPLIER[params.cabin]);
    const total = perPerson * adults;
    const out = legs[0];
    const lastLeg = legs[legs.length - 1];

    offers.push({
      id: `mock-fl-${from.code}-${to.code}-${params.departDate}-${i}`,
      category: "flights",
      provider: "Mock flights",
      title: `${airline.name} · ${stopsLabel(out.stops)}`,
      subtitle: `${from.code} → ${to.code}${params.returnDate ? ` → ${from.code}` : ""} · ${params.cabin}`,
      price: { amount: perPerson, currency: "USD" },
      priceUnit: params.returnDate ? "round trip / person" : "one way / person",
      totalPrice: { amount: total, currency: "USD" },
      start: out.depart,
      end: lastLeg.arrive,
      location: `${from.city} → ${to.city}`,
      tags: [stopsLabel(out.stops)],
      details: {
        Cabin: params.cabin[0].toUpperCase() + params.cabin.slice(1),
        Travelers: String(adults),
        Baggage: BAGGAGE[params.cabin],
        Outbound: `${out.flightNumber} · ${hhmm(out.durationMinutes)}${out.stopCities.length ? ` via ${out.stopCities.join(", ")}` : ""}`,
        ...(legs[1]
          ? { Return: `${legs[1].flightNumber} · ${hhmm(legs[1].durationMinutes)}${legs[1].stopCities.length ? ` via ${legs[1].stopCities.join(", ")}` : ""}` }
          : {}),
      },
      bookingUrl: links.flights(from.code, to.code, params.departDate, params.returnDate),
      imageHue: (airline.code.charCodeAt(0) * 37) % 360,
      legs,
    });
  }

  // Badge the standout options so they are easy to spot in the results list.
  const cheapest = offers.reduce((a, b) => (b.totalPrice.amount < a.totalPrice.amount ? b : a));
  const fastest = offers.reduce((a, b) => (totalMinutes(b) < totalMinutes(a) ? b : a));
  const score = (o: Offer) => o.totalPrice.amount / cheapest.totalPrice.amount + totalMinutes(o) / totalMinutes(fastest);
  const best = offers.reduce((a, b) => (score(b) < score(a) ? b : a));
  cheapest.tags.unshift("Cheapest");
  fastest.tags.unshift("Fastest");
  best.tags.unshift("Best value");

  return offers;
}

function totalMinutes(offer: Offer): number {
  return (offer.legs ?? []).reduce((sum, leg) => sum + leg.durationMinutes, 0);
}
