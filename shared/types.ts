// Types shared by the API server and the web client.

export type Category = "flights" | "hotels" | "activities" | "cars" | "dining";

export const CATEGORIES: Category[] = ["flights", "hotels", "activities", "cars", "dining"];

export interface Money {
  amount: number;
  currency: string;
}

// ---------- Search parameters ----------

export interface FlightSearch {
  origin: string;
  destination: string;
  departDate: string; // YYYY-MM-DD
  returnDate?: string;
  adults: number;
  cabin: "economy" | "premium" | "business" | "first";
}

export interface HotelSearch {
  location: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
}

export interface ActivitySearch {
  location: string;
  date?: string;
  category?: string;
}

export interface CarSearch {
  location: string;
  pickupDate: string;
  dropoffDate: string;
}

export interface DiningSearch {
  location: string;
  cuisine?: string;
  date?: string;
}

export interface SearchParamsMap {
  flights: FlightSearch;
  hotels: HotelSearch;
  activities: ActivitySearch;
  cars: CarSearch;
  dining: DiningSearch;
}

// ---------- Maps ----------

export interface GeoPoint {
  lat: number;
  lon: number;
  label?: string;
}

export interface RouteResult {
  durationMinutes: number;
  distanceKm: number;
  /** "osrm" = real road routing (OpenStreetMap), "google" = Google Maps, "estimate" = straight-line fallback. */
  source: "osrm" | "google" | "estimate";
  /** Simplified [lat, lon] path for drawing on a map. */
  geometry: [number, number][];
}

export interface GeoResult extends GeoPoint {
  label: string;
  detail: string;
}

export interface ExternalLink {
  label: string;
  url: string;
}

// ---------- Offers (search results) ----------

export interface FlightLeg {
  from: string;
  to: string;
  depart: string; // ISO datetime (local to departure city)
  arrive: string;
  durationMinutes: number;
  stops: number;
  stopCities: string[];
  carrier: string;
  flightNumber: string;
}

/**
 * A normalized search result. Every live provider maps its own
 * response into this shape so the UI never has to care where data came from.
 */
export interface Offer {
  id: string;
  category: Category;
  provider: string;
  title: string;
  subtitle: string;
  price: Money;
  /** Price unit shown next to the amount, e.g. "total", "per night". */
  priceUnit: string;
  /** The total cost used for budgeting. */
  totalPrice: Money;
  rating?: number; // 0-5
  reviewCount?: number;
  start?: string; // ISO datetime
  end?: string;
  location?: string;
  tags: string[];
  details: Record<string, string>;
  bookingUrl: string;
  imageHue?: number; // used to render a placeholder thumbnail
  imageUrl?: string;
  legs?: FlightLeg[];
  /** Map locations: airports for flights, the property for stays, etc. */
  points?: GeoPoint[];
  /** Time spent travelling (flights, transfers), used by the workshop. */
  durationMinutes?: number;
  /** The same search on other sites, for comparison shopping. */
  altLinks?: ExternalLink[];
  /** The same room priced by different booking sites (live hotel data only). */
  priceSources?: PriceSource[];
  /** Set when the hotel is in Chase's "The Edit" collection. */
  edit?: EditInfo;
}

export interface PriceSource {
  source: string;
  /** Total for the stay when known, otherwise per night (see `unit`). */
  amount: number;
  unit: "total" | "per night";
  link?: string;
  freeCancellation?: boolean;
}

export interface EditInfo {
  brand: string;
  region: string;
  /** Brand qualifies for the extra 2026 Select Hotels credit. */
  selectCredit: boolean;
}

/** A hotel from Chase's "The Edit" list (via edithotelsearch.com). */
export interface EditHotel extends EditInfo {
  name: string;
  location: string;
}

export interface SearchResponse {
  category: Category;
  provider: string;
  live: boolean;
  offers: Offer[];
  warnings: string[];
  /** Extra context from the provider, e.g. Google's "prices are low right now". */
  insights: string[];
  /** The same search on real booking sites. Shown when no live source is connected. */
  links: ExternalLink[];
}

