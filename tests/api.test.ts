import request from "supertest";
import { describe, expect, it } from "vitest";
import { CATEGORIES, offerToItem, type Offer, type SearchResponse, type Trip } from "../shared/types.ts";
import { createApp } from "../server/app.ts";
import { config } from "../server/config.ts";
import { TripStore } from "../server/db.ts";
import { createAuth } from "../server/auth.ts";
import { createEditCatalog, parseEditPage, sameHotel } from "../server/edit.ts";
import { RedisStore } from "../server/redis.ts";
import { createMaps, decodePolyline } from "../server/maps.ts";
import { editPage } from "./fixtures/edit.ts";
import { googleFlights, googleHotels } from "./fixtures/serpapi.ts";
import { createRegistry } from "../server/providers/index.ts";
import type { Scenario, Watch } from "../shared/types.ts";

const noKeys = Object.fromEntries(Object.keys(config.keys).map((k) => [k, ""])) as typeof config.keys;
const fakeEdit = () => createEditCatalog({ fetch: async () => new Response(editPage) });
const makeApp = (today = () => "2027-01-10") => {
  const edit = fakeEdit();
  return createApp({ store: new TripStore(null), registry: createRegistry(noKeys, { edit }), maps: createMaps({ offline: true }), edit, today });
};

/** An app whose live providers are on, answered by canned SerpApi responses. */
function makeLiveApp(today = () => "2027-01-10") {
  const calls: URL[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    const engine = url.searchParams.get("engine");
    return new Response(JSON.stringify(engine === "google_flights" ? googleFlights : googleHotels));
  }) as typeof fetch;
  const edit = fakeEdit();
  const registry = createRegistry({ ...noKeys, SERPAPI_API_KEY: "test-key" }, { fetch: fetchImpl, edit });
  return { app: createApp({ store: new TripStore(null), registry, maps: createMaps({ offline: true }), edit, today }), calls };
}

const tripInput = { name: "Tokyo spring", origin: "New York", destination: "Tokyo", startDate: "2027-04-01", endDate: "2027-04-08", travelers: 2, budget: 6000, currency: "USD" };

const searches = {
  flights: { origin: "JFK", destination: "Tokyo", departDate: "2027-04-01", returnDate: "2027-04-08", adults: 2, cabin: "economy" },
  hotels: { location: "Tokyo", checkIn: "2027-04-01", checkOut: "2027-04-08", guests: 2, rooms: 1 },
  activities: { location: "Tokyo", date: "2027-04-02" },
  cars: { location: "Tokyo", pickupDate: "2027-04-01", dropoffDate: "2027-04-08" },
  dining: { location: "Tokyo", date: "2027-04-02" },
};

