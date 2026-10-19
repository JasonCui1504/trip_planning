import type { Category, Offer, ProviderStatus, SearchParamsMap } from "../../shared/types.ts";
import type { KeyName } from "../config.ts";
import { searchActivities } from "./mock/activities.ts";
import { searchCars } from "./mock/cars.ts";
import { searchDining } from "./mock/dining.ts";
import { searchFlights } from "./mock/flights.ts";
import { searchHotels } from "./mock/lodging.ts";

/**
 * A search provider for one category. To connect a real API, write a module
 * that implements this interface (mapping the API's response into `Offer`s)
 * and register it in `liveProviders` below. When its credentials are missing
 * the registry falls back to the mock provider automatically.
 */
export interface SearchContext {
  /** Today's date (YYYY-MM-DD); prices are quoted as of this day. */
  asOf: string;
}

export interface SearchProvider<C extends Category> {
  name: string;
  /** Env vars this provider needs; it is only used when all of them are set. */
  requiredKeys: KeyName[];
  search(params: SearchParamsMap[C], ctx: SearchContext): Promise<Offer[]>;
}

type ProviderMap = { [C in Category]: SearchProvider<C> };
type LiveProviderMap = { [C in Category]: SearchProvider<C>[] };

const mockProviders: ProviderMap = {
  flights: { name: "Mock flights", requiredKeys: [], search: searchFlights },
  hotels: { name: "Mock stays", requiredKeys: [], search: searchHotels },
  activities: { name: "Mock experiences", requiredKeys: [], search: searchActivities },
  cars: { name: "Mock rentals", requiredKeys: [], search: searchCars },
  dining: { name: "Mock dining", requiredKeys: [], search: searchDining },
};

// Real integrations go here, in order of preference, e.g.
//   flights: [amadeusFlights, duffelFlights]
const liveProviders: LiveProviderMap = {
  flights: [],
  hotels: [],
  activities: [],
  cars: [],
  dining: [],
};

/** Env vars that would unlock a live provider, surfaced in the UI as hints. */
const CANDIDATE_KEYS: Record<Category, KeyName[]> = {
  flights: ["AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET", "DUFFEL_API_KEY"],
  hotels: ["AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET", "BOOKING_AFFILIATE_ID"],
  activities: ["AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET", "GETYOURGUIDE_API_KEY"],
  cars: ["RENTALCARS_API_KEY"],
  dining: ["YELP_API_KEY"],
};

export function createRegistry(keys: Record<KeyName, string>, live: LiveProviderMap = liveProviders) {
  function providerFor<C extends Category>(category: C): { provider: SearchProvider<C>; live: boolean } {
    const candidates = live[category] as SearchProvider<C>[];
    const ready = candidates.find((p) => p.requiredKeys.every((k) => keys[k]));
    return ready ? { provider: ready, live: true } : { provider: mockProviders[category] as SearchProvider<C>, live: false };
  }

  /** Run a search with whichever provider is active for the category. */
  async function search<C extends Category>(category: C, params: SearchParamsMap[C], ctx: SearchContext) {
    const { provider, live } = providerFor(category);
    return { provider: provider.name, live, offers: await provider.search(params, ctx) };
  }

  return {
    providerFor,
    search,
    status(): ProviderStatus[] {
      return (Object.keys(mockProviders) as Category[]).map((category) => {
        const { provider, live } = providerFor(category);
        return { category, provider: provider.name, live, envKeys: CANDIDATE_KEYS[category] };
      });
    },
  };
}

export type Registry = ReturnType<typeof createRegistry>;
