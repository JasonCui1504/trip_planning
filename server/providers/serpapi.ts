import type { FlightLeg, FlightSearch, HotelSearch, Offer, PriceSource } from "../../shared/types.ts";
import { daysBetween } from "../dates.ts";
import type { ProviderEnv, ProviderResult, SearchContext, SearchProvider } from "./index.ts";
import { altLinks, links } from "./links.ts";
import { airportPoint, resolvePlace } from "../places.ts";

/**
 * Live flight and hotel prices via SerpApi (https://serpapi.com), which runs
 * the search on Google Flights / Google Hotels and returns structured JSON.
 * Needs SERPAPI_API_KEY. Each search here costs one SerpApi search credit;
 * price-watch refreshes cost one per watched item per day.
 *
 * Field names follow SerpApi's published docs:
 *   https://serpapi.com/google-flights-api
 *   https://serpapi.com/google-hotels-api
 */

/** Bad input for this provider (e.g. a city it can't turn into an airport). Surfaces as a 400. */
export class ProviderInputError extends Error {}

const ENDPOINT = "https://serpapi.com/search.json";

async function serpapi(env: ProviderEnv, params: Record<string, string | number | undefined>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ api_key: env.keys.SERPAPI_API_KEY, hl: "en", gl: "us", currency: "USD" });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const res = await env.fetch(`${ENDPOINT}?${qs}`, { signal: AbortSignal.timeout(30_000) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.error) throw new Error(`SerpApi: ${String(data.error ?? res.status)}`);
  return data;
}

/** "2026-11-18 08:50" → "2026-11-18T08:50" */
const isoLocal = (t: string) => t.replace(" ", "T").slice(0, 16);

/** Google Flights wants IATA codes; accept a code or a city we know. */
export function toIata(text: string): string {
  const t = text.trim();
  if (/^[A-Za-z]{3}$/.test(t)) return t.toUpperCase();
  const place = resolvePlace(t);
  if (place) return place.code;
  throw new ProviderInputError(`Use an airport code for "${t}" (e.g. SFO, NRT) — live flight search needs one.`);
}

// ---------- Google Flights ----------

interface GfAirport {
  id: string;
  name: string;
  time: string;
}
interface GfSegment {
  departure_airport: GfAirport;
  arrival_airport: GfAirport;
  duration: number;
  airline: string;
  flight_number: string;
  airplane?: string;
  travel_class?: string;
  legroom?: string;
  extensions?: string[];
}
interface GfItinerary {
  flights: GfSegment[];
  layovers?: { duration: number; name: string; id: string; overnight?: boolean }[];
  total_duration: number;
  price?: number;
  type?: string;
  carbon_emissions?: { this_flight?: number; typical_for_this_route?: number; difference_percent?: number };
  booking_token?: string;
  departure_token?: string;
}

const TRAVEL_CLASS: Record<FlightSearch["cabin"], number> = { economy: 1, premium: 2, business: 3, first: 4 };
const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

