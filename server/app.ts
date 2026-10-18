import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { CATEGORIES, type Category, type ChecklistItem, type ItemStatus, type SearchResponse, type Trip, type TripItem } from "../shared/types.ts";
import type { TripStore } from "./db.ts";
import type { Registry } from "./providers/index.ts";
import { searchPlaces } from "./providers/mock/places.ts";
import { searchValidators, validateTripInput, ValidationError } from "./validate.ts";

const DEFAULT_CHECKLIST = [
  "Check passport / ID expiry",
  "Check visa & entry requirements",
  "Buy travel insurance",
  "Tell your bank you're travelling",
  "Download offline maps",
  "Arrange phone data / eSIM",
];

const ITEM_STATUSES: ItemStatus[] = ["idea", "shortlisted", "booked"];
const ITEM_CATEGORIES: (Category | "custom")[] = [...CATEGORIES, "custom"];

class NotFound extends Error {}

const now = () => new Date().toISOString();

export function createApp(store: TripStore, registry: Registry) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const loadTrip = async (id: string) => {
    const trip = await store.get(id);
    if (!trip) throw new NotFound(`Trip ${id} not found`);
    return trip;
  };
  const touch = (trip: Trip) => store.save({ ...trip, updatedAt: now() });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/providers", (_req, res) => {
    res.json(registry.status());
  });

  app.get("/api/places", (req, res) => {
    res.json(searchPlaces(String(req.query.q ?? "")).map(({ code, city, country, airport }) => ({ code, city, country, airport })));
  });

  app.post("/api/search/:category", async (req, res) => {
    const category = req.params.category as Category;
    if (!CATEGORIES.includes(category)) throw new NotFound(`Unknown category "${category}"`);
    const params = searchValidators[category](req.body ?? {});
    const { provider, live } = registry.providerFor(category);
    const warnings: string[] = [];
    if (!live) warnings.push("Showing sample data. Prices and availability are illustrative; Book opens the real site pre-filled with your search.");
    const offers = await (provider.search as (p: typeof params) => ReturnType<typeof provider.search>)(params);
    const body: SearchResponse = { category, provider: provider.name, live, offers, warnings };
    res.json(body);
  });

  // ----- Trips -----

  app.get("/api/trips", async (_req, res) => {
    res.json(await store.list());
  });

  app.post("/api/trips", async (req, res) => {
    const input = validateTripInput(req.body ?? {});
    if (input.endDate! < input.startDate!) throw new ValidationError(`"endDate" must be on or after "startDate"`);
    const trip: Trip = {
      id: randomUUID(),
      name: input.name!,
      origin: input.origin ?? "",
      destination: input.destination!,
      startDate: input.startDate!,
      endDate: input.endDate!,
      travelers: input.travelers ?? 1,
      budget: input.budget ?? 0,
      currency: input.currency ?? "USD",
      notes: "",
      items: [],
      checklist: DEFAULT_CHECKLIST.map((text) => ({ id: randomUUID(), text, done: false })),
      createdAt: now(),
      updatedAt: now(),
    };
    res.status(201).json(await store.save(trip));
  });

  app.get("/api/trips/:id", async (req, res) => {
    res.json(await loadTrip(req.params.id));
  });

  app.patch("/api/trips/:id", async (req, res) => {
    const trip = await loadTrip(req.params.id);
    const body = req.body ?? {};
    const next: Trip = { ...trip, ...validateTripInput(body, true) };
    if (next.endDate < next.startDate) throw new ValidationError(`"endDate" must be on or after "startDate"`);
    if (typeof body.notes === "string") next.notes = body.notes;
    if (Array.isArray(body.checklist)) {
      next.checklist = (body.checklist as Partial<ChecklistItem>[])
        .filter((c) => typeof c.text === "string" && c.text.trim())
        .map((c) => ({ id: typeof c.id === "string" ? c.id : randomUUID(), text: c.text!.trim(), done: Boolean(c.done) }));
    }
    res.json(await touch(next));
  });

  app.delete("/api/trips/:id", async (req, res) => {
    if (!(await store.remove(req.params.id))) throw new NotFound(`Trip ${req.params.id} not found`);
    res.status(204).end();
  });

  // ----- Trip items (saved offers, bookings, custom entries) -----

  const itemFields = (body: Record<string, unknown>, partial: boolean): Partial<TripItem> => {
    const out: Partial<TripItem> = {};
    const has = (k: string) => body[k] !== undefined;
    if (!partial || has("category")) {
      if (!ITEM_CATEGORIES.includes(body.category as Category)) throw new ValidationError(`"category" must be one of ${ITEM_CATEGORIES.join(", ")}`);
      out.category = body.category as TripItem["category"];
    }
    if (!partial || has("title")) {
      if (typeof body.title !== "string" || !body.title.trim()) throw new ValidationError(`"title" is required`);
      out.title = body.title.trim();
    }
    if (has("status")) {
      if (!ITEM_STATUSES.includes(body.status as ItemStatus)) throw new ValidationError(`"status" must be one of ${ITEM_STATUSES.join(", ")}`);
      out.status = body.status as ItemStatus;
    }
    if (has("cost")) {
      const cost = body.cost as { amount?: unknown; currency?: unknown };
      const amount = Number(cost?.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new ValidationError(`"cost.amount" must be a non-negative number`);
      out.cost = { amount, currency: typeof cost.currency === "string" ? cost.currency : "USD" };
    }
    for (const key of ["subtitle", "start", "end", "location", "provider", "bookingUrl", "confirmation", "notes", "offerId"] as const) {
      if (has(key)) {
        if (typeof body[key] !== "string") throw new ValidationError(`"${key}" must be a string`);
        out[key] = body[key] as string;
      }
    }
    if (has("moments")) {
      const moments = body.moments as { label?: unknown; at?: unknown }[];
      if (!Array.isArray(moments) || moments.some((m) => typeof m?.label !== "string" || typeof m?.at !== "string")) {
        throw new ValidationError(`"moments" must be a list of { label, at }`);
      }
      out.moments = moments.map((m) => ({ label: m.label as string, at: m.at as string }));
    }
    if (has("details")) {
      if (typeof body.details !== "object" || body.details === null) throw new ValidationError(`"details" must be an object`);
      out.details = Object.fromEntries(Object.entries(body.details).map(([k, v]) => [k, String(v)]));
    }
    return out;
  };

  app.post("/api/trips/:id/items", async (req, res) => {
    const trip = await loadTrip(req.params.id);
    const fields = itemFields(req.body ?? {}, false);
    const item: TripItem = {
      subtitle: "",
      provider: "Manual entry",
      cost: { amount: 0, currency: trip.currency },
      details: {},
      status: "shortlisted",
      ...fields,
      category: fields.category!,
      title: fields.title!,
      id: randomUUID(),
      addedAt: now(),
    };
    await touch({ ...trip, items: [...trip.items, item] });
    res.status(201).json(item);
  });

  app.patch("/api/trips/:id/items/:itemId", async (req, res) => {
    const trip = await loadTrip(req.params.id);
    const existing = trip.items.find((i) => i.id === req.params.itemId);
    if (!existing) throw new NotFound(`Item ${req.params.itemId} not found`);
    const updated = { ...existing, ...itemFields(req.body ?? {}, true) };
    await touch({ ...trip, items: trip.items.map((i) => (i.id === existing.id ? updated : i)) });
    res.json(updated);
  });

  app.delete("/api/trips/:id/items/:itemId", async (req, res) => {
    const trip = await loadTrip(req.params.id);
    if (!trip.items.some((i) => i.id === req.params.itemId)) throw new NotFound(`Item ${req.params.itemId} not found`);
    await touch({ ...trip, items: trip.items.filter((i) => i.id !== req.params.itemId) });
    res.status(204).end();
  });

  app.use("/api", (_req, _res, next) => next(new NotFound("Not found")));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) return void res.status(400).json({ error: err.message });
    if (err instanceof NotFound) return void res.status(404).json({ error: err.message });
    if (err instanceof SyntaxError) return void res.status(400).json({ error: "Invalid JSON body" });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}
