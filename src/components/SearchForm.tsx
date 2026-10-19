import { useState, type FormEvent } from "react";
import type { Category, SearchParamsMap, Trip } from "../../shared/types.ts";
import { addDays, daysBetween } from "../format.ts";
import { PlaceInput } from "./PlaceInput.tsx";

export type AnyParams = Partial<{ [C in Category]: SearchParamsMap[C] }>;

const ACTIVITY_CATEGORIES = ["Tours", "Food & drink", "Culture", "Outdoors", "Nightlife", "Day trips", "Classes"];
const CUISINES = ["Local", "Seafood", "Italian", "Japanese", "Vegetarian", "Steakhouse", "Street food", "Bakery & café", "Fine dining", "Tapas & small plates"];

/** Sensible starting values for each search, taken from the trip itself. */
export function defaultParams<C extends Category>(category: C, trip: Trip): SearchParamsMap[C] {
  const firstFullDay = daysBetween(trip.startDate, trip.endDate) > 1 ? addDays(trip.startDate, 1) : trip.startDate;
  const defaults: SearchParamsMap = {
    flights: { origin: trip.origin, destination: trip.destination, departDate: trip.startDate, returnDate: trip.endDate, adults: trip.travelers, cabin: "economy" },
    hotels: { location: trip.destination, checkIn: trip.startDate, checkOut: trip.endDate > trip.startDate ? trip.endDate : addDays(trip.startDate, 1), guests: trip.travelers, rooms: Math.ceil(trip.travelers / 2) },
    activities: { location: trip.destination, date: firstFullDay, category: "" },
    cars: { location: trip.destination, pickupDate: trip.startDate, dropoffDate: trip.endDate },
    dining: { location: trip.destination, cuisine: "", date: firstFullDay },
  };
  return defaults[category];
}

export function SearchForm<C extends Category>({ category, trip, initial, busy, onSearch }: { category: C; trip: Trip; initial: SearchParamsMap[C]; busy: boolean; onSearch: (params: SearchParamsMap[C]) => void }) {
  const [params, setParams] = useState<SearchParamsMap[C]>(initial);
  // Loosely typed setter keeps the per-category forms below compact.
  const p = params as unknown as Record<string, string | number | undefined>;
  const set = (key: string, value: string | number) => setParams((prev) => ({ ...prev, [key]: value }));
  const text = (key: string) => (p[key] ?? "") as string;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(params);
  };

  const dateField = (key: string, label: string, opts: { required?: boolean; min?: string } = {}) => (
    <label>
      {label}
      <input type="date" value={text(key)} min={opts.min} required={opts.required} onChange={(e) => set(key, e.target.value)} />
    </label>
  );
  const numberField = (key: string, label: string, min: number, max: number) => (
    <label className="narrow">
      {label}
      <input type="number" min={min} max={max} value={p[key] ?? min} onChange={(e) => set(key, Number(e.target.value))} />
    </label>
  );
  const placeField = (key: string, label: string) => (
    <label className="grow">
      {label}
      <PlaceInput value={text(key)} onChange={(v) => set(key, v)} required />
    </label>
  );

  return (
    <form className="search-form" onSubmit={submit}>
      {category === "flights" && (
        <>
          {placeField("origin", "From")}
          {placeField("destination", "To")}
          <label className="grow">
            Also compare <span className="muted">(optional)</span>
            <input value={text("alsoTo")} onChange={(e) => set("alsoTo", e.target.value)} placeholder="e.g. Osaka, Seoul" title="Other destinations to search at the same time, separated by commas" />
          </label>
          {dateField("departDate", "Depart", { required: true })}
          {dateField("returnDate", "Return (optional)", { min: text("departDate") })}
          {numberField("adults", "Adults", 1, 9)}
          <label className="narrow">
            Cabin
            <select value={text("cabin")} onChange={(e) => set("cabin", e.target.value)}>
              <option value="economy">Economy</option>
              <option value="premium">Premium</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </label>
        </>
      )}
      {category === "hotels" && (
        <>
          {placeField("location", "Destination")}
          {dateField("checkIn", "Check-in", { required: true })}
          {dateField("checkOut", "Check-out", { required: true, min: text("checkIn") })}
          {numberField("guests", "Guests", 1, 16)}
          {numberField("rooms", "Rooms", 1, 8)}
        </>
      )}
      {category === "activities" && (
        <>
          {placeField("location", "Destination")}
          {dateField("date", "Day")}
          <label>
            Type
            <select value={text("category")} onChange={(e) => set("category", e.target.value)}>
              <option value="">Everything</option>
              {ACTIVITY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {category === "cars" && (
        <>
          {placeField("location", "Pick up at")}
          {dateField("pickupDate", "Pick-up", { required: true })}
          {dateField("dropoffDate", "Drop-off", { required: true, min: text("pickupDate") })}
        </>
      )}
      {category === "dining" && (
        <>
          {placeField("location", "Destination")}
          {dateField("date", "Day")}
          <label>
            Cuisine
            <select value={text("cuisine")} onChange={(e) => set("cuisine", e.target.value)}>
              <option value="">Any</option>
              {CUISINES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </>
      )}
      <div className="search-form-actions">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setParams(defaultParams(category, trip))}>
          Reset to trip
        </button>
      </div>
    </form>
  );
}
