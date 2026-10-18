import type { HotelSearch, Offer } from "../../../shared/types.ts";
import { atMinutes, daysBetween } from "../../dates.ts";
import { links } from "../links.ts";
import { resolvePlace } from "./places.ts";
import { seededRandom } from "./random.ts";

const NAME_PARTS = {
  prefix: ["The Alder", "Hotel Lumen", "The Wren", "Casa Solana", "The Linden", "Hotel Marlowe", "The Juniper", "Maison Clair", "The Harbor House", "Hotel Arden", "The Copper Fox", "Villa Serena", "The Ivy Rooms", "Hotel Nomad", "The Grand Meridian", "Driftwood Inn"],
};

const TYPES = [
  { type: "Hotel", stars: [3, 4], factor: 1 },
  { type: "Boutique hotel", stars: [4, 5], factor: 1.35 },
  { type: "Luxury hotel", stars: [5, 5], factor: 2.6 },
  { type: "Apartment", stars: [3, 4], factor: 0.95 },
  { type: "Hostel", stars: [2, 2], factor: 0.35 },
  { type: "Resort", stars: [4, 5], factor: 1.9 },
  { type: "Guesthouse", stars: [3, 3], factor: 0.7 },
] as const;

const AMENITIES = ["Free Wi-Fi", "Breakfast included", "Pool", "Gym", "Spa", "Airport shuttle", "Kitchen", "Rooftop bar", "Pet friendly", "Free cancellation", "Laundry", "Parking"];

export async function searchHotels(params: HotelSearch): Promise<Offer[]> {
  const place = resolvePlace(params.location);
  const rng = seededRandom(`hotels|${place.code}|${params.checkIn}|${params.checkOut}|${params.guests}`);
  const nights = Math.max(1, daysBetween(params.checkIn, params.checkOut));
  const rooms = Math.max(1, params.rooms);

  return rng.shuffle(NAME_PARTS.prefix).slice(0, 12).map((name, i) => {
    const kind = rng.pick(TYPES);
    const stars = rng.int(kind.stars[0], kind.stars[1]);
    const neighborhood = rng.pick(place.neighborhoods);
    const nightly = Math.round(85 * place.costIndex * kind.factor * (0.8 + rng.next() * 0.6) * (1 + (params.guests > 2 ? 0.25 : 0)));
    const amenities = rng.shuffle(AMENITIES).slice(0, rng.int(3, 6));
    const rating = Math.round((3.6 + rng.next() * 1.35) * 10) / 10;
    const total = nightly * nights * rooms;
    const tags: string[] = [kind.type];
    if (amenities.includes("Free cancellation")) tags.push("Free cancellation");
    if (amenities.includes("Breakfast included")) tags.push("Breakfast");

    return {
      id: `mock-ht-${place.code}-${params.checkIn}-${i}`,
      category: "hotels" as const,
      provider: "Mock stays",
      title: `${name} ${neighborhood}`,
      subtitle: `${"★".repeat(stars)} · ${neighborhood}, ${place.city}`,
      price: { amount: nightly, currency: "USD" },
      priceUnit: "per night",
      totalPrice: { amount: total, currency: "USD" },
      rating,
      reviewCount: rng.int(40, 4200),
      start: atMinutes(params.checkIn, 15 * 60),
      end: atMinutes(params.checkOut, 11 * 60),
      location: `${neighborhood}, ${place.city}`,
      tags,
      details: {
        Type: kind.type,
        Stars: String(stars),
        Nights: String(nights),
        Rooms: String(rooms),
        Guests: String(params.guests),
        Amenities: amenities.join(", "),
        "Distance to centre": `${(rng.next() * 4 + 0.2).toFixed(1)} km`,
        "Near": rng.pick(place.landmarks),
      },
      bookingUrl: links.hotels(place.city, params.checkIn, params.checkOut, params.guests, rooms, name),
      imageHue: rng.int(0, 359),
    };
  });
}
