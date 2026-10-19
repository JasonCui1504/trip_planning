import type { TravelBudgetLink, Trip, TripItem } from "../shared/types.ts";
import { addDays } from "./dates.ts";

/**
 * Export a trip to the travel budget on jascui.com (/travel_budget), using
 * that site's own JSON API with its username/password login. Nothing on that
 * site changes; this only calls endpoints its own pages use:
 *
 *   POST /api/travel/auth            sign in (session cookie)
 *   POST /api/travel/trips           new trip { name, start_date, end_date }
 *   PUT  /api/travel/trips/:id       name, dates, doc
 *   POST /api/travel/events          a calendar block on one day, in half hours
 *   PUT  /api/travel/days            a day's stay and rental car
 *   POST /api/travel/ideas           a line in the trip's Ideas list
 *   DELETE /api/travel/events/:id, /api/travel/ideas/:id
 *
 * Mapping: dated flights, activities, dinners and custom items become calendar
 * events; stays fill each night's accommodation, cars each day's rental car;
 * ideas and undated items go to the Ideas list. Re-exporting the same trip
 * replaces what the last export wrote and leaves everything else alone.
 */

export interface TravelBudgetOptions {
  url: string;
  username?: string;
  password?: string;
  fetch?: typeof fetch;
}

type EventStatus = "none" | "unnecessary" | "not_booked" | "booked" | "transit";

export interface BudgetEvent {
  date: string;
  start_hour: number;
  end_hour: number;
  title: string;
  status: EventStatus;
  notes: string;
  location: string;
  reservation_link: string;
}

export interface BudgetDay {
  date: string;
  accommodation?: string;
  accommodation_status?: string;
  stay_link?: string;
  stay_address?: string;
  car?: string;
  car_status?: string;
  car_link?: string;
  car_notes?: string;
}

export interface BudgetPlan {
  trip: { name: string; start_date: string; end_date: string };
  doc: string;
  events: BudgetEvent[];
  days: BudgetDay[];
  ideas: string[];
}

/** The day fields an export writes, cleared again when a re-export no longer covers that day. */
const DAY_FIELDS = ["accommodation", "accommodation_status", "stay_link", "stay_address", "car", "car_status", "car_link", "car_notes"] as const;

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** "2027-04-01T09:40" → 9.5: the travel budget calendar works in half hours. */
function hourOf(iso: string, roundUp = false): number {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  const minutes = (h || 0) * 60 + (m || 0);
  return (roundUp ? Math.ceil(minutes / 30) : Math.floor(minutes / 30)) / 2;
}

/** How long to block out when an item has a start time but no end on the same day. */
function defaultHours(item: TripItem): number {
  if (item.durationMinutes) return item.durationMinutes / 60;
  return item.category === "dining" ? 1.5 : item.category === "activities" ? 3 : 1;
}

function block(at: string, end: string | undefined, hours: number): Pick<BudgetEvent, "date" | "start_hour" | "end_hour"> {
  const date = at.slice(0, 10);
  const start = at.length > 10 ? Math.min(23.5, hourOf(at)) : 9;
  const sameDayEnd = end && end.length > 10 && end.slice(0, 10) === date ? hourOf(end, true) : undefined;
  // Anything running past midnight is drawn to the end of its first day.
  const finish = sameDayEnd ?? (end && end.slice(0, 10) > date ? 24 : start + Math.max(0.5, Math.round(hours * 2) / 2));
  return { date, start_hour: start, end_hour: Math.min(24, Math.max(start + 0.5, finish)) };
}

function notesFor(item: TripItem): string {
  return [
    item.subtitle,
    item.confirmation && `Confirmation: ${item.confirmation}`,
    item.cost.amount > 0 && `Cost: ${usd(item.cost.amount)}${item.status === "booked" ? "" : " (not booked yet)"}`,
    item.provider && `Via ${item.provider}`,
    item.notes,
  ]
    .filter(Boolean)
    .join("\n");
}

function ideaLine(item: TripItem): string {
  return [item.title, item.cost.amount > 0 ? usd(item.cost.amount) : "", item.bookingUrl ?? ""].filter(Boolean).join(" — ");
}

