import type { Watch } from "../shared/types.ts";
import type { Store } from "./db.ts";
import { refreshGrids } from "./grids.ts";
import type { Registry } from "./providers/index.ts";

/**
 * Today's date, YYYY-MM-DD, in APP_TIMEZONE (e.g. America/Los_Angeles) if set,
 * otherwise the server's own time zone. Hosted servers usually run on UTC.
 */
export function localToday(timeZone = process.env.APP_TIMEZONE || undefined): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** The date the watched thing happens; once it's past there's nothing left to watch. */
export function travelDate(watch: Watch): string {
  const p = watch.params as unknown as Record<string, string | undefined>;
  return p.departDate ?? p.checkIn ?? p.pickupDate ?? p.date ?? "9999-12-31";
}

/**
 * Re-run the watched search and record today's price. One point per day: a
 * second check on the same day replaces that day's point.
 */
export async function checkWatch(watch: Watch, registry: Registry, asOf: string): Promise<Watch> {
  const { offers } = await registry.search(watch.category, watch.params, { asOf });
  const offer = offers.find((o) => o.id === watch.offerId);
  const last = watch.history[watch.history.length - 1];
  const point = offer
    ? { date: asOf, amount: offer.totalPrice.amount, available: true }
    : { date: asOf, amount: last?.amount ?? 0, available: false };
  return {
    ...watch,
    history: [...watch.history.filter((h) => h.date !== asOf), point].sort((a, b) => a.date.localeCompare(b.date)),
    lastChecked: new Date().toISOString(),
    bookingUrl: offer?.bookingUrl ?? watch.bookingUrl,
  };
}

/** Check every watch that hasn't been checked today (or all of them, if forced). */
export async function refreshWatches(store: Store, registry: Registry, asOf: string, force = false): Promise<Watch[]> {
  const out: Watch[] = [];
  for (const watch of await store.listWatches()) {
    const checkedToday = watch.history.some((h) => h.date === asOf);
    const expired = travelDate(watch) < asOf;
    if (expired || (checkedToday && !force)) {
      out.push(watch);
      continue;
    }
    try {
      out.push(await store.saveWatch(await checkWatch(watch, registry, asOf)));
    } catch (err) {
      console.error(`Price watch ${watch.id} failed:`, err);
      out.push(watch);
    }
  }
  return out;
}

/** Background job: wakes up periodically and refreshes watches that are a day old. */
export function startWatcher(store: Store, registry: Registry, intervalMinutes: number, today = localToday) {
  const tick = () =>
    refreshWatches(store, registry, today())
      .then(() => refreshGrids(store, registry, today(), 10 * 60_000))
      .catch((err) => console.error("Price watcher:", err));
  void tick();
  const timer = setInterval(tick, intervalMinutes * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