describe("search", () => {
  for (const category of CATEGORIES) {
    it(`shows no made-up ${category} results without a live source, only links to real sites`, async () => {
      const res = await request(makeApp()).post(`/api/search/${category}`).send(searches[category]).expect(200);
      const body = res.body as SearchResponse;
      expect(body).toMatchObject({ live: false, provider: "Not connected", offers: [] });
      expect(body.warnings[0]).toMatch(/No live data source/);
      expect(body.links.length).toBeGreaterThan(1);
      for (const link of body.links) expect(link.url).toMatch(/^https:\/\//);
    });
  }

  it("rejects bad input", async () => {
    const app = makeApp();
    await request(app).post("/api/search/hotels").send({ ...searches.hotels, checkOut: "2027-03-01" }).expect(400);
    await request(app).post("/api/search/flights").send({ ...searches.flights, departDate: "soon" }).expect(400);
    await request(app).post("/api/search/boats").send({}).expect(404);
  });

  it("reports every category as not connected without keys", async () => {
    const res = await request(makeApp()).get("/api/providers").expect(200);
    expect(res.body).toHaveLength(CATEGORIES.length);
    expect(res.body.every((p: { live: boolean; provider: string }) => !p.live && p.provider === "Not connected")).toBe(true);
  });

  it("reports flights and stays as live with a SerpApi key", async () => {
    const res = await request(makeLiveApp().app).get("/api/providers").expect(200);
    expect(res.body.filter((p: { live: boolean }) => p.live).map((p: { category: string }) => p.category)).toEqual(["flights", "hotels"]);
  });
});

describe("trips", () => {
  it("creates, updates and deletes a trip with items", async () => {
    const { app } = makeLiveApp();
    const created = (await request(app).post("/api/trips").send(tripInput).expect(201)).body as Trip;
    expect(created.checklist.length).toBeGreaterThan(0);

    const search = await request(app).post("/api/search/hotels").send(searches.hotels);
    const offer = search.body.offers[0] as Offer;
    const item = (await request(app).post(`/api/trips/${created.id}/items`).send(offerToItem(offer, created.travelers)).expect(201)).body;
    expect(item.cost.amount).toBe(offer.totalPrice.amount);
    expect(item.offerId).toBe(offer.id);

    await request(app).patch(`/api/trips/${created.id}/items/${item.id}`).send({ status: "booked", confirmation: "XYZ" }).expect(200);
    await request(app).patch(`/api/trips/${created.id}`).send({ notes: "Bring adapters", budget: 7000 }).expect(200);

    const trip = (await request(app).get(`/api/trips/${created.id}`).expect(200)).body as Trip;
    expect(trip.items[0]).toMatchObject({ status: "booked", confirmation: "XYZ" });
    expect(trip.notes).toBe("Bring adapters");
    expect(trip.budget).toBe(7000);

    await request(app).delete(`/api/trips/${created.id}/items/${item.id}`).expect(204);
    await request(app).delete(`/api/trips/${created.id}`).expect(204);
    await request(app).get(`/api/trips/${created.id}`).expect(404);
  });

  it("validates trips and items", async () => {
    const app = makeApp();
    await request(app).post("/api/trips").send({ ...tripInput, endDate: "2027-03-01" }).expect(400);
    await request(app).post("/api/trips").send({ ...tripInput, destination: "" }).expect(400);
    const trip = (await request(app).post("/api/trips").send(tripInput)).body as Trip;
    await request(app).post(`/api/trips/${trip.id}/items`).send({ category: "custom" }).expect(400);
    await request(app).post(`/api/trips/${trip.id}/items`).send({ category: "custom", title: "Train", status: "maybe" }).expect(400);
    await request(app).post(`/api/trips/${trip.id}/items`).send({ category: "custom", title: "Train to Kyoto", cost: { amount: 120 } }).expect(201);
  });
});

describe("itinerary data", () => {
  it("keeps the return flight's departure as a timeline moment", () => {
    const leg = (from: string, to: string, depart: string) => ({ from, to, depart, arrive: depart, durationMinutes: 780, stops: 0, stopCities: [], carrier: "ANA", flightNumber: "NH 9" });
    const offer: Offer = {
      id: "f1",
      category: "flights",
      provider: "Google Flights",
      title: "ANA · Nonstop",
      subtitle: "JFK → NRT → JFK",
      price: { amount: 900, currency: "USD" },
      priceUnit: "round trip / person",
      totalPrice: { amount: 1800, currency: "USD" },
      tags: [],
      details: {},
      bookingUrl: "https://www.google.com/travel/flights",
      legs: [leg("JFK", "NRT", "2027-04-01T11:00"), leg("NRT", "JFK", "2027-04-08T17:00")],
    };
    expect(offerToItem(offer, 2).moments).toEqual([{ label: "Return flight NRT → JFK", at: "2027-04-08T17:00" }]);
  });
});

describe("maps", () => {
  it("estimates a drive when offline", async () => {
    const res = await request(makeApp())
      .post("/api/geo/route")
      .send({ points: [{ lat: 35.77, lon: 140.39 }, { lat: 35.6762, lon: 139.6503 }] })
      .expect(200);
    expect(res.body.source).toBe("estimate");
    expect(res.body.distanceKm).toBeGreaterThan(60);
    expect(res.body.durationMinutes).toBeGreaterThan(40);
  });

  it("geocodes known cities without the network", async () => {
    const res = await request(makeApp()).get("/api/geo/search?q=Lisbon").expect(200);
    expect(res.body[0]).toMatchObject({ label: "Lisbon" });
  });

  it("rejects bad route input", async () => {
    await request(makeApp()).post("/api/geo/route").send({ points: [{ lat: 1, lon: 2 }] }).expect(400);
    await request(makeApp()).post("/api/geo/route").send({ points: [{ lat: 200, lon: 2 }, { lat: 1, lon: 2 }] }).expect(400);
  });

  it("decodes Google polylines", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  });
});

