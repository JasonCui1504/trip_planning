import { useEffect, useState } from "react";
import type { Trip } from "../../shared/types.ts";
import { api } from "../api.ts";
import { dateRange, daysBetween, money, today } from "../format.ts";
import { Icon } from "../icons.tsx";
import { href, navigate } from "../router.ts";
import { TripForm } from "./TripForm.tsx";

function countdown(trip: Trip): string {
  const t = today();
  if (trip.endDate < t) return "Completed";
  if (trip.startDate <= t) return "Happening now";
  const days = daysBetween(t, trip.startDate);
  return days === 1 ? "Tomorrow" : `In ${days} days`;
}

export function Home() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.trips().then(setTrips).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="home">
      <section className="hero card">
        <div>
          <h1>Plan the whole trip in one place.</h1>
          <p className="muted">
            Search flights, stays, activities, rental cars and restaurants side by side, save the options you like to a trip board, then book and track
            everything on a day-by-day itinerary and budget.
          </p>
        </div>
        <TripForm submitLabel="Create trip" onSubmit={async (input) => navigate({ page: "trip", id: (await api.createTrip(input)).id, tab: "search" })} />
      </section>

      <section>
        <h2 className="section-title">Your trips</h2>
        {error && <p className="error">{error}</p>}
        {trips?.length === 0 && <p className="muted empty">No trips yet — create one above to open its workshop.</p>}
        <div className="trip-grid">
          {trips?.map((trip) => {
            const booked = trip.items.filter((i) => i.status === "booked").reduce((s, i) => s + i.cost.amount, 0);
            return (
              <a key={trip.id} className="card trip-card" href={href({ page: "trip", id: trip.id, tab: "search" })}>
                <div className="trip-card-top">
                  <span className="pill">{countdown(trip)}</span>
                  <span className="muted small">
                    <Icon name="users" size={14} /> {trip.travelers}
                  </span>
                </div>
                <h3>{trip.name}</h3>
                <p className="muted">
                  {trip.origin ? `${trip.origin} → ` : ""}
                  {trip.destination} · {dateRange(trip.startDate, trip.endDate)}
                </p>
                <div className="trip-card-stats">
                  <span>{trip.items.length} saved</span>
                  <span>{trip.items.filter((i) => i.status === "booked").length} booked</span>
                  <span>
                    {money(booked, trip.currency)}
                    {trip.budget ? ` / ${money(trip.budget, trip.currency)}` : ""}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
