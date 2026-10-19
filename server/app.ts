import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import {
  applyScenario,
  CATEGORIES,
  gridCells,
  type Category,
  type ChecklistItem,
  type DriveLeg,
  type GeoPoint,
  type ItemStatus,
  type Scenario,
  type SearchResponse,
  type Trip,
  type TripItem,
  type Watch,
} from "../shared/types.ts";
import type { Store } from "./db.ts";
import { createAuth, type Auth } from "./auth.ts";
import type { EditCatalog } from "./edit.ts";
import type { Maps } from "./maps.ts";
import { ProviderInputError } from "./providers/serpapi.ts";
import { ProviderError, type Registry } from "./providers/index.ts";
import { checkWatch, localToday, refreshWatches } from "./watch.ts";
import { searchPlaces } from "./places.ts";
import { config, type KeyName } from "./config.ts";
import { checkCell, validateGrid } from "./grids.ts";
import { checkConnections } from "./providers/check.ts";
import { exportTrip, TravelBudgetError, type TravelBudgetOptions } from "./travelBudget.ts";
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

export interface AppDeps {
  store: Store;
  registry: Registry;
  maps: Maps;
  edit: EditCatalog;
  /** Password login; omitted = open (local use). */
  auth?: Auth;
  /** Injectable clock so tests can simulate several days of price checks. */
  today?: () => string;
  /** The jascui.com travel budget that trips export to; a saved login is optional. */
  travelBudget?: TravelBudgetOptions;
  /** API keys and the fetch used to test them (Setup → Check connections). */
  keys?: Record<KeyName, string>;
  providerFetch?: typeof fetch;
}

const isPoint = (p: unknown): p is GeoPoint =>
  typeof p === "object" && p !== null && Number.isFinite((p as GeoPoint).lat) && Number.isFinite((p as GeoPoint).lon) &&
  Math.abs((p as GeoPoint).lat) <= 90 && Math.abs((p as GeoPoint).lon) <= 180;

const DATETIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

/** A scenario's own schedule: kept only for items still on the trip, with well-formed times. */
function validateTimes(value: unknown, itemIds: Set<string>): Scenario["times"] {
  if (typeof value !== "object" || value === null) return {};
  const out: NonNullable<Scenario["times"]> = {};
  for (const [id, t] of Object.entries(value as Record<string, { start?: unknown; end?: unknown }>)) {
    if (!itemIds.has(id) || typeof t !== "object" || t === null) continue;
    const start = typeof t.start === "string" && DATETIME.test(t.start) ? t.start : undefined;
    const end = typeof t.end === "string" && DATETIME.test(t.end) ? t.end : undefined;
    if (start || end) out[id] = { ...(start && { start }), ...(end && { end }) };
  }
  return out;
}

function validateScenarios(value: unknown, trip: Trip): Scenario[] {
  if (!Array.isArray(value)) throw new ValidationError(`"scenarios" must be a list`);
  const itemIds = new Set(trip.items.map((i) => i.id));
  return value.map((raw: Partial<Scenario>) => {
    if (typeof raw?.name !== "string" || !raw.name.trim()) throw new ValidationError("Each scenario needs a name");
    const drives = (Array.isArray(raw.drives) ? raw.drives : []).map((d: Partial<DriveLeg>) => {
      if (!isPoint(d?.from) || !isPoint(d?.to)) throw new ValidationError("Each drive needs from/to coordinates");
      return {
        id: typeof d.id === "string" ? d.id : randomUUID(),
        from: { lat: d.from.lat, lon: d.from.lon, label: String(d.from.label ?? "Start") },
        to: { lat: d.to.lat, lon: d.to.lon, label: String(d.to.label ?? "End") },
        durationMinutes: Math.max(0, Math.round(Number(d.durationMinutes) || 0)),
        distanceKm: Math.max(0, Number(d.distanceKm) || 0),
        source: d.source === "osrm" || d.source === "google" ? d.source : "estimate",
        geometry: (Array.isArray(d.geometry) ? d.geometry : []).filter((c): c is [number, number] => Array.isArray(c) && c.length === 2).slice(0, 400),
      } satisfies DriveLeg;
    });
    return {
      id: typeof raw.id === "string" ? raw.id : randomUUID(),
      name: raw.name.trim(),
      // Drop references to items that were removed from the trip.
      itemIds: (Array.isArray(raw.itemIds) ? raw.itemIds : []).filter((id): id is string => typeof id === "string" && itemIds.has(id)),
      drives,
      notes: typeof raw.notes === "string" ? raw.notes : "",
      times: validateTimes(raw.times, itemIds),
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now(),
    };
  });
}

