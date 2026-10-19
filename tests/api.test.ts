import request from "supertest";
import { describe, expect, it } from "vitest";
import { CATEGORIES, offerToItem, type Offer, type SearchResponse, type Trip } from "../shared/types.ts";
import { createApp } from "../server/app.ts";
import { config } from "../server/config.ts";
import { TripStore } from "../server/db.ts";
import { createMaps, decodePolyline } from "../server/maps.ts";
import { createRegistry } from "../server/providers/index.ts";
import type { Scenario, Watch } from "../shared/types.ts";

const noKeys = Object.fromEntries(Object.keys(config.keys).map((k) => [k, ""])) as typeof config.keys;
const makeApp = (today = () => "2027-01-10") =>
  createApp({ store: new TripStore(null), registry: createRegistry(noKeys), maps: createMaps({ offline: true }), today });

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
    it(`returns ${category} offers in the shared shape`, async () => {
      const res = await request(makeApp()).post(`/api/search/${category}`).send(searches[category]).expect(200);
      const body = res.body as SearchResponse;
      expect(body.live).toBe(false);
      expect(body.offers.length).toBeGreaterThan(3);
      for (const offer of body.offers) {
        expect(offer.category).toBe(category);
        expect(offer.totalPrice.amount).toBeGreaterThan(0);
        expect(offer.bookingUrl).toMatch(/^https:\/\//);
      }
      expect(new Set(body.offers.map((o) => o.id)).size).toBe(body.offers.length);
    });
  }

  it("is deterministic for the same query", async () => {
    const app = makeApp();
    const a = await request(app).post("/api/search/hotels").send(searches.hotels);
    const b = await request(app).post("/api/search/hotels").send(searches.hotels);
    expect(a.body.offers).toEqual(b.body.offers);
  });

  it("prices hotels for the whole stay", async () => {
    const res = await request(makeApp()).post("/api/search/hotels").send(searches.hotels);
    for (const o of res.body.offers as Offer[]) expect(o.totalPrice.amount).toBe(o.price.amount * 7);
  });

  it("builds round-trip flights with two legs", async () => {
    const res = await request(makeApp()).post("/api/search/flights").send(searches.flights);
    const offer = (res.body.offers as Offer[])[0];
    expect(offer.legs).toHaveLength(2);
    expect(offer.legs![0].depart.slice(0, 10)).toBe("2027-04-01");
    expect(offer.legs![1].depart.slice(0, 10)).toBe("2027-04-08");
    expect((res.body.offers as Offer[]).some((o) => o.tags.includes("Cheapest"))).toBe(true);
  });

  it("rejects bad input", async () => {
    const app = makeApp();
    await request(app).post("/api/search/hotels").send({ ...searches.hotels, checkOut: "2027-03-01" }).expect(400);
    await request(app).post("/api/search/flights").send({ ...searches.flights, departDate: "soon" }).expect(400);
    await request(app).post("/api/search/boats").send({}).expect(404);
  });

  it("reports every category as using sample data without keys", async () => {
    const res = await request(makeApp()).get("/api/providers").expect(200);
    expect(res.body).toHaveLength(CATEGORIES.length);
    expect(res.body.every((p: { live: boolean }) => !p.live)).toBe(true);
  });
});

describe("trips", () => {
  it("creates, updates and deletes a trip with items", async () => {
    const app = makeApp();
    const created = (await request(app).post("/api/trips").send(tripInput).expect(201)).body as Trip;
    expect(created.checklist.length).toBeGreaterThan(0);

    const search = await request(app).post("/api/search/activities").send(searches.activities);
    const offer = search.body.offers[0] as Offer;
    const item = (await request(app).post(`/api/trips/${created.id}/items`).send(offerToItem(offer, created.travelers)).expect(201)).body;
    expect(item.cost.amount).toBe(offer.totalPrice.amount * 2); // per-person price × 2 travelers
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
  it("keeps the return flight's departure as a timeline moment", async () => {
    const app = makeApp();
    const trip = (await request(app).post("/api/trips").send(tripInput)).body as Trip;
    const offer = (await request(app).post("/api/search/flights").send(searches.flights)).body.offers[0] as Offer;
    const item = (await request(app).post(`/api/trips/${trip.id}/items`).send(offerToItem(offer, 2)).expect(201)).body;
    expect(item.moments).toEqual([{ label: "Return flight NRT → JFK", at: offer.legs![1].depart }]);
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
    const app = makeApp(() => day);
    const offer = (await request(app).post("/api/search/flights").send(searches.flights)).body.offers[0] as Offer;
    const watch = (await request(app).post("/api/watches").send({ category: "flights", params: searches.flights, offerId: offer.id }).expect(201)).body as Watch;
    expect(watch.history).toEqual([{ date: day, amount: offer.totalPrice.amount, available: true }]);

    // Watching the same option again returns the existing watch.
    const again = await request(app).post("/api/watches").send({ category: "flights", params: searches.flights, offerId: offer.id }).expect(200);
    expect(again.body.id).toBe(watch.id);

    for (day of ["2027-01-11", "2027-01-12", "2027-01-12"]) await request(app).post("/api/watches/refresh").expect(200);
    const [updated] = (await request(app).get("/api/watches")).body as Watch[];
    expect(updated.history.map((h) => h.date)).toEqual(["2027-01-10", "2027-01-11", "2027-01-12"]);
    expect(updated.history.every((h) => h.available && h.amount > 0)).toBe(true);
    // Mock fares move from day to day.
    expect(new Set(updated.history.map((h) => h.amount)).size).toBeGreaterThan(1);

    await request(app).delete(`/api/watches/${watch.id}`).expect(204);
    expect((await request(app).get("/api/watches")).body).toEqual([]);
  });

  it("refuses to watch something that isn't in the results", async () => {
    await request(makeApp()).post("/api/watches").send({ category: "hotels", params: searches.hotels, offerId: "nope" }).expect(404);
  });
});

describe("scenarios", () => {
  it("saves scenarios and prunes removed items", async () => {
    const app = makeApp();
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