describe("price watch", () => {
  it("records one price per day and survives repeated checks", async () => {
    let day = "2027-01-10";
    const { app } = makeLiveApp(() => day);
    const offer = (await request(app).post("/api/search/flights").send(searches.flights)).body.offers[0] as Offer;
    const watch = (await request(app).post("/api/watches").send({ category: "flights", params: searches.flights, offerId: offer.id }).expect(201)).body as Watch;
    expect(watch.history).toEqual([{ date: day, amount: offer.totalPrice.amount, available: true }]);

    // Watching the same option again returns the existing watch.
    const again = await request(app).post("/api/watches").send({ category: "flights", params: searches.flights, offerId: offer.id }).expect(200);
    expect(again.body.id).toBe(watch.id);

    for (day of ["2027-01-11", "2027-01-12", "2027-01-12"]) await request(app).post("/api/watches/refresh").expect(200);
    const [updated] = (await request(app).get("/api/watches")).body as Watch[];
    expect(updated.history.map((h) => h.date)).toEqual(["2027-01-10", "2027-01-11", "2027-01-12"]);
    expect(updated.history.every((h) => h.available && h.amount === offer.totalPrice.amount)).toBe(true);

    await request(app).delete(`/api/watches/${watch.id}`).expect(204);
    expect((await request(app).get("/api/watches")).body).toEqual([]);
  });

  it("refuses to watch something that isn't in the results", async () => {
    await request(makeLiveApp().app).post("/api/watches").send({ category: "hotels", params: searches.hotels, offerId: "nope" }).expect(404);
  });
});

describe("scenarios", () => {
  it("saves scenarios and prunes removed items", async () => {
    const { app } = makeLiveApp();
    const trip = (await request(app).post("/api/trips").send(tripInput)).body as Trip;
    const offer = (await request(app).post("/api/search/flights").send(searches.flights)).body.offers[0] as Offer;
    const item = (await request(app).post(`/api/trips/${trip.id}/items`).send(offerToItem(offer, 2))).body;
    expect(item.points).toHaveLength(2);
    expect(item.durationMinutes).toBeGreaterThan(0);

    const scenario = {
      name: "Fly + drive",
      itemIds: [item.id, "missing"],
      drives: [{ from: { lat: 35.77, lon: 140.39, label: "NRT" }, to: { lat: 35.67, lon: 139.65, label: "Hotel" }, durationMinutes: 75, distanceKm: 70, source: "osrm", geometry: [] }],
    };
    const saved = (await request(app).patch(`/api/trips/${trip.id}`).send({ scenarios: [scenario] }).expect(200)).body as Trip;
    expect(saved.scenarios[0]).toMatchObject({ name: "Fly + drive", itemIds: [item.id] });
    expect(saved.scenarios[0].drives[0].id).toBeTruthy();

    await request(app).delete(`/api/trips/${trip.id}/items/${item.id}`).expect(204);
    const after = (await request(app).get(`/api/trips/${trip.id}`)).body as Trip;
    expect((after.scenarios as Scenario[])[0].itemIds).toEqual([]);

    await request(app).patch(`/api/trips/${trip.id}`).send({ scenarios: [{ name: "" }] }).expect(400);
  });
});

