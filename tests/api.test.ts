import request from "supertest";
import { describe, expect, it } from "vitest";
import { CATEGORIES, offerToItem, type Offer, type SearchResponse, type Trip } from "../shared/types.ts";
import { createApp } from "../server/app.ts";
import { config } from "../server/config.ts";
import { TripStore } from "../server/db.ts";
import { createRegistry } from "../server/providers/index.ts";

const noKeys = Object.fromEntries(Object.keys(config.keys).map((k) => [k, ""])) as typeof config.keys;
const makeApp = () => createApp(new TripStore(null), createRegistry(noKeys));

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
