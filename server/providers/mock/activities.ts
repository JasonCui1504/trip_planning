import type { ActivitySearch, Offer } from "../../../shared/types.ts";
import { atMinutes } from "../../dates.ts";
import { links } from "../links.ts";
import { resolvePlace } from "./places.ts";
import { seededRandom } from "./random.ts";

export const ACTIVITY_CATEGORIES = ["Tours", "Food & drink", "Culture", "Outdoors", "Nightlife", "Day trips", "Classes"] as const;

// {city}, {landmark} and {hood} are filled in per destination.
const TEMPLATES: { category: (typeof ACTIVITY_CATEGORIES)[number]; title: string; hours: number; base: number }[] = [
  { category: "Tours", title: "Small-group walking tour of {hood}", hours: 3, base: 35 },
  { category: "Tours", title: "Skip-the-line entry to {landmark}", hours: 2, base: 45 },
  { category: "Tours", title: "{city} highlights by bike", hours: 3.5, base: 40 },
  { category: "Tours", title: "Sunrise photography walk near {landmark}", hours: 2.5, base: 55 },
  { category: "Food & drink", title: "Evening street food tour in {hood}", hours: 3, base: 65 },
  { category: "Food & drink", title: "Market tour & tasting at {landmark}", hours: 2.5, base: 50 },
  { category: "Food & drink", title: "Local wine & cocktail crawl", hours: 3, base: 70 },
  { category: "Culture", title: "Guided museum visit: {landmark}", hours: 2, base: 38 },
  { category: "Culture", title: "Live music night in {hood}", hours: 2.5, base: 30 },
  { category: "Culture", title: "Architecture & history of {city}", hours: 2.5, base: 32 },
  { category: "Outdoors", title: "Kayak or boat trip around {city}", hours: 3, base: 60 },
  { category: "Outdoors", title: "Hike with views of {landmark}", hours: 4, base: 45 },
  { category: "Outdoors", title: "Sunset sail with drinks", hours: 2, base: 85 },
  { category: "Nightlife", title: "Rooftop bar hop in {hood}", hours: 3, base: 40 },
  { category: "Day trips", title: "Full-day trip to {landmark}", hours: 9, base: 120 },
  { category: "Day trips", title: "Countryside escape from {city}", hours: 8, base: 110 },
  { category: "Classes", title: "Hands-on cooking class", hours: 3, base: 75 },
  { category: "Classes", title: "Craft workshop with a local artisan", hours: 2, base: 55 },
];

export async function searchActivities(params: ActivitySearch): Promise<Offer[]> {
  const place = resolvePlace(params.location);
  const rng = seededRandom(`activities|${place.code}|${params.date ?? ""}`);
  const templates = params.category ? TEMPLATES.filter((t) => t.category === params.category) : TEMPLATES;

  return templates.map((t, i) => {
    const title = t.title
      .replace("{city}", place.city)
      .replace("{landmark}", rng.pick(place.landmarks))
      .replace("{hood}", rng.pick(place.neighborhoods));
    const price = Math.round(t.base * (0.7 + place.costIndex * 0.4) * (0.85 + rng.next() * 0.35));
    const startMinutes =
      t.category === "Nightlife" ? 20 * 60
      : /sunrise/i.test(t.title) ? 6 * 60
      : /evening|sunset|night/i.test(t.title) ? rng.pick([17, 18, 19]) * 60
      : t.hours >= 8 ? 8 * 60
      : rng.pick([9, 10, 11, 14, 15]) * 60;
    const tags: string[] = [t.category];
    if (rng.chance(0.5)) tags.push("Free cancellation");
    if (rng.chance(0.25)) tags.push("Likely to sell out");

    return {
      id: `mock-ac-${place.code}-${i}`,
      category: "activities" as const,
      provider: "Mock experiences",
      title,
      subtitle: `${t.category} · ${t.hours} hours · ${place.city}`,
      price: { amount: price, currency: "USD" },
      priceUnit: "per person",
      totalPrice: { amount: price, currency: "USD" },
      rating: Math.round((4 + rng.next()) * 10) / 10,
      reviewCount: rng.int(12, 9000),
      start: params.date ? atMinutes(params.date, startMinutes) : undefined,
      end: params.date ? atMinutes(params.date, startMinutes + t.hours * 60) : undefined,
      location: place.city,
      tags,
      details: {
        Duration: `${t.hours} hours`,
        "Group size": rng.pick(["Up to 8", "Up to 12", "Up to 20", "Private"]),
        Languages: rng.pick(["English", "English, Spanish", "English, French", "English, Japanese"]),
        "Meeting point": `${rng.pick(place.neighborhoods)}, ${place.city}`,
      },
      bookingUrl: links.activities(place.city, title),
      imageHue: rng.int(0, 359),
    };
  });
}
