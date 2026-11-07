import { randomUUID } from "node:crypto";
import { gridCells, repeatDates, type GridCell, type GridCellSpec, type GridOption, type Offer, type PriceGrid } from "../shared/types.ts";
import { isValidDate } from "./dates.ts";
import type { Registry } from "./providers/index.ts";
import { ValidationError } from "./validate.ts";

/**
 * The Prices dashboard: grids of searches (routes × dates, or hotel areas ×
 * dates) whose cheapest prices are recorded each time you press Check, so
 * checking again a few days later shows how they moved. Nothing runs on a
 * schedule. Every cell is one live search, so grids are capped to protect
 * free quotas.
 *
 * Dates are either picked by hand or repeat weekly ("every Thursday for the
 * next 12 weeks"); repeating dates roll forward, so they're worked out from
 * today whenever a grid is read (see `withDates`).
 */

export const MAX_CELLS = 40;
const CABINS = ["economy", "premium", "business", "first"] as const;
const OPTIONS_KEPT = 6;

const list = (value: unknown, label: string, max: number, transform = (s: string) => s): string[] => {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const items = [...new Set(raw.map((v) => transform(String(v).trim())).filter(Boolean))];
  if (!items.length) throw new ValidationError(`Add at least one ${label}`);
  if (items.length > max) throw new ValidationError(`Use at most ${max} ${label}s`);
  return items;
};

const int = (value: unknown, fallback: number, min: number, max: number, label: string) => {
  const n = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new ValidationError(`${label} must be a whole number from ${min} to ${max}`);
  return n;
};

function validateRepeat(value: unknown): PriceGrid["repeat"] {
  if (value === undefined || value === null || value === false) return undefined;
  const r = value as { weekdays?: unknown; weeks?: unknown };
  const weekdays = [...new Set((Array.isArray(r.weekdays) ? r.weekdays : []).map(Number))].sort();
  if (!weekdays.length || !weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) throw new ValidationError("Pick at least one day of the week to repeat on");
  return { weekdays, weeks: int(r.weeks, 12, 1, 26, "Weeks ahead") };
}

function validateWindow(value: unknown): PriceGrid["departWindow"] {
  if (value === undefined || value === null) return undefined;
  const [from, to] = Array.isArray(value) ? value.map(Number) : [];
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > 24 || from >= to) throw new ValidationError("The departure window must run from an earlier hour to a later one");
  return from === 0 && to === 24 ? undefined : [from, to];
}

/** A repeating grid with its dates worked out as of today (fixed-date grids are returned as they are). */
export function withDates(grid: PriceGrid, today: string): PriceGrid {
  return grid.repeat ? { ...grid, dates: repeatDates(grid.repeat, today) } : grid;
}

/** Only the cells the grid still has (repeating grids drop dates that have passed). */
export function pruneCells(grid: PriceGrid): PriceGrid {
  const keys = new Set(gridCells(grid).map((s) => s.key));
  return { ...grid, cells: Object.fromEntries(Object.entries(grid.cells).filter(([k]) => keys.has(k))) };
}