// ---------- Trips ----------

export type ItemStatus = "idea" | "shortlisted" | "booked";

export interface TripItem {
  id: string;
  category: Category | "custom";
  status: ItemStatus;
  title: string;
  subtitle: string;
  start?: string;
  end?: string;
  location?: string;
  cost: Money;
  provider: string;
  bookingUrl?: string;
  confirmation?: string;
  notes?: string;
  details: Record<string, string>;
  /** The search result this item was saved from, if any. */
  offerId?: string;
  /** Extra points on the itinerary besides start/end, e.g. a return flight's departure. */
  moments?: { label: string; at: string }[];
  points?: GeoPoint[];
  durationMinutes?: number;
  altLinks?: ExternalLink[];
  addedAt: string;
}

// ---------- Workshop scenarios ----------

export interface DriveLeg {
  id: string;
  from: GeoPoint & { label: string };
  to: GeoPoint & { label: string };
  durationMinutes: number;
  distanceKm: number;
  source: RouteResult["source"];
  geometry: [number, number][];
}

/**
 * One combination of options to try out, e.g. "Fly into LAX + rent a car" vs
 * "Fly into SFO + drive down". Items are references to saved trip items.
 */
export interface Scenario {
  id: string;
  name: string;
  itemIds: string[];
  drives: DriveLeg[];
  notes: string;
  /** This plan's own schedule: start/end times that differ from the saved item's. */
  times?: Record<string, ScheduleTime>;
  createdAt: string;
}

export interface ScheduleTime {
  start?: string;
  end?: string;
}

/**
 * The trip as one scenario sees it: only that scenario's pieces, with its own
 * schedule applied. Used for the plan's itinerary and to export a plan.
 */
export function applyScenario(trip: Trip, scenario: Scenario): Trip {
  const items = scenario.itemIds
    .map((id) => trip.items.find((i) => i.id === id))
    .filter((i): i is TripItem => Boolean(i))
    .map((i) => {
      const t = scenario.times?.[i.id];
      return t ? { ...i, start: t.start ?? i.start, end: t.end ?? i.end } : i;
    });
  return { ...trip, items };
}

// ---------- Price watch ----------

export interface PricePoint {
  date: string; // YYYY-MM-DD
  amount: number;
  available: boolean;
}

