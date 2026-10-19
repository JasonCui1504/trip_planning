import type { Category, Offer, ProviderStatus, SearchParamsMap } from "../../shared/types.ts";
import type { EditCatalog } from "../edit.ts";
import type { KeyName } from "../config.ts";
import { CATEGORIES } from "../../shared/types.ts";
import { searchLinks } from "./links.ts";
import { hotelsComHotels } from "./hotelscom.ts";
import { serpapiFlights } from "./serpapi.ts";

/**
 * A search provider for one category. To connect a real API, write a module
 * that implements this interface (mapping the API's response into `Offer`s)
 * and register it in `liveProviders` below. When no provider for a category
 * has its credentials, searches in that category return no results (never
 * made-up ones), just links to run the same search on real sites.
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

type LiveProviderMap = { [C in Category]: SearchProvider<C>[] };

export const NOT_CONNECTED = "Not connected";

// Real integrations, in order of preference. Each is used only once all of
// its requiredKeys are set; otherwise the category has no data source.
const liveProviders: LiveProviderMap = {
  flights: [serpapiFlights],
  hotels: [hotelsComHotels],
  activities: [],
  cars: [],
  dining: [],
};

/** Env vars that would unlock a live provider, surfaced in the UI as hints. */
const CANDIDATE_KEYS: Record<Category, KeyName[]> = {
  flights: ["SERPAPI_API_KEY"],
  hotels: ["RAPIDAPI_KEY"],
  activities: [],
  cars: [],
  dining: [],
};

export interface RegistryOptions {
  live?: LiveProviderMap;
  fetch?: typeof fetch;
  /** Chase Edit list used to badge hotel results. */
  edit?: EditCatalog;
}

export function createRegistry(keys: Record<KeyName, string>, { live = liveProviders, fetch: fetchImpl = fetch, edit }: RegistryOptions = {}) {
  function providerFor<C extends Category>(category: C): SearchProvider<C> | undefined {
    const candidates = live[category] as SearchProvider<C>[];
    return candidates.find((p) => p.requiredKeys.every((k) => keys[k]));
  }

  /** Run a search with whichever provider is active for the category. */
  async function search<C extends Category>(category: C, params: SearchParamsMap[C], ctx: SearchContext) {
    const links = searchLinks(category, params);
    const provider = providerFor(category);
    if (!provider) return { provider: NOT_CONNECTED, live: false, offers: [] as Offer[], insights: [] as string[], links };
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
    return { provider: provider.name, live: true, offers: result.offers, insights: result.insights ?? [], links };
  }

  return {
    providerFor,
    search,
    status(): ProviderStatus[] {
      return CATEGORIES.map((category) => {
        const provider = providerFor(category);
        return { category, provider: provider?.name ?? NOT_CONNECTED, live: Boolean(provider), envKeys: CANDIDATE_KEYS[category] };
      });
    },
  };
}

export type Registry = ReturnType<typeof createRegistry>;