export function createApp({ store, registry, maps, edit, auth = createAuth({}), today = localToday, travelBudget = { url: "https://www.jascui.com" }, keys = config.keys, providerFetch = fetch }: AppDeps) {
  const app = express();
  // Behind Vercel's proxy: trust X-Forwarded-* for the client IP and https.
  app.set("trust proxy", true);
  app.use(express.json({ limit: "1mb" }));

  // ----- Public routes: health, login, and the daily scheduler hook -----

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/api/session", auth.session);
  app.post("/api/login", auth.login);
  app.post("/api/logout", auth.logout);

  // Everything else needs a session when a password is set.
  app.use("/api", auth.require);

  const loadTrip = async (id: string) => {
    const trip = await store.get(id);
    if (!trip) throw new NotFound(`Trip ${id} not found`);
    return trip;
  };
  const touch = (trip: Trip) => store.save({ ...trip, updatedAt: now() });

  app.get("/api/providers", (_req, res) => {
    res.json(registry.status());
  });

  // Tests the API keys for real (Setup page). SerpApi's check is free; Hotels.com's uses 1 request.
  app.get("/api/providers/check", async (_req, res) => {
    res.json(await checkConnections(keys, providerFetch));
  });

  app.get("/api/places", (req, res) => {
    res.json(searchPlaces(String(req.query.q ?? "")).map(({ code, city, country, airport }) => ({ code, city, country, airport })));
  });

  app.post("/api/search/:category", async (req, res) => {
    const category = req.params.category as Category;
    if (!CATEGORIES.includes(category)) throw new NotFound(`Unknown category "${category}"`);
    const params = searchValidators[category](req.body ?? {});
    const { provider, live, offers, insights, links } = await registry.search(category, params, { asOf: today() });
    const warnings: string[] = [];
    if (!live) warnings.push("No live data source is connected for this category yet, so there are no results to show. Run the same search on these sites:");
    const body: SearchResponse = { category, provider, live, offers, warnings, insights, links };
    res.json(body);
  });

  // ----- Chase "The Edit" hotels -----

  app.get("/api/edit", async (req, res) => {
    const location = typeof req.query.location === "string" ? req.query.location : undefined;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    if (!location && !q) throw new ValidationError(`Pass "location" and/or "q"`);
    res.json(await edit.search({ location, q }));
  });

  // ----- Maps -----

  app.get("/api/geo/search", async (req, res) => {
    res.json(await maps.geocode(String(req.query.q ?? "")));
  });

  app.post("/api/geo/route", async (req, res) => {
    const points = req.body?.points;
    if (!Array.isArray(points) || points.length < 2 || points.length > 25 || !points.every(isPoint)) {
      throw new ValidationError(`"points" must be 2–25 { lat, lon } objects`);
    }
    res.json(await maps.route(points));
  });

  // ----- Prices dashboard: grids of routes/areas × dates -----

  const loadGrid = async (id: string) => {
    const grid = await store.getGrid(id);
    if (!grid) throw new NotFound(`Grid ${id} not found`);
    return grid;
  };

  app.get("/api/grids", async (_req, res) => {
    res.json(await store.listGrids());
  });

  app.post("/api/grids", async (req, res) => {
    res.status(201).json(await store.saveGrid(validateGrid(req.body ?? {})));
  });

  app.get("/api/grids/:id", async (req, res) => {
    res.json(await loadGrid(req.params.id));
  });

  app.patch("/api/grids/:id", async (req, res) => {
    res.json(await store.saveGrid(validateGrid(req.body ?? {}, await loadGrid(req.params.id))));
  });

  app.delete("/api/grids/:id", async (req, res) => {
    if (!(await store.removeGrid(req.params.id))) throw new NotFound(`Grid ${req.params.id} not found`);
    res.status(204).end();
  });

  // Checks a few cells per request (the page sends batches), so each call stays well inside a hosted function's time limit.
  app.post("/api/grids/:id/check", async (req, res) => {
    const grid = await loadGrid(req.params.id);
    const keys = req.body?.keys;
    if (!Array.isArray(keys) || !keys.length || keys.length > 4) throw new ValidationError(`"keys" must list 1–4 cells`);
    const specs = gridCells(grid).filter((s) => keys.includes(s.key));
    const results = await Promise.all(specs.map(async (s) => [s.key, await checkCell(grid, s, registry, today())] as const));
    // Re-read before saving so cells checked by another request in the meantime aren't lost.
    const latest = await loadGrid(grid.id);
    res.json(await store.saveGrid({ ...latest, cells: { ...latest.cells, ...Object.fromEntries(results) } }));
  });

  // ----- Price watch -----

  app.get("/api/watches", async (_req, res) => {
    res.json(await store.listWatches());
  });

  app.post("/api/watches", async (req, res) => {
    const body = req.body ?? {};
    const category = body.category as Category;
    if (!CATEGORIES.includes(category)) throw new ValidationError(`"category" must be one of ${CATEGORIES.join(", ")}`);
    if (typeof body.offerId !== "string") throw new ValidationError(`"offerId" is required`);
    const params = searchValidators[category](body.params ?? {});
    const existing = (await store.listWatches()).find((w) => w.offerId === body.offerId);
    if (existing) return void res.json(existing);

    const { offers, provider } = await registry.search(category, params, { asOf: today() });
    const offer = offers.find((o) => o.id === body.offerId);
    if (!offer) throw new NotFound("That option is no longer in the search results — search again and retry");
    const watch: Watch = {
      id: randomUUID(),
      category,
      tripId: typeof body.tripId === "string" ? body.tripId : undefined,
      params,
      offerId: offer.id,
      title: offer.title,
      subtitle: offer.subtitle,
      provider,
      bookingUrl: offer.bookingUrl,
      currency: offer.totalPrice.currency,
      history: [{ date: today(), amount: offer.totalPrice.amount, available: true }],
      createdAt: now(),
      lastChecked: now(),
    };
    res.status(201).json(await store.saveWatch(watch));
  });

  app.post("/api/watches/refresh", async (_req, res) => {
    res.json(await refreshWatches(store, registry, today(), true));
  });

  app.post("/api/watches/:id/refresh", async (req, res) => {
    const watch = await store.getWatch(req.params.id);
    if (!watch) throw new NotFound(`Watch ${req.params.id} not found`);
    res.json(await store.saveWatch(await checkWatch(watch, registry, today())));
  });

  app.delete("/api/watches/:id", async (req, res) => {
    if (!(await store.removeWatch(req.params.id))) throw new NotFound(`Watch ${req.params.id} not found`);
    res.status(204).end();
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
      scenarios: [],
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
    if (body.scenarios !== undefined) next.scenarios = validateScenarios(body.scenarios, next);
    res.json(await touch(next));
  });

  app.delete("/api/trips/:id", async (req, res) => {
    if (!(await store.remove(req.params.id))) throw new NotFound(`Trip ${req.params.id} not found`);
    res.status(204).end();
  });

  // ----- Export to the jascui.com travel budget -----

  app.get("/api/travel-budget", (_req, res) => {
    res.json({ url: travelBudget.url, savedLogin: Boolean(travelBudget.username && travelBudget.password) });
  });

  app.post("/api/trips/:id/export/travel-budget", async (req, res) => {
    const trip = await loadTrip(req.params.id);
    const body = req.body ?? {};
    // A login typed in the export dialog is used for this export only and never stored.
    const username = typeof body.username === "string" && body.username.trim() ? body.username.trim() : travelBudget.username;
    const password = typeof body.password === "string" && body.password ? body.password : travelBudget.password;
    if (!username || !password) throw new ValidationError("Enter your travel budget username and password");
    // Export one Workshop plan (its pieces and its schedule) instead of everything saved.
    const scenario = typeof body.scenarioId === "string" && body.scenarioId ? trip.scenarios.find((s) => s.id === body.scenarioId) : undefined;
    if (body.scenarioId && !scenario) throw new NotFound("That plan no longer exists");
    try {
      const link = await exportTrip(scenario ? { ...applyScenario(trip, scenario), name: `${trip.name} · ${scenario.name}` } : trip, { ...travelBudget, username, password });
      res.json(await touch({ ...trip, travelBudget: link }));
    } catch (err) {
      if (err instanceof TravelBudgetError && err.partial) await touch({ ...trip, travelBudget: err.partial });
      // Network failures and timeouts too: say what went wrong rather than a bare 500.
      res.status(502).json({ error: err instanceof TravelBudgetError ? err.message : `Couldn't reach the travel budget: ${(err as Error).message}` });
    }
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
    if (has("points")) {
      if (!Array.isArray(body.points) || !body.points.every(isPoint)) throw new ValidationError(`"points" must be a list of { lat, lon }`);
      out.points = (body.points as GeoPoint[]).map((p) => ({ lat: p.lat, lon: p.lon, label: typeof p.label === "string" ? p.label : undefined }));
    }
    if (has("durationMinutes")) {
      const minutes = Number(body.durationMinutes);
      if (!Number.isFinite(minutes) || minutes < 0) throw new ValidationError(`"durationMinutes" must be a non-negative number`);
      out.durationMinutes = Math.round(minutes);
    }
    if (has("altLinks")) {
      const list = body.altLinks as { label?: unknown; url?: unknown }[];
      if (!Array.isArray(list) || list.some((l) => typeof l?.label !== "string" || typeof l?.url !== "string")) throw new ValidationError(`"altLinks" must be a list of { label, url }`);
      out.altLinks = list.map((l) => ({ label: l.label as string, url: l.url as string }));
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
    await touch({
      ...trip,
      items: trip.items.filter((i) => i.id !== req.params.itemId),
      scenarios: trip.scenarios.map((s) => ({ ...s, itemIds: s.itemIds.filter((id) => id !== req.params.itemId) })),
    });
    res.status(204).end();
  });

  app.use("/api", (_req, _res, next) => next(new NotFound("Not found")));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError || err instanceof ProviderInputError) return void res.status(400).json({ error: err.message });
    if (err instanceof ProviderError) return void res.status(502).json({ error: err.message });
    if (err instanceof NotFound) return void res.status(404).json({ error: err.message });
    if (err instanceof SyntaxError) return void res.status(400).json({ error: "Invalid JSON body" });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}