/** A saved search result whose price is re-checked every day. */
export interface Watch {
  id: string;
  category: Category;
  tripId?: string;
  params: SearchParamsMap[Category];
  offerId: string;
  title: string;
  subtitle: string;
  provider: string;
  bookingUrl: string;
  currency: string;
  history: PricePoint[];
  createdAt: string;
  lastChecked?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Trip {
  id: string;
  name: string;
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: number;
  currency: string;
  notes: string;
  items: TripItem[];
  checklist: ChecklistItem[];
  scenarios: Scenario[];
  /** Where this trip was last exported on the jascui.com travel budget. */
  travelBudget?: TravelBudgetLink;
  createdAt: string;
  updatedAt: string;
}

/** What an export wrote to the travel budget, so the next export can replace it. */
export interface TravelBudgetLink {
  tripId: number;
  url: string;
  eventIds: number[];
  ideaIds: number[];
  /** Days whose stay or car fields the export filled. */
  days: string[];
  exportedAt: string;
}

export type TripInput = Pick<
  Trip,
  "name" | "origin" | "destination" | "startDate" | "endDate" | "travelers" | "budget" | "currency"
>;

export interface ProviderStatus {
  category: Category;
  /** The live source in use, or "Not connected". */
  provider: string;
  live: boolean;
  /** Env vars that would enable a live provider for this category. */
  envKeys: string[];
}

export interface Place {
  code: string;
  city: string;
  country: string;
  airport: string;
}

/**
 * Turn a search result into an item that can be saved on a trip. Per-person
 * prices are multiplied out so the trip budget reflects the whole party.
 */
export function offerToItem(offer: Offer, travelers: number, status: ItemStatus = "shortlisted"): Omit<TripItem, "id" | "addedAt"> {
  const perPerson = offer.category === "activities" || offer.category === "dining";
  const cost = perPerson
    ? { amount: offer.totalPrice.amount * Math.max(1, travelers), currency: offer.totalPrice.currency }
    : offer.totalPrice;
  return {
    category: offer.category,
    status,
    title: offer.title,
    subtitle: offer.subtitle,
    start: offer.start,
    end: offer.end,
    location: offer.location,
    cost,
    provider: offer.provider,
    bookingUrl: offer.bookingUrl,
    details: offer.details,
    offerId: offer.id,
    moments: offer.legs?.slice(1).map((leg) => ({ label: `Return flight ${leg.from} → ${leg.to}`, at: leg.depart })),
    points: offer.points,
    durationMinutes: offer.durationMinutes,
    altLinks: offer.altLinks,
  };
}

// ---------- Price grids (the Prices dashboard) ----------

/**
 * A set of searches compared side by side and re-checked over time: every
 * origin × destination × departure date for flights, or every location × stay
 * for hotels. Each combination is one cell.
 */
export interface PriceGrid {
  id: string;
  name: string;
  kind: "flights" | "hotels";
  /** Flights: departure airports. */
  origins: string[];
  /** Flights: arrival airports. Hotels: the places to compare (cities, neighbourhoods). */
  destinations: string[];
  /** Flights: departure dates. Hotels: check-in dates. */
  dates: string[];
  /** Nights until the return flight / check-out; 0 = one-way flight. */
  nights: number;
  /** Flights: adults. Hotels: guests. */
  travelers: number;
  rooms: number;
  cabin: FlightSearch["cabin"];
  /** Re-check automatically every this many days; 0 = only when you press Check. */
  trackEveryDays: number;
  cells: Record<string, GridCell>;
  createdAt: string;
}

export interface GridOption {
  title: string;
  subtitle: string;
  total: number;
  /** Per night for stays, per person for flights. */
  unitPrice: number;
  unit: string;
  tags: string[];
  bookingUrl: string;
  rating?: number;
  durationMinutes?: number;
  stops?: number;
  edit?: EditInfo;
}

export interface GridPoint {
  date: string;
  /** Cheapest option that day. */
  low: number;
  /** Flights: cheapest nonstop. Hotels: cheapest Chase Edit stay. */
  alt?: number;
  /** Hotels: median of the results, to tell a cheap area from one cheap outlier. */
  median?: number;
}

export interface GridCell {
  /** One point per day this cell was checked. */
  history: GridPoint[];
  /** The cheapest few options from the latest check. */
  options: GridOption[];
  /** Flights: Google's own view of this route, from the same search. */
  level?: string;
  typical?: [number, number];
  googleHistory?: PricePoint[];
  error?: string;
  checkedAt?: string;
}

export interface GridCellSpec {
  key: string;
  /** Row label: "BWI → SFO" or the hotel location. */
  row: string;
  date: string;
  params: FlightSearch | HotelSearch;
}

const addDaysTo = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Every cell of a grid, with the search it runs. */
export function gridCells(grid: PriceGrid): GridCellSpec[] {
  const out: GridCellSpec[] = [];
  for (const date of grid.dates) {
    if (grid.kind === "flights") {
      for (const origin of grid.origins)
        for (const destination of grid.destinations) {
          const params: FlightSearch = { origin, destination, departDate: date, returnDate: grid.nights > 0 ? addDaysTo(date, grid.nights) : undefined, adults: grid.travelers, cabin: grid.cabin };
          out.push({ key: `${origin}|${destination}|${date}`, row: `${origin} → ${destination}`, date, params });
        }
    } else {
      for (const location of grid.destinations) {
        const params: HotelSearch = { location, checkIn: date, checkOut: addDaysTo(date, Math.max(1, grid.nights)), guests: grid.travelers, rooms: grid.rooms };
        out.push({ key: `${location}|${date}`, row: location, date, params });
      }
    }
  }
  return out;
}
