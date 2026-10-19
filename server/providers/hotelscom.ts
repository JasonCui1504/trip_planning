import type { HotelSearch, Offer } from "../../shared/types.ts";
import { daysBetween } from "../dates.ts";
import type { ProviderEnv, ProviderResult, SearchContext, SearchProvider } from "./index.ts";
import { altLinks } from "./links.ts";

/**
 * Live hotel prices from Hotels.com, via the "Hotels.com Provider" API on
 * RapidAPI (https://rapidapi.com/tipsters/api/hotels-com-provider), which has
 * a free Basic plan. Needs RAPIDAPI_KEY. Hotels.com's own API (Expedia Rapid)
 * is partner-only, so this is the self-serve route.
 *
 * A search is two requests: the destination is first turned into a Hotels.com
 * region id (cached), then that region is searched for the dates.
 *
 * Field names follow the API's documented responses, which mirror Hotels.com's
 * own property search. Like the SerpApi adapter, this is tested against sample
 * responses in that shape, not yet against the live service.
 */

const HOST = "hotels-com-provider.p.rapidapi.com";

export interface HcRegion {
  gaiaId?: string;
  type?: string;
  hotelId?: string;
  regionNames?: { fullName?: string; shortName?: string };
}

export interface HcProperty {
  id: string;
  name: string;
  star?: number | null;
  reviews?: { score?: number; total?: number };
  neighborhood?: { name?: string } | null;
  mapMarker?: { latLong?: { latitude: number; longitude: number } };
  propertyImage?: { image?: { url?: string } };
  price?: {
    lead?: { amount?: number; formatted?: string };
    displayMessages?: { lineItems?: { value?: string }[] }[];
  };
  offerSummary?: { messages?: { message?: string }[] };
}

async function rapidapi(env: ProviderEnv, path: string, params: Record<string, string | number>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ domain: "US", locale: "en_US" });
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const res = await env.fetch(`https://${HOST}${path}?${qs}`, {
    headers: { "x-rapidapi-key": env.keys.RAPIDAPI_KEY, "x-rapidapi-host": HOST },
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Hotels.com (RapidAPI): ${String(data.message ?? data.error ?? res.status)}`);
  return data;
}

const regionCache = new Map<string, HcRegion[]>();

async function regions(env: ProviderEnv, query: string): Promise<HcRegion[]> {
  const key = query.trim().toLowerCase();
  const cached = regionCache.get(key);
  if (cached) return cached;
  const data = await rapidapi(env, "/v2/regions", { query });
  const list = Array.isArray(data.data) ? (data.data as HcRegion[]) : [];
  regionCache.set(key, list);
  return list;
}

/** "$1,234 total" in Hotels.com's price lines, if it shows one. */
function statedTotal(p: HcProperty): number | undefined {
  for (const msg of p.price?.displayMessages ?? []) {
    for (const line of msg.lineItems ?? []) {
      const m = line.value?.match(/\$([\d,]+(?:\.\d+)?)\s+total/i);
      if (m) return Number(m[1].replaceAll(",", ""));
    }
  }
  return undefined;
}

export function hotelsComUrl(id: string, params: HotelSearch): string {
  return `https://www.hotels.com/h${encodeURIComponent(id)}.Hotel-Information?chkin=${params.checkIn}&chkout=${params.checkOut}&rm1=a${params.guests}`;
}

export function mapHotelsCom(data: Record<string, unknown>, params: HotelSearch, matchId?: string): ProviderResult {
  const nights = Math.max(1, daysBetween(params.checkIn, params.checkOut));
  const rooms = Math.max(1, params.rooms);
  const properties = Array.isArray(data.properties) ? (data.properties as HcProperty[]) : [];

  const offers: Offer[] = properties
    .filter((p) => p.id && p.name && typeof p.price?.lead?.amount === "number")
    .map((p) => {
      const nightly = Math.round(p.price!.lead!.amount!);
      // The lead price is one room per night; a stated total covers one room for the stay.
      const stay = (statedTotal(p) ?? nightly * nights) * rooms;
      const tags: string[] = [];
      if (p.id === matchId) tags.push("Matches your search");
      if ((p.offerSummary?.messages ?? []).some((m) => /free cancellation/i.test(m.message ?? ""))) tags.push("Free cancellation");
      const score = p.reviews?.score;
      const point = p.mapMarker?.latLong;
      return {
        id: `hc-${p.id}-${params.checkIn}-${params.checkOut}`,
        category: "hotels" as const,
        provider: "Hotels.com",
        title: p.name,
        subtitle: `${p.star ? `${"★".repeat(Math.round(p.star))} · ` : ""}${p.neighborhood?.name ? `${p.neighborhood.name}, ` : ""}${params.location}`,
        price: { amount: nightly, currency: "USD" },
        priceUnit: "per night",
        totalPrice: { amount: Math.round(stay), currency: "USD" },
        // Hotels.com scores out of 10; offers use 0–5.
        rating: typeof score === "number" ? Math.round(score * 5) / 10 : undefined,
        reviewCount: p.reviews?.total,
        start: `${params.checkIn}T15:00`,
        end: `${params.checkOut}T11:00`,
        location: p.neighborhood?.name ? `${p.neighborhood.name}, ${params.location}` : params.location,
        tags,
        details: {
          Nights: String(nights),
          Rooms: String(rooms),
          Guests: String(params.guests),
          ...(p.price?.lead?.formatted ? { "Hotels.com price": `${p.price.lead.formatted} / night` } : {}),
          ...(typeof score === "number" ? { "Guest score": `${score}/10` } : {}),
        },
        bookingUrl: hotelsComUrl(p.id, params),
        altLinks: altLinks.hotels(params.location, params.checkIn, params.checkOut, params.guests, rooms, p.name),
        imageUrl: p.propertyImage?.image?.url,
        imageHue: (p.name.charCodeAt(0) * 41) % 360,
        points: point ? [{ lat: point.latitude, lon: point.longitude, label: p.name }] : [],
      };
    })
    // A hotel searched for by name goes first.
    .sort((a, b) => Number(b.tags.includes("Matches your search")) - Number(a.tags.includes("Matches your search")));
  return { offers };
}

export const hotelsComHotels: SearchProvider<"hotels"> = {
  name: "Hotels.com",
  requiredKeys: ["RAPIDAPI_KEY"],
  async search(params: HotelSearch, _ctx: SearchContext, env: ProviderEnv) {
    const found = await regions(env, params.location);
    // "Andaz Tokyo, Tokyo" finds the hotel itself first: search the area it's in and put it on top.
    const hotel = found.find((r) => r.type === "HOTEL" && r.hotelId);
    const area = found.find((r) => r.type !== "HOTEL" && r.gaiaId);
    if (!area) return { offers: [], insights: [`Hotels.com doesn't recognise "${params.location}". Try the city name.`] };
    const data = await rapidapi(env, "/v2/hotels/search", {
      region_id: area.gaiaId!,
      checkin_date: params.checkIn,
      checkout_date: params.checkOut,
      adults_number: params.guests,
      sort_order: "RECOMMENDED",
      page_number: 1,
    });
    return mapHotelsCom(data, params, hotel?.hotelId);
  },
};