describe("live providers (SerpApi)", () => {
  it("maps Google Flights results and price insights", async () => {
    const { app, calls } = makeLiveApp();
    const res = await request(app).post("/api/search/flights").send({ ...searches.flights, origin: "San Francisco", destination: "NRT" }).expect(200);
    const body = res.body as SearchResponse;
    expect(body.live).toBe(true);
    expect(body.provider).toBe("Google Flights (SerpApi)");
    expect(calls[0].searchParams.get("departure_id")).toBe("SFO");
    expect(calls[0].searchParams.get("type")).toBe("1");
    expect(body.offers).toHaveLength(2);
    const [nonstop, oneStop] = body.offers;
    expect(nonstop).toMatchObject({ title: "United · Nonstop", totalPrice: { amount: 1840 }, price: { amount: 920 }, durationMinutes: 690 });
    expect(nonstop.legs![0]).toMatchObject({ from: "SFO", to: "NRT", depart: "2027-04-01T11:05", arrive: "2027-04-02T14:35", stops: 0 });
    expect(nonstop.tags).toContain("Google best");
    expect(oneStop.legs![0]).toMatchObject({ stops: 1, stopCities: ["SEA"], carrier: "Alaska + Japan Airlines" });
    expect(body.insights[0]).toMatch(/low right now \(usually \$1,500–\$2,300\)/);
  });

  it("asks for an airport code when it can't work one out", async () => {
    const { app } = makeLiveApp();
    const res = await request(app).post("/api/search/flights").send({ ...searches.flights, origin: "Atlantis" }).expect(400);
    expect(res.body.error).toMatch(/airport code/);
  });

  it("maps Google Hotels with per-site prices and Chase Edit badges", async () => {
    const { app } = makeLiveApp();
    const res = await request(app).post("/api/search/hotels").send(searches.hotels).expect(200);
    const [andaz, gracery, ...rest] = (res.body as SearchResponse).offers;
    expect(rest).toHaveLength(0); // the property without a rate is dropped
    expect(andaz).toMatchObject({ title: "Andaz Tokyo Toranomon Hills", price: { amount: 610 }, totalPrice: { amount: 4270 }, rating: 4.7, start: "2027-04-01T15:00", end: "2027-04-08T12:00" });
    expect(andaz.priceSources!.map((p) => [p.source, p.amount])).toEqual([["Hotels.com", 4186], ["Expedia.com", 4235], ["Hyatt", 4270]]);
    expect(andaz.edit).toMatchObject({ brand: "Hyatt", selectCredit: false });
    expect(andaz.tags[0]).toBe("Chase Edit");
    expect(andaz.points![0]).toMatchObject({ lat: 35.6672, lon: 139.7497 });
    expect(gracery.totalPrice.amount).toBe(140 * 7);
    expect(gracery.edit).toBeUndefined();
  });

  it("price-watches live results across days", async () => {
    const { app } = makeLiveApp();
    const offer = (await request(app).post("/api/search/hotels").send(searches.hotels)).body.offers[0] as Offer;
    const watch = (await request(app).post("/api/watches").send({ category: "hotels", params: searches.hotels, offerId: offer.id }).expect(201)).body as Watch;
    expect(watch.provider).toBe("Google Hotels (SerpApi)");
    const [refreshed] = (await request(app).post("/api/watches/refresh").expect(200)).body as Watch[];
    expect(refreshed.history.at(-1)).toMatchObject({ amount: 4270, available: true });
  });
});

describe("Chase Edit list", () => {
  it("parses the edithotelsearch.com page", () => {
    const hotels = parseEditPage(editPage);
    expect(hotels).toHaveLength(3);
    expect(hotels.find((h) => h.brand === "IHG")!.selectCredit).toBe(true);
    expect(hotels.find((h) => h.brand === "Hyatt")!.selectCredit).toBe(false);
    expect(() => parseEditPage("<html></html>")).toThrow(/format may have changed/);
  });

  it("matches hotel names loosely but not wrongly", () => {
    expect(sameHotel("Andaz Tokyo Toranomon Hills", "Andaz Tokyo")).toBe(true);
    expect(sameHotel("InterContinental Tokyo Bay", "Hotel InterContinental Tokyo Bay")).toBe(true);
    expect(sameHotel("Andaz Tokyo Toranomon Hills", "Hotel Gracery Shinjuku")).toBe(false);
    expect(sameHotel("Four Seasons Hotel Tokyo at Marunouchi", "Four Seasons Hotel Tokyo at Otemachi")).toBe(false);
  });

  it("lists Edit hotels for a destination", async () => {
    const res = await request(makeApp()).get("/api/edit?location=Tokyo").expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.hotels.map((h: { name: string }) => h.name)).toEqual(["Andaz Tokyo Toranomon Hills", "InterContinental Tokyo Bay"]);
    await request(makeApp()).get("/api/edit").expect(400);
  });
});