/** Turn a trip into what the travel budget stores. Pure, so it's easy to test. */
export function buildPlan(trip: Trip): BudgetPlan {
  const events: BudgetEvent[] = [];
  const days = new Map<string, BudgetDay>();
  const ideas: string[] = [];
  const day = (date: string) => days.get(date) ?? days.set(date, { date }).get(date)!;

  // Booked items first, so a booked stay or car wins a day over a shortlisted one.
  const items = [...trip.items].sort((a, b) => Number(b.status === "booked") - Number(a.status === "booked"));
  for (const item of items) {
    if (item.status === "idea" || !item.start) {
      ideas.push(ideaLine(item));
      continue;
    }
    const booked = item.status === "booked";
    const start = item.start.slice(0, 10);
    const end = (item.end ?? item.start).slice(0, 10);

    if (item.category === "hotels") {
      // One entry per night: check-in day up to the day before check-out.
      for (let d = start; d < end || d === start; d = addDays(d, 1)) {
        const info = day(d);
        if (info.accommodation) continue;
        Object.assign(info, { accommodation: item.title, accommodation_status: booked ? "CONFIRMED" : "", stay_link: item.bookingUrl ?? "", stay_address: item.location ?? "" });
      }
      continue;
    }
    if (item.category === "cars") {
      for (let d = start; d <= end; d = addDays(d, 1)) {
        const info = day(d);
        if (info.car) continue;
        const notes = [item.subtitle, item.confirmation && `Confirmation: ${item.confirmation}`, item.cost.amount > 0 && `Cost: ${usd(item.cost.amount)}`].filter(Boolean).join(" · ");
        Object.assign(info, { car: item.title, car_status: booked ? "CONFIRMED" : "", car_link: item.bookingUrl ?? "", car_notes: notes });
      }
      continue;
    }

    const status: EventStatus = item.category === "flights" ? "transit" : booked ? "booked" : "not_booked";
    const common = { status, notes: notesFor(item), location: item.location ?? "", reservation_link: item.bookingUrl ?? "" };
    // A flight's end is its arrival, so the block covers the time in the air.
    events.push({ ...block(item.start, item.end, defaultHours(item)), title: item.title, ...common });
    for (const m of item.moments ?? []) {
      events.push({ ...block(m.at, undefined, 1), title: `${m.label} · ${item.title}`, ...common, notes: `${common.notes}\nDeparture time only; check the arrival time.` });
    }
  }

  // Cover anything dated just outside the trip, like a return flight the day after.
  const dates = [trip.startDate, trip.endDate, ...events.map((e) => e.date), ...days.keys()].sort();
  const booked = trip.items.filter((i) => i.status === "booked").reduce((s, i) => s + i.cost.amount, 0);
  const planned = trip.items.filter((i) => i.status === "shortlisted").reduce((s, i) => s + i.cost.amount, 0);
  const doc = [
    `## From Trip Workshop`,
    `${trip.origin ? `${trip.origin} → ` : ""}${trip.destination} · ${trip.travelers} traveler${trip.travelers === 1 ? "" : "s"}${trip.budget ? ` · budget ${usd(trip.budget)}` : ""}`,
    `Booked ${usd(booked)} · shortlisted ${usd(planned)}`,
    trip.items.length ? `## Bookings\n${items.filter((i) => i.status !== "idea").map((i) => `- [${i.status === "booked" ? "x" : " "}] ${[i.title, i.cost.amount > 0 ? usd(i.cost.amount) : "", i.confirmation ? `conf ${i.confirmation}` : "", i.bookingUrl ?? ""].filter(Boolean).join(" — ")}`).join("\n")}` : "",
    trip.notes ? `## Notes\n${trip.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    trip: { name: trip.name, start_date: dates[0], end_date: dates[dates.length - 1] },
    doc,
    events: events.sort((a, b) => a.date.localeCompare(b.date) || a.start_hour - b.start_hour),
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    ideas,
  };
}

export class TravelBudgetError extends Error {
  constructor(
    message: string,
    /** What was written before the failure, so a retry updates it instead of duplicating it. */
    readonly partial?: TravelBudgetLink,
  ) {
    super(message);
  }
}

/** A signed-in client for the travel budget's API. */
async function connect({ url, username, password, fetch: fetchImpl = fetch }: TravelBudgetOptions) {
  if (!username || !password) throw new TravelBudgetError("Enter your travel budget username and password.");
  const base = url.replace(/\/+$/, "");
  const login = await fetchImpl(`${base}/api/travel/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(20_000),
  });
  const loginBody = (await login.json().catch(() => ({}))) as { error?: string };
  if (!login.ok) throw new TravelBudgetError(`Travel budget sign-in failed: ${loginBody.error ?? login.status}`);
  const cookie = (login.headers.getSetCookie?.() ?? [login.headers.get("set-cookie") ?? ""]).map((c) => c.split(";")[0]).find((c) => c.startsWith("travel_session="));
  if (!cookie) throw new TravelBudgetError("Travel budget sign-in didn't return a session.");

  async function call<T = { id?: number }>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: { Cookie: cookie!, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new TravelBudgetError(`Travel budget ${method} ${path}: ${data.error ?? res.status}`);
    return data;
  }

  /** Whether a trip still exists (it may have been deleted on the site since the last export). */
  async function tripExists(id: number): Promise<boolean> {
    const res = await fetchImpl(`${base}/travel_budget/trips/${id}`, { headers: { Cookie: cookie! }, redirect: "manual", signal: AbortSignal.timeout(20_000) });
    return res.status === 200;
  }

  return { base, call, tripExists };
}

