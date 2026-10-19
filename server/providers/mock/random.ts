/** Small seeded PRNG so the same search always returns the same mock results. */
export function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
    shuffle: <T>(items: readonly T[]): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

export type Rng = ReturnType<typeof seededRandom>;

/**
 * How a mock price moves from day to day, so watched prices change like real
 * fares: a slow wave, a little daily noise, and a climb in the last few weeks
 * before the date. Deterministic for a given offer and day.
 */
export function dailyPriceFactor(key: string, asOf: string, travelDate: string): number {
  const day = Math.floor(Date.parse(`${asOf}T00:00:00Z`) / 86_400_000);
  const phase = seededRandom(key).next() * Math.PI * 2;
  const noise = seededRandom(`${key}|${asOf}`).next() - 0.5;
  const daysOut = Math.round((Date.parse(`${travelDate}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000);
  const lastMinute = daysOut < 21 ? (21 - Math.max(0, daysOut)) * 0.012 : 0;
  return 1 + 0.07 * Math.sin(day / 4 + phase) + 0.04 * noise + lastMinute;
}