describe("password login", () => {
  const makeAuthed = (cronSecret?: string) => {
    const edit = fakeEdit();
    return createApp({
      store: new TripStore(null),
      registry: createRegistry(noKeys, { edit }),
      maps: createMaps({ offline: true }),
      edit,
      auth: createAuth({ password: "correct horse" }),
      cronSecret,
    });
  };

  it("keeps the API closed until you log in", async () => {
    const app = makeAuthed();
    expect((await request(app).get("/api/session")).body).toEqual({ authRequired: true, authenticated: false });
    await request(app).get("/api/trips").expect(401);
    await request(app).get("/api/health").expect(200);
    await request(app).post("/api/login").send({ password: "wrong" }).expect(401);

    const login = await request(app).post("/api/login").send({ password: "correct horse" }).expect(200);
    const cookie = login.headers["set-cookie"][0].split(";")[0];
    expect(login.headers["set-cookie"][0]).toMatch(/HttpOnly; SameSite=Lax/);
    await request(app).get("/api/trips").set("Cookie", cookie).expect(200);
    await request(app).get("/api/trips").set("Cookie", `${cookie.slice(0, -2)}xx`).expect(401);
    await request(app).get("/api/trips").set("Cookie", "tw_session=99999999999999.forged").expect(401);
  });

  it("rate-limits password guessing", async () => {
    const app = makeAuthed();
    for (let i = 0; i < 10; i++) await request(app).post("/api/login").send({ password: `guess${i}` }).expect(401);
    await request(app).post("/api/login").send({ password: "correct horse" }).expect(429);
  });

  it("only lets the scheduler run the daily price check", async () => {
    await request(makeAuthed("s3cret")).get("/api/cron/watch").expect(401);
    await request(makeAuthed("s3cret")).get("/api/cron/watch").set("Authorization", "Bearer s3cret").expect(200);
    await request(makeAuthed()).get("/api/cron/watch").expect(401); // no secret configured + password on = closed
    await request(makeApp()).get("/api/cron/watch").expect(200); // local, no password
  });
});

describe("Redis store", () => {
  /** Minimal in-memory stand-in for Upstash's REST API. */
  function fakeUpstash() {
    const db = new Map<string, Map<string, string> | string>();
    return (async (_url: string | URL | Request, init?: RequestInit) => {
      const [cmd, key, ...rest] = JSON.parse(String(init!.body)) as string[];
      const hash = (db.get(key) as Map<string, string>) ?? new Map<string, string>();
      const result =
        cmd === "HSET" ? (db.set(key, hash.set(rest[0], rest[1])), 1)
        : cmd === "HGET" ? hash.get(rest[0]) ?? null
        : cmd === "HGETALL" ? [...hash].flat()
        : cmd === "HDEL" ? (hash.delete(rest[0]) ? 1 : 0)
        : cmd === "SET" ? (db.set(key, rest[0]), "OK")
        : cmd === "GET" ? (typeof db.get(key) === "string" ? db.get(key) : null)
        : null;
      return new Response(JSON.stringify({ result }));
    }) as typeof fetch;
  }

  it("runs the whole trip flow on Redis", async () => {
    const store = new RedisStore({ url: "https://redis.test", token: "t" }, fakeUpstash());
    const edit = createEditCatalog({ cache: store, fetch: async () => new Response(editPage) });
    const app = createApp({ store, registry: createRegistry(noKeys, { edit }), maps: createMaps({ offline: true }), edit, today: () => "2027-01-10" });
    const trip = (await request(app).post("/api/trips").send(tripInput).expect(201)).body as Trip;
    await request(app).patch(`/api/trips/${trip.id}`).send({ notes: "hello" }).expect(200);
    expect((await request(app).get("/api/trips")).body[0]).toMatchObject({ id: trip.id, notes: "hello", scenarios: [] });
    await request(app).get("/api/edit?location=Tokyo").expect(200);
    expect(await store.getCache("edit-hotels")).toMatchObject({ value: expect.stringContaining("Andaz") });
    await request(app).delete(`/api/trips/${trip.id}`).expect(204);
    expect((await request(app).get("/api/trips")).body).toEqual([]);
  });
});