export function mapGoogleFlights(data: Record<string, unknown>, params: FlightSearch): ProviderResult {
  const itineraries = [...((data.best_flights as GfItinerary[]) ?? []), ...((data.other_flights as GfItinerary[]) ?? [])];
  const adults = Math.max(1, params.adults);
  const roundTrip = Boolean(params.returnDate);

  const offers: Offer[] = itineraries
    .filter((it) => it.flights?.length && typeof it.price === "number")
    .map((it, i) => {
      const first = it.flights[0];
      const last = it.flights[it.flights.length - 1];
      const airlines = [...new Set(it.flights.map((f) => f.airline))];
      const stops = it.flights.length - 1;
      const leg: FlightLeg = {
        from: first.departure_airport.id,
        to: last.arrival_airport.id,
        depart: isoLocal(first.departure_airport.time),
        arrive: isoLocal(last.arrival_airport.time),
        durationMinutes: it.total_duration,
        stops,
        stopCities: (it.layovers ?? []).map((l) => l.id),
        carrier: airlines.join(" + "),
        flightNumber: it.flights.map((f) => f.flight_number).join(" / "),
      };
      // Google Flights quotes the price for all passengers on the search.
      const total = it.price!;
      const from = resolvePlace(leg.from);
      const to = resolvePlace(leg.to);
      const stopsLabel = stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`;
      const tags = [stopsLabel];
      if (i < ((data.best_flights as unknown[]) ?? []).length) tags.unshift("Google best");
      const co2 = it.carbon_emissions?.difference_percent;
      if (typeof co2 === "number" && co2 <= -10) tags.push(`${Math.abs(co2)}% less CO₂`);

      return {
        id: `gf-${it.flights.map((f) => f.flight_number.replace(/\s+/g, "")).join("_")}-${leg.depart}-${params.cabin}-${params.returnDate ?? "ow"}`,
        category: "flights" as const,
        provider: "Google Flights",
        title: `${leg.carrier} · ${stopsLabel}`,
        subtitle: `${leg.from} → ${leg.to}${roundTrip ? ` → ${leg.from}` : ""} · ${params.cabin}`,
        price: { amount: Math.round(total / adults), currency: "USD" },
        priceUnit: roundTrip ? "round trip / person" : "one way / person",
        totalPrice: { amount: total, currency: "USD" },
        start: leg.depart,
        end: leg.arrive,
        location: `${leg.from} → ${leg.to}`,
        tags,
        details: {
          Cabin: params.cabin[0].toUpperCase() + params.cabin.slice(1),
          Travelers: String(adults),
          Outbound: `${leg.flightNumber} · ${hm(leg.durationMinutes)}${leg.stopCities.length ? ` via ${leg.stopCities.join(", ")}` : ""}`,
          ...(it.flights[0].airplane ? { Aircraft: [...new Set(it.flights.map((f) => f.airplane).filter(Boolean))].join(", ") } : {}),
          ...(it.flights[0].legroom ? { Legroom: it.flights[0].legroom } : {}),
          ...((it.layovers ?? []).some((l) => l.overnight) ? { Note: "Overnight layover" } : {}),
          ...(roundTrip ? { Return: "Price includes the return; pick the return flight on Google Flights" } : {}),
        },
        bookingUrl: links.flights(leg.from, leg.to, params.departDate, params.returnDate),
        altLinks: altLinks.flights(leg.from, leg.to, params.departDate, params.returnDate),
        imageHue: (leg.carrier.charCodeAt(0) * 37) % 360,
        legs: [leg],
        points: [from && airportPoint(from), to && airportPoint(to)].filter((p) => p !== undefined),
        durationMinutes: it.total_duration,
      };
    });

  const insights: string[] = [];
  const pi = data.price_insights as { lowest_price?: number; price_level?: string; typical_price_range?: number[] } | undefined;
  if (pi?.price_level) {
    const range = pi.typical_price_range?.length === 2 ? ` (usually $${pi.typical_price_range[0].toLocaleString()}–$${pi.typical_price_range[1].toLocaleString()})` : "";
    insights.push(`Google Flights says prices for this trip are ${pi.price_level} right now${range}.`);
  }
  return { offers, insights };
}

export const serpapiFlights: SearchProvider<"flights"> = {
  name: "Google Flights (SerpApi)",
  requiredKeys: ["SERPAPI_API_KEY"],
  async search(params: FlightSearch, _ctx: SearchContext, env: ProviderEnv) {
    const data = await serpapi(env, {
      engine: "google_flights",
      departure_id: toIata(params.origin),
      arrival_id: toIata(params.destination),
      outbound_date: params.departDate,
      return_date: params.returnDate,
      type: params.returnDate ? 1 : 2,
      adults: params.adults,
      travel_class: TRAVEL_CLASS[params.cabin],
    });
    return mapGoogleFlights(data, params);
  },
};

// ---------- Google Hotels ----------

interface GhRate {
  lowest?: string;
  extracted_lowest?: number;
}
interface GhProperty {
  type?: string;
  name: string;
  link?: string;
  property_token?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  rate_per_night?: GhRate;
  total_rate?: GhRate;
  prices?: { source: string; link?: string; rate_per_night?: GhRate; total_rate?: GhRate; free_cancellation?: boolean }[];
  overall_rating?: number;
  reviews?: number;
  hotel_class?: string;
  extracted_hotel_class?: number;
  amenities?: string[];
  check_in_time?: string;
  check_out_time?: string;
  images?: { thumbnail?: string }[];
  nearby_places?: { name: string }[];
}

export function mapGoogleHotels(data: Record<string, unknown>, params: HotelSearch): ProviderResult {
  const nights = Math.max(1, daysBetween(params.checkIn, params.checkOut));
  const rooms = Math.max(1, params.rooms);
  const properties = (data.properties as GhProperty[]) ?? [];

  const offers: Offer[] = properties
    .filter((p) => typeof p.rate_per_night?.extracted_lowest === "number")
    .map((p, i) => {
      const nightly = p.rate_per_night!.extracted_lowest!;
      // Google prices one room; multiply out for multi-room searches.
      const stay = (p.total_rate?.extracted_lowest ?? nightly * nights) * rooms;
      const sources: PriceSource[] = (p.prices ?? [])
        .map((s): PriceSource | null => {
          const total = s.total_rate?.extracted_lowest;
          const night = s.rate_per_night?.extracted_lowest;
          const amount = total ?? (night !== undefined ? night * nights : undefined);
          return amount === undefined ? null : { source: s.source, amount: amount * rooms, unit: "total", link: s.link, freeCancellation: s.free_cancellation };
        })
        .filter((s): s is PriceSource => s !== null)
        .sort((a, b) => a.amount - b.amount);
      const stars = p.extracted_hotel_class;
      const tags: string[] = [p.type === "vacation rental" ? "Vacation rental" : "Hotel"];
      if (sources.some((s) => s.freeCancellation)) tags.push("Free cancellation");
      if (sources.length > 1) tags.push(`${sources.length} sites compared`);
      const id = `gh-${p.property_token ?? `${p.name}-${i}`}-${params.checkIn}-${params.checkOut}`;

      return {
        id,
        category: "hotels" as const,
        provider: "Google Hotels",
        title: p.name,
        subtitle: `${stars ? `${"★".repeat(stars)} · ` : ""}${params.location}`,
        price: { amount: nightly, currency: "USD" },
        priceUnit: "per night",
        totalPrice: { amount: Math.round(stay), currency: "USD" },
        rating: p.overall_rating,
        reviewCount: p.reviews,
        start: `${params.checkIn}T${to24h(p.check_in_time) ?? "15:00"}`,
        end: `${params.checkOut}T${to24h(p.check_out_time) ?? "11:00"}`,
        location: params.location,
        tags,
        details: {
          Nights: String(nights),
          Rooms: String(rooms),
          Guests: String(params.guests),
          ...(p.amenities?.length ? { Amenities: p.amenities.slice(0, 8).join(", ") } : {}),
          ...(p.nearby_places?.length ? { Near: p.nearby_places.slice(0, 3).map((n) => n.name).join(", ") } : {}),
          ...(sources[0] ? { "Cheapest on": `${sources[0].source}` } : {}),
        },
        bookingUrl: p.link ?? sources[0]?.link ?? altLinks.hotels(params.location, params.checkIn, params.checkOut, params.guests, rooms, p.name)[3].url,
        altLinks: altLinks.hotels(params.location, params.checkIn, params.checkOut, params.guests, rooms, p.name),
        priceSources: sources,
        imageUrl: p.images?.[0]?.thumbnail,
        imageHue: (p.name.charCodeAt(0) * 41) % 360,
        points: p.gps_coordinates ? [{ lat: p.gps_coordinates.latitude, lon: p.gps_coordinates.longitude, label: p.name }] : [],
      };
    });
  return { offers };
}

/** "3:00 PM" → "15:00" */
function to24h(t?: string): string | undefined {
  const m = t?.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!m) return undefined;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

export const serpapiHotels: SearchProvider<"hotels"> = {
  name: "Google Hotels (SerpApi)",
  requiredKeys: ["SERPAPI_API_KEY"],
  async search(params: HotelSearch, _ctx: SearchContext, env: ProviderEnv) {
    const data = await serpapi(env, {
      engine: "google_hotels",
      q: params.location,
      check_in_date: params.checkIn,
      check_out_date: params.checkOut,
      adults: params.guests,
    });
    return mapGoogleHotels(data, params);
  },
};
