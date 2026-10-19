import type {
  Category,
  EditHotel,
  GeoPoint,
  GeoResult,
  Offer,
  Place,
  ProviderStatus,
  RouteResult,
  SearchParamsMap,
  SearchResponse,
  Trip,
  TripInput,
  TripItem,
  Watch,
} from "../shared/types.ts";

export const UNAUTHORIZED_EVENT = "tw:unauthorized";

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  // Session expired or never logged in: let the app show the login screen.
  if (res.status === 401 && !url.startsWith("/api/login")) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export type NewItem = Omit<TripItem, "id" | "addedAt">;

export const api = {
  session: () => request<{ authRequired: boolean; authenticated: boolean }>("GET", "/api/session"),
  login: (password: string) => request<{ ok: true }>("POST", "/api/login", { password }),
  logout: () => request<{ ok: true }>("POST", "/api/logout"),

  providers: () => request<ProviderStatus[]>("GET", "/api/providers"),
  places: (q: string) => request<Place[]>("GET", `/api/places?q=${encodeURIComponent(q)}`),
  search: <C extends Category>(category: C, params: SearchParamsMap[C]) =>
    request<SearchResponse>("POST", `/api/search/${category}`, params),

  trips: () => request<Trip[]>("GET", "/api/trips"),
  trip: (id: string) => request<Trip>("GET", `/api/trips/${id}`),
  createTrip: (input: TripInput) => request<Trip>("POST", "/api/trips", input),
  updateTrip: (id: string, patch: Partial<Trip>) => request<Trip>("PATCH", `/api/trips/${id}`, patch),
  deleteTrip: (id: string) => request<void>("DELETE", `/api/trips/${id}`),

  addItem: (tripId: string, item: Partial<NewItem>) => request<TripItem>("POST", `/api/trips/${tripId}/items`, item),
  updateItem: (tripId: string, itemId: string, patch: Partial<TripItem>) =>
    request<TripItem>("PATCH", `/api/trips/${tripId}/items/${itemId}`, patch),
  deleteItem: (tripId: string, itemId: string) => request<void>("DELETE", `/api/trips/${tripId}/items/${itemId}`),

  geocode: (q: string) => request<GeoResult[]>("GET", `/api/geo/search?q=${encodeURIComponent(q)}`),
  route: (points: GeoPoint[]) => request<RouteResult>("POST", "/api/geo/route", { points }),

  editHotels: (location: string) =>
    request<{ hotels: EditHotel[]; total: number; fetchedAt: string | null; source: string }>("GET", `/api/edit?location=${encodeURIComponent(location)}`),

  watches: () => request<Watch[]>("GET", "/api/watches"),
  watch: <C extends Category>(category: C, params: SearchParamsMap[C], offerId: string, tripId?: string) =>
    request<Watch>("POST", "/api/watches", { category, params, offerId, tripId }),
  refreshWatches: () => request<Watch[]>("POST", "/api/watches/refresh"),
  unwatch: (id: string) => request<void>("DELETE", `/api/watches/${id}`),
};

export type { Offer };