/** Create or update the trip on the travel budget; returns the link to store on the trip. */
export async function exportTrip(trip: Trip, options: TravelBudgetOptions): Promise<TravelBudgetLink> {
  const plan = buildPlan(trip);
  const { base, call, tripExists } = await connect(options);
  const previous = trip.travelBudget && (await tripExists(trip.travelBudget.tripId)) ? trip.travelBudget : undefined;

  let tripId: number;
  if (previous) {
    tripId = previous.tripId;
    await call("PUT", `/api/travel/trips/${tripId}`, plan.trip);
  } else {
    tripId = (await call<{ id: number }>("POST", "/api/travel/trips", plan.trip)).id;
    // The doc is written once, so notes added on the site aren't overwritten by later exports.
    await call("PUT", `/api/travel/trips/${tripId}`, { ...plan.trip, doc: plan.doc });
  }

  const link: TravelBudgetLink = { tripId, url: `${base}/travel_budget/trips/${tripId}`, eventIds: [], ideaIds: [], days: [], exportedAt: new Date().toISOString() };
  // Rows from the last export that are still on the site until they're deleted below.
  const oldEvents = [...(previous?.eventIds ?? [])];
  const oldIdeas = [...(previous?.ideaIds ?? [])];
  try {
    if (previous) {
      while (oldEvents.length) {
        await call("DELETE", `/api/travel/events/${oldEvents[0]}`);
        oldEvents.shift();
      }
      while (oldIdeas.length) {
        await call("DELETE", `/api/travel/ideas/${oldIdeas[0]}`);
        oldIdeas.shift();
      }
      const blank = Object.fromEntries(DAY_FIELDS.map((f) => [f, ""]));
      for (const date of previous.days.filter((d) => !plan.days.some((p) => p.date === d))) {
        await call("PUT", "/api/travel/days", { trip_id: tripId, date, ...blank });
      }
    }
    for (const e of plan.events) link.eventIds.push((await call<{ id: number }>("POST", "/api/travel/events", { trip_id: tripId, ...e })).id);
    for (const text of plan.ideas) link.ideaIds.push((await call<{ id: number }>("POST", "/api/travel/ideas", { trip_id: tripId, text })).id);
    for (const d of plan.days) {
      await call("PUT", "/api/travel/days", { trip_id: tripId, ...d });
      link.days.push(d.date);
    }
  } catch (err) {
    // Keep the old day list too, so the next export still clears those days.
    const days = [...new Set([...link.days, ...(previous?.days ?? [])])];
    const partial = { ...link, eventIds: [...oldEvents, ...link.eventIds], ideaIds: [...oldIdeas, ...link.ideaIds], days };
    throw new TravelBudgetError(err instanceof Error ? err.message : String(err), partial);
  }
  return link;
}
