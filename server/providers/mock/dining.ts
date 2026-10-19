import type { DiningSearch, Offer } from "../../../shared/types.ts";
import { atMinutes } from "../../dates.ts";
import { links } from "../links.ts";
import { nearCenter, resolvePlace } from "./places.ts";
import { seededRandom } from "./random.ts";

export const CUISINES = ["Local", "Seafood", "Italian", "Japanese", "Vegetarian", "Steakhouse", "Street food", "Bakery & café", "Fine dining", "Tapas & small plates"];

const NAMES = ["Ember", "The Salt Room", "Olive & Vine", "Kin", "Little Fig", "Harbor Table", "Juniper Kitchen", "Saffron", "The Gilded Spoon", "Nori", "Brasa", "Copper Pot", "Wild Thyme", "Lantern", "Mesa", "Bluebird Café", "Fennel", "Palma"];

export async function searchDining(params: DiningSearch): Promise<Offer[]> {
  const place = resolvePlace(params.location);
  const rng = seededRandom(`dining|${place.code}|${params.cuisine ?? ""}`);

  return rng.shuffle(NAMES).slice(0, 12).map((name, i) => {
    const cuisine = params.cuisine || rng.pick(CUISINES);
    const level = cuisine === "Fine dining" ? 4 : cuisine === "Street food" || cuisine === "Bakery & café" ? 1 : rng.int(1, 3) + (rng.chance(0.2) ? 1 : 0);
    const perPerson = Math.round((12 + level * level * 11) * place.costIndex * (0.85 + rng.next() * 0.3));
    const neighborhood = rng.pick(place.neighborhoods);
    const dinnerMinutes = rng.pick([18 * 60 + 30, 19 * 60, 19 * 60 + 30, 20 * 60]);
    const tags = [cuisine, "$".repeat(level)];
    if (rng.chance(0.35)) tags.push("Reservations recommended");
    if (rng.chance(0.25)) tags.push("Local favourite");

    return {
      id: `mock-dn-${place.code}-${i}`,
      category: "dining" as const,
      provider: "Mock dining",
      title: name,
      subtitle: `${cuisine} · ${"$".repeat(level)} · ${neighborhood}`,
      price: { amount: perPerson, currency: "USD" },
      priceUnit: "avg per person",
      totalPrice: { amount: perPerson, currency: "USD" },
      rating: Math.round((3.8 + rng.next() * 1.2) * 10) / 10,
      reviewCount: rng.int(25, 3800),
      start: params.date ? atMinutes(params.date, dinnerMinutes) : undefined,
      end: params.date ? atMinutes(params.date, dinnerMinutes + 90) : undefined,
      location: `${neighborhood}, ${place.city}`,
      tags,
      details: {
        Cuisine: cuisine,
        "Price level": "$".repeat(level),
        Neighborhood: neighborhood,
        Hours: rng.pick(["11:30 – 22:00", "17:00 – 23:00", "08:00 – 16:00", "12:00 – 15:00, 18:00 – 23:30"]),
        "Known for": rng.pick(["Tasting menu", "Seasonal small plates", "Wood-fired grill", "Natural wine list", "Views", "Classic local dishes"]),
      },
      bookingUrl: links.dining(place.city, name),
      points: [nearCenter(place, seededRandom(`${place.code}-dn-${i}`).next, 4, name)].filter((p) => p !== undefined),
      imageHue: rng.int(0, 359),
    };
  });
}
