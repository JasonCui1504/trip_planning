import type { Category, SearchParamsMap, TripInput } from "../shared/types.ts";
import { isValidDate } from "./dates.ts";

export class ValidationError extends Error {}

type Body = Record<string, unknown>;

const str = (body: Body, key: string, required = true): string => {
  const value = body[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (required) throw new ValidationError(`"${key}" is required`);
  return "";
};

const date = (body: Body, key: string, required = true): string => {
  const value = body[key];
  if (isValidDate(value)) return value;
  if (!required && (value === undefined || value === "" || value === null)) return "";
  throw new ValidationError(`"${key}" must be a date like 2026-05-01`);
};

const int = (body: Body, key: string, fallback: number, min = 1, max = 20): number => {
  const value = body[key] === undefined || body[key] === "" ? fallback : Number(body[key]);
  if (!Number.isInteger(value) || value < min || value > max) throw new ValidationError(`"${key}" must be a whole number between ${min} and ${max}`);
  return value;
};

const ordered = (start: string, end: string, startKey: string, endKey: string) => {
  if (end && start && end < start) throw new ValidationError(`"${endKey}" must be on or after "${startKey}"`);
};

const CABINS = ["economy", "premium", "business", "first"] as const;

export const searchValidators: { [C in Category]: (body: Body) => SearchParamsMap[C] } = {
  flights: (b) => {
    const cabin = (b.cabin ?? "economy") as SearchParamsMap["flights"]["cabin"];
    if (!CABINS.includes(cabin)) throw new ValidationError(`"cabin" must be one of ${CABINS.join(", ")}`);
    const departDate = date(b, "departDate");
    const returnDate = date(b, "returnDate", false) || undefined;
    ordered(departDate, returnDate ?? "", "departDate", "returnDate");
    return { origin: str(b, "origin"), destination: str(b, "destination"), departDate, returnDate, adults: int(b, "adults", 1, 1, 9), cabin };
  },
  hotels: (b) => {
    const checkIn = date(b, "checkIn");
    const checkOut = date(b, "checkOut");
    if (checkOut <= checkIn) throw new ValidationError(`"checkOut" must be after "checkIn"`);
    return { location: str(b, "location"), checkIn, checkOut, guests: int(b, "guests", 2, 1, 16), rooms: int(b, "rooms", 1, 1, 8) };
  },
  activities: (b) => ({ location: str(b, "location"), date: date(b, "date", false) || undefined, category: str(b, "category", false) || undefined }),
  cars: (b) => {
    const pickupDate = date(b, "pickupDate");
    const dropoffDate = date(b, "dropoffDate");
    ordered(pickupDate, dropoffDate, "pickupDate", "dropoffDate");
    return { location: str(b, "location"), pickupDate, dropoffDate };
  },
  dining: (b) => ({ location: str(b, "location"), cuisine: str(b, "cuisine", false) || undefined, date: date(b, "date", false) || undefined }),
};

export function validateTripInput(b: Body, partial = false): Partial<TripInput> {
  const out: Partial<TripInput> = {};
  const has = (k: string) => !partial || b[k] !== undefined;
  if (has("name")) out.name = str(b, "name");
  if (has("destination")) out.destination = str(b, "destination");
  if (has("origin")) out.origin = str(b, "origin", false);
  if (has("startDate")) out.startDate = date(b, "startDate");
  if (has("endDate")) out.endDate = date(b, "endDate");
  if (has("travelers")) out.travelers = int(b, "travelers", 1, 1, 20);
  if (has("budget")) out.budget = int(b, "budget", 0, 0, 10_000_000);
  if (has("currency")) out.currency = str(b, "currency", false) || "USD";
  return out;
}
