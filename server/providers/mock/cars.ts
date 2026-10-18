import type { CarSearch, Offer } from "../../../shared/types.ts";
import { atMinutes, daysBetween } from "../../dates.ts";
import { links } from "../links.ts";
import { resolvePlace } from "./places.ts";
import { seededRandom } from "./random.ts";

const COMPANIES = ["Roadway Rentals", "Velo Cars", "SwiftDrive", "Compass Auto", "Budgetline", "Summit Rent-a-Car"];

const CLASSES = [
  { name: "Economy", example: "Toyota Yaris or similar", seats: 4, bags: 1, daily: 32 },
  { name: "Compact", example: "VW Golf or similar", seats: 5, bags: 2, daily: 38 },
  { name: "Midsize", example: "Toyota Corolla or similar", seats: 5, bags: 3, daily: 45 },
  { name: "SUV", example: "Toyota RAV4 or similar", seats: 5, bags: 4, daily: 62 },
  { name: "Minivan", example: "Chrysler Pacifica or similar", seats: 7, bags: 5, daily: 78 },
  { name: "Electric", example: "Tesla Model 3 or similar", seats: 5, bags: 2, daily: 70 },
  { name: "Convertible", example: "Ford Mustang or similar", seats: 4, bags: 1, daily: 90 },
];

export async function searchCars(params: CarSearch): Promise<Offer[]> {
  const place = resolvePlace(params.location);
  const rng = seededRandom(`cars|${place.code}|${params.pickupDate}|${params.dropoffDate}`);
  const days = Math.max(1, daysBetween(params.pickupDate, params.dropoffDate));

  return CLASSES.flatMap((cls, ci) =>
    rng.shuffle(COMPANIES).slice(0, 2).map((company, j) => {
      const daily = Math.round(cls.daily * (0.6 + place.costIndex * 0.5) * (0.85 + rng.next() * 0.4));
      const automatic = cls.name === "Electric" || rng.chance(0.7);
      const tags = [cls.name, automatic ? "Automatic" : "Manual"];
      if (rng.chance(0.5)) tags.push("Unlimited mileage");
      return {
        id: `mock-car-${place.code}-${ci}-${j}`,
        category: "cars" as const,
        provider: "Mock rentals",
        title: `${cls.name} · ${cls.example}`,
        subtitle: `${company} · ${place.airport}`,
        price: { amount: daily, currency: "USD" },
        priceUnit: "per day",
        totalPrice: { amount: daily * days, currency: "USD" },
        rating: Math.round((3.5 + rng.next() * 1.4) * 10) / 10,
        reviewCount: rng.int(30, 2500),
        start: atMinutes(params.pickupDate, 10 * 60),
        end: atMinutes(params.dropoffDate, 10 * 60),
        location: place.airport,
        tags,
        details: {
          Company: company,
          Seats: String(cls.seats),
          Bags: String(cls.bags),
          Transmission: automatic ? "Automatic" : "Manual",
          Days: String(days),
          Pickup: `${place.airport} (${place.code})`,
          Fuel: cls.name === "Electric" ? "Return at 70% charge" : "Full to full",
        },
        bookingUrl: links.cars(place.code, params.pickupDate, params.dropoffDate),
        imageHue: (ci * 51) % 360,
      };
    }),
  );
}
