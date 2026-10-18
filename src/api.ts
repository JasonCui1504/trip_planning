import type { Category, Offer, ProviderStatus, SearchParamsMap, SearchResponse, Trip, TripInput, TripItem, Place } from "../shared/types.ts";

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export type NewItem = Omit<TripItem, "id" | "addedAt">;

export const api = {
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
};

export type { Offer };
