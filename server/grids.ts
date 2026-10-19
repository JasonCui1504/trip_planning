import { randomUUID } from "node:crypto";
import { gridCells, type GridCell, type GridCellSpec, type GridOption, type Offer, type PriceGrid } from "../shared/types.ts";
import { isValidDate } from "./dates.ts";
import type { Store } from "./db.ts";
import type { Registry } from "./providers/index.ts";
import { ValidationError } from "./validate.ts";

/**
 * The Prices dashboard: grids of searches (routes × dates, or hotel areas ×
 * dates) whose cheapest prices are recorded each time they're checked.
 * Every cell is one live search, so grids are capped to protect free quotas.
 */

export const MAX_CELLS = 40;
const CABINS = ["economy", "premium", "business", "first"] as const;
const TRACK_EVERY = [0, 1, 2, 3, 7];
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

/** A new grid from the request body, or an edit of an existing one (its results are kept for cells that still exist). */
export function validateGrid(body: Record<string, unknown>, existing?: PriceGrid): PriceGrid {
  const kind = existing?.kind ?? (body.kind === "hotels" ? "hotels" : body.kind === "flights" ? "flights" : undefined);
  if (!kind) throw new ValidationError(`"kind" must be "flights" or "hotels"`);
  const pick = (key: keyof PriceGrid) => (body[key] !== undefined ? body[key] : existing?.[key]);
  const flights = kind === "flights";
  const cabin = (pick("cabin") ?? "economy") as PriceGrid["cabin"];
  if (!CABINS.includes(cabin)) throw new ValidationError(`"cabin" must be one of ${CABINS.join(", ")}`);
  const dates = list(pick("dates"), "date", 10).sort();
  if (!dates.every((d) => isValidDate(d))) throw new ValidationError("Dates must look like 2027-04-01");
  const trackEveryDays = Number(pick("trackEveryDays") ?? 0);
  if (!TRACK_EVERY.includes(trackEveryDays)) throw new ValidationError(`"trackEveryDays" must be one of ${TRACK_EVERY.join(", ")}`);

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
    trackEveryDays,
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

/** Cells due a check: tracked grids, not checked within their interval, dates still ahead. */
export function dueCells(grid: PriceGrid, today: string): GridCellSpec[] {
  if (!grid.trackEveryDays) return [];
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - grid.trackEveryDays);
  const since = cutoff.toISOString().slice(0, 10);
  return gridCells(grid).filter((s) => s.date >= today && (grid.cells[s.key]?.history.at(-1)?.date ?? "") <= since);
}

/**
 * Check due cells of every tracked grid, one search at a time, until the time
 * budget runs out (a hosted function has a time limit). Anything left over is
 * picked up by the next run.
 */
export async function refreshGrids(store: Store, registry: Registry, today: string, budgetMs = 45_000): Promise<number> {
  const deadline = Date.now() + budgetMs;
  let checked = 0;
  for (const grid of await store.listGrids()) {
    let current = grid;
    for (const spec of dueCells(grid, today)) {
      if (Date.now() > deadline) return checked;
      current = { ...current, cells: { ...current.cells, [spec.key]: await checkCell(current, spec, registry, today) } };
      await store.saveGrid(current);
      checked++;
    }
  }
  return checked;
}
