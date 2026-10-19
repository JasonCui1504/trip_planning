import type { Category, Offer, ProviderStatus, SearchParamsMap } from "../../shared/types.ts";
import type { EditCatalog } from "../edit.ts";
import type { KeyName } from "../config.ts";
import { searchActivities } from "./mock/activities.ts";
import { searchCars } from "./mock/cars.ts";
import { searchDining } from "./mock/dining.ts";
import { searchFlights } from "./mock/flights.ts";
import { searchHotels } from "./mock/lodging.ts";
import { serpapiFlights, serpapiHotels } from "./serpapi.ts";

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

/** Live providers get their credentials (and a fetch to use) from here. */
export interface ProviderEnv {
  keys: Record<KeyName, string>;
  fetch: typeof fetch;
}

export interface ProviderResult {
  offers: Offer[];
  insights?: string[];
}

export interface SearchProvider<C extends Category> {
  name: string;
  /** Env vars this provider needs; it is only used when all of them are set. */
  requiredKeys: KeyName[];
  search(params: SearchParamsMap[C], ctx: SearchContext, env: ProviderEnv): Promise<Offer[] | ProviderResult>;
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

// Real integrations, in order of preference. Each is used only once all of
// its requiredKeys are set; otherwise the category falls back to mock data.
const liveProviders: LiveProviderMap = {
  flights: [serpapiFlights],
  hotels: [serpapiHotels],
  activities: [],
  cars: [],
  dining: [],
};

/** Env vars that would unlock a live provider, surfaced in the UI as hints. */
const CANDIDATE_KEYS: Record<Category, KeyName[]> = {
  flights: ["SERPAPI_API_KEY"],
  hotels: ["SERPAPI_API_KEY"],
  activities: ["GETYOURGUIDE_API_KEY"],
  cars: ["RENTALCARS_API_KEY"],
  dining: ["YELP_API_KEY"],
};

export interface RegistryOptions {
  live?: LiveProviderMap;
  fetch?: typeof fetch;
  /** Chase Edit list used to badge hotel results. */
  edit?: EditCatalog;
}

export function createRegistry(keys: Record<KeyName, string>, { live = liveProviders, fetch: fetchImpl = fetch, edit }: RegistryOptions = {}) {
  function providerFor<C extends Category>(category: C): { provider: SearchProvider<C>; live: boolean } {
    const candidates = live[category] as SearchProvider<C>[];
    const ready = candidates.find((p) => p.requiredKeys.every((k) => keys[k]));
    return ready ? { provider: ready, live: true } : { provider: mockProviders[category] as SearchProvider<C>, live: false };
  }

  /** Run a search with whichever provider is active for the category. */
  async function search<C extends Category>(category: C, params: SearchParamsMap[C], ctx: SearchContext) {
    const { provider, live } = providerFor(category);
    const raw = await provider.search(params, ctx, { keys, fetch: fetchImpl });
    const result: ProviderResult = Array.isArray(raw) ? { offers: raw } : raw;
    if (category === "hotels" && edit) {
      const location = (params as SearchParamsMap["hotels"]).location;
      for (const offer of result.offers) {
        const match = await edit.match(offer.title, location);
        if (match) {
          offer.edit = { brand: match.brand, region: match.region, selectCredit: match.selectCredit };
          offer.tags.unshift(match.selectCredit ? "Chase Edit · $250 credit" : "Chase Edit");
        }
      }
    }
    return { provider: provider.name, live, offers: result.offers, insights: result.insights ?? [] };
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
