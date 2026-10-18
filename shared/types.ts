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
 * A normalized search result. Every provider (mock or live) maps its own
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
  legs?: FlightLeg[];
}

export interface SearchResponse {
  category: Category;
  provider: string;
  live: boolean;
  offers: Offer[];
  warnings: string[];
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
  addedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export type TripInput = Pick<
  Trip,
  "name" | "origin" | "destination" | "startDate" | "endDate" | "travelers" | "budget" | "currency"
>;

export interface ProviderStatus {
  category: Category;
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
  };
}
