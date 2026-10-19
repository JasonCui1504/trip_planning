import type { EditHotel } from "../shared/types.ts";
import type { CacheStore } from "./db.ts";

/**
 * Chase Sapphire Reserve's "The Edit" hotel collection, as published by
 * edithotelsearch.com (a community-built list of ~1,300 properties). The page
 * embeds the list as JSON; we fetch it, cache it for a week (on disk or in Redis), and use
 * it to badge hotel results and to browse Edit hotels by destination.
 *
 * The list isn't official — always verify on Chase Travel before booking.
 */

export const EDIT_SOURCE_URL = "https://edithotelsearch.com/";
const MAX_AGE_MS = 7 * 86_400_000;
// Used if the page stops listing the brands itself.
const DEFAULT_SELECT_BRANDS = ["IHG", "Omni", "Virgin Hotels", "Montage", "Pendry", "Minor Hotels", "Pan Pacific"];

interface RawHotel {
  name: string;
  id?: string;
  location: string;
  brand: string;
  region: string;
}

export interface EditSnapshot {
  hotels: EditHotel[];
  fetchedAt: string | null;
  source: string;
}

/** Pull the hotel list and Select-credit brands out of the edithotelsearch.com page. */
export function parseEditPage(html: string): EditHotel[] {
  const raw = html.match(/const\s+HOTELS_RAW\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!raw) throw new Error("Couldn't find the hotel list on the page (its format may have changed)");
  const list = JSON.parse(raw[1]) as RawHotel[];
  const brandsMatch = html.match(/const\s+SELECT_BRANDS\s*=\s*(\[[^\]]*\])/);
  const selectBrands: string[] = brandsMatch ? JSON.parse(brandsMatch[1].replace(/'/g, '"')) : DEFAULT_SELECT_BRANDS;
  const isSelect = (brand: string) => selectBrands.some((b) => brand.toLowerCase().includes(b.toLowerCase()));
  return list
    .filter((h) => typeof h?.name === "string" && typeof h?.location === "string")
    .map((h) => ({ name: h.name, location: h.location, brand: h.brand || "Independent", region: h.region || "", selectCredit: isSelect(h.brand || "") }));
}

const STOP_WORDS = new Set(["the", "a", "an", "hotel", "hotels", "resort", "and", "&", "at", "by", "of", "spa", "residences"]);

export function normalize(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));
}

/** Same hotel? Most of the shorter name's distinctive words appear in the longer one. */
export function sameHotel(a: string, b: string): boolean {
  const [x, y] = [normalize(a), normalize(b)];
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, new Set(y)] : [y, new Set(x)];
  const hits = short.filter((w) => long.has(w)).length;
  return hits / short.length >= 0.8 && hits >= Math.min(2, short.length);
}

export function inLocation(hotel: EditHotel, location: string): boolean {
  const want = normalize(location.split(",")[0]);
  const have = new Set(normalize(hotel.location));
  return want.length > 0 && want.every((w) => have.has(w));
}

export function createEditCatalog({ cache, offline = false, fetch: fetchImpl = fetch }: { cache?: CacheStore; offline?: boolean; fetch?: typeof fetch }) {
  let snapshot: Promise<EditSnapshot> | null = null;

  async function readCache(): Promise<{ snap: EditSnapshot; fresh: boolean } | null> {
    const hit = await cache?.getCache("edit-hotels").catch(() => null);
    if (!hit) return null;
    try {
      return { snap: JSON.parse(hit.value) as EditSnapshot, fresh: Date.now() - hit.savedAt < MAX_AGE_MS };
    } catch {
      return null;
    }
  }

  async function refresh(): Promise<EditSnapshot> {
    const cached = await readCache();
    if (cached?.fresh || offline) return cached?.snap ?? { hotels: [], fetchedAt: null, source: EDIT_SOURCE_URL };
    try {
      const res = await fetchImpl(EDIT_SOURCE_URL, { headers: { "User-Agent": "TripWorkshop/0.1 (personal trip-planning prototype)" }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`edithotelsearch.com responded ${res.status}`);
      const snap: EditSnapshot = { hotels: parseEditPage(await res.text()), fetchedAt: new Date().toISOString(), source: EDIT_SOURCE_URL };
      await cache?.setCache("edit-hotels", JSON.stringify(snap)).catch((err) => console.error("Edit cache:", err));
      return snap;
    } catch (err) {
      console.error("Edit hotel list:", (err as Error).message);
      // A stale list beats no list.
      return cached?.snap ?? { hotels: [], fetchedAt: null, source: EDIT_SOURCE_URL };
    }
  }

  const load = () => (snapshot ??= refresh().finally(() => setTimeout(() => (snapshot = null), MAX_AGE_MS).unref()));

  return {
    load,
    /** Edit hotels at a destination and/or matching free text. */
    async search({ location, q }: { location?: string; q?: string }) {
      const snap = await load();
      const words = q ? normalize(q) : [];
      const hotels = snap.hotels.filter((h) => {
        if (location && !inLocation(h, location)) return false;
        if (!words.length) return true;
        const hay = new Set(normalize(`${h.name} ${h.brand} ${h.location}`));
        return words.every((w) => hay.has(w));
      });
      return { hotels, total: snap.hotels.length, fetchedAt: snap.fetchedAt, source: snap.source };
    },
    /** The Edit entry for a hotel search result, if it's in the collection. */
    async match(name: string, location: string): Promise<EditHotel | undefined> {
      const snap = await load();
      return snap.hotels.find((h) => inLocation(h, location) && sameHotel(h.name, name));
    },
  };
}

export type EditCatalog = ReturnType<typeof createEditCatalog>;
