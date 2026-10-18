import type { Category, Money } from "../shared/types.ts";

export function money(value: Money | number, currency = "USD"): string {
  const amount = typeof value === "number" ? value : value.amount;
  const cur = typeof value === "number" ? currency : value.currency;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(amount);
}

const parse = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`);

export function shortDate(d: string): string {
  return parse(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function longDate(d: string): string {
  return parse(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function dayLabel(d: string): string {
  return parse(d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function dateRange(start: string, end: string): string {
  return `${shortDate(start)} – ${shortDate(end)}${start.slice(0, 4) === end.slice(0, 4) ? `, ${start.slice(0, 4)}` : ""}`;
}

export function time(iso?: string): string {
  return iso && iso.length > 10 ? iso.slice(11, 16) : "";
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  return Math.round((parse(end).getTime() - parse(start).getTime()) / 86_400_000);
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function duration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export const CATEGORY_LABEL: Record<Category | "custom", string> = {
  flights: "Flights",
  hotels: "Stays",
  activities: "Activities",
  cars: "Cars",
  dining: "Dining",
  custom: "Other",
};

export const CATEGORY_SINGULAR: Record<Category | "custom", string> = {
  flights: "Flight",
  hotels: "Stay",
  activities: "Activity",
  cars: "Car",
  dining: "Dining",
  custom: "Other",
};