/** A new grid from the request body, or an edit of an existing one (its results are kept for cells that still exist). */
export function validateGrid(body: Record<string, unknown>, existing: PriceGrid | undefined, today: string): PriceGrid {
  const kind = existing?.kind ?? (body.kind === "hotels" ? "hotels" : body.kind === "flights" ? "flights" : undefined);
  if (!kind) throw new ValidationError(`"kind" must be "flights" or "hotels"`);
  const pick = (key: keyof PriceGrid) => (body[key] !== undefined ? body[key] : existing?.[key]);
  const flights = kind === "flights";
  const cabin = (pick("cabin") ?? "economy") as PriceGrid["cabin"];
  if (!CABINS.includes(cabin)) throw new ValidationError(`"cabin" must be one of ${CABINS.join(", ")}`);
  const repeat = validateRepeat(pick("repeat"));
  const dates = repeat ? repeatDates(repeat, today) : list(pick("dates"), "date", 10).sort();
  if (!dates.every((d) => isValidDate(d))) throw new ValidationError("Dates must look like 2027-04-01");
  if (!dates.length) throw new ValidationError("Those days don't fall in the weeks ahead");

  const grid: PriceGrid = {
    id: existing?.id ?? randomUUID(),
    name: String(pick("name") ?? "").trim() || (flights ? "Flights" : "Hotels"),
    kind,
    origins: flights ? list(pick("origins"), "origin", 4, (s) => s.toUpperCase()) : [],
    destinations: list(pick("destinations"), flights ? "destination" : "location", 6, flights ? (s) => s.toUpperCase() : (s) => s),
    dates,
    nights: int(pick("nights"), flights ? 0 : 1, flights ? 0 : 1, 30, flights ? "Trip length" : "Nights"),
    travelers: int(pick("travelers"), flights ? 1 : 2, 1, 9, flights ? "Adults" : "Guests"),
    rooms: int(pick("rooms"), 1, 1, 8, "Rooms"),
    cabin,
    ...(repeat && { repeat }),
    ...(flights && { departWindow: validateWindow(pick("departWindow")), combineAirports: Boolean(pick("combineAirports")) }),
    cells: {},
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  const specs = gridCells(grid);
  if (specs.length > MAX_CELLS) throw new ValidationError(`That's ${specs.length} searches per check; keep it to ${MAX_CELLS} or fewer`);
  for (const s of specs) if (existing?.cells[s.key]) grid.cells[s.key] = existing.cells[s.key];
  return grid;
}

function toOption(o: Offer): GridOption {
  return {
    title: o.title,
    subtitle: o.subtitle,
    total: o.totalPrice.amount,
    unitPrice: o.price.amount,
    unit: o.priceUnit,
    tags: o.tags.slice(0, 4),
    bookingUrl: o.bookingUrl,
    rating: o.rating,
    durationMinutes: o.durationMinutes,
    stops: o.legs?.[0]?.stops,
    edit: o.edit,
    start: o.start,
    end: o.end,
    location: o.location,
    points: o.points,
    provider: o.provider,
  };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2)) : undefined;
};

/** Run one cell's search and record today's prices. Failures are kept on the cell, not thrown. */
export async function checkCell(grid: PriceGrid, spec: GridCellSpec, registry: Registry, today: string): Promise<GridCell> {
  const prev: GridCell = grid.cells[spec.key] ?? { history: [], options: [] };
  const checkedAt = new Date().toISOString();
  if (spec.date < today) return { ...prev, error: "This date has passed", checkedAt };
  try {
    const res = await registry.search(grid.kind, spec.params, { asOf: today });
    if (!res.live) return { ...prev, error: `No live ${grid.kind === "flights" ? "flight" : "hotel"} source is connected`, checkedAt };
    const offers = [...res.offers].sort((a, b) => a.totalPrice.amount - b.totalPrice.amount);
    if (!offers.length) return { ...prev, options: [], error: "No results for this search", checkedAt };
    const totals = offers.map((o) => o.totalPrice.amount);
    const alt =
      grid.kind === "flights"
        ? offers.find((o) => o.legs?.[0]?.stops === 0)?.totalPrice.amount
        : offers.find((o) => o.edit)?.totalPrice.amount;
    const point = { date: today, low: totals[0], ...(alt !== undefined && { alt }), ...(grid.kind === "hotels" && { median: median(totals) }) };
    // Keep the cheapest few, plus the cheapest nonstop / Chase Edit option if it isn't among them.
    const options = offers.slice(0, OPTIONS_KEPT);
    const special = offers.find((o) => (grid.kind === "flights" ? o.legs?.[0]?.stops === 0 : o.edit));
    if (special && !options.includes(special)) options.push(special);
    return {
      history: [...prev.history.filter((h) => h.date !== today), point].sort((a, b) => a.date.localeCompare(b.date)),
      options: options.map(toOption),
      level: res.priceInsight?.level,
      typical: res.priceInsight?.typical,
      googleHistory: res.priceInsight?.history.length ? res.priceInsight.history.map((h) => ({ ...h, available: true })) : prev.googleHistory,
      checkedAt,
    };
  } catch (err) {
    return { ...prev, error: (err as Error).message, checkedAt };
  }
}
