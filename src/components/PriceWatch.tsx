import { useEffect, useMemo, useState } from "react";
import type { Trip, Watch } from "../../shared/types.ts";
import { api } from "../api.ts";
import { CATEGORY_LABEL, money, shortDate, today } from "../format.ts";
import { CATEGORY_ICON, Icon } from "../icons.tsx";
import { href } from "../router.ts";
import { PriceChart } from "./PriceChart.tsx";

interface Stats {
  current: number;
  first: number;
  previous?: number;
  low: number;
  high: number;
  available: boolean;
  dayChange?: number;
  totalChange: number;
}

function stats(w: Watch): Stats {
  const seen = w.history.filter((h) => h.available);
  const last = w.history[w.history.length - 1];
  const current = last?.amount ?? 0;
  const prevPoint = seen.length > 1 ? seen[seen.length - (last?.available ? 2 : 1)] : undefined;
  const amounts = seen.map((h) => h.amount);
  return {
    current,
    first: w.history[0]?.amount ?? current,
    previous: prevPoint?.amount,
    low: amounts.length ? Math.min(...amounts) : current,
    high: amounts.length ? Math.max(...amounts) : current,
    available: last?.available ?? true,
    dayChange: prevPoint ? current - prevPoint.amount : undefined,
    totalChange: current - (w.history[0]?.amount ?? current),
  };
}

function Change({ value, base, currency }: { value?: number; base?: number; currency: string }) {
  if (value === undefined || !base) return <span className="muted">—</span>;
  if (value === 0) return <span className="change flat">No change</span>;
  const down = value < 0;
  return (
    <span className={`change ${down ? "down" : "up"}`}>
      {down ? "▼" : "▲"} {money(Math.abs(value), currency)} ({Math.abs((value / base) * 100).toFixed(1)}%)
    </span>
  );
}

type SortKey = "change" | "price" | "date" | "added";

export function PriceWatch() {
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("change");
  const [tableFor, setTableFor] = useState<string | null>(null);

  useEffect(() => {
    api.watches().then(setWatches).catch((e) => setError(e.message));
    api.trips().then(setTrips).catch(() => setTrips([]));
  }, []);

  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      setWatches(await api.refreshWatches());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (w: Watch) => {
    await api.unwatch(w.id);
    setWatches((list) => list?.filter((x) => x.id !== w.id) ?? null);
  };

  const rows = useMemo(() => {
    const withStats = (watches ?? []).map((w) => ({ w, s: stats(w) }));
    const date = (w: Watch) => {
      const p = w.params as unknown as Record<string, string>;
      return p.departDate ?? p.checkIn ?? p.pickupDate ?? p.date ?? "";
    };
    const sorters: Record<SortKey, (a: (typeof withStats)[number], b: (typeof withStats)[number]) => number> = {
      change: (a, b) => (a.s.dayChange ?? 0) / (a.s.previous || 1) - (b.s.dayChange ?? 0) / (b.s.previous || 1),
      price: (a, b) => a.s.current - b.s.current,
      date: (a, b) => date(a.w).localeCompare(date(b.w)),
      added: (a, b) => b.w.createdAt.localeCompare(a.w.createdAt),
    };
    return withStats.sort(sorters[sort]);
  }, [watches, sort]);

  const drops = rows.filter((r) => (r.s.dayChange ?? 0) < 0).length;
  const rises = rows.filter((r) => (r.s.dayChange ?? 0) > 0).length;
  const lastCheck = (watches ?? []).map((w) => w.lastChecked ?? "").sort().pop();
  const tripName = (id?: string) => trips.find((t) => t.id === id)?.name;

  return (
    <div className="watch-page">
      <header className="watch-head">
        <div>
          <span className="eyebrow eyebrow-dot">Checked daily</span>
          <h1>Price watch</h1>
          <p className="muted">
            Everything you're watching, re-priced once a day. Watch a flight or stay from any search result with <strong>Watch</strong>.
            {lastCheck && ` Last checked ${new Date(lastCheck).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`}
          </p>
        </div>
        <div className="toolbar-controls">
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort watches">
            <option value="change">Biggest drop today</option>
            <option value="price">Lowest price</option>
            <option value="date">Travel date</option>
            <option value="added">Recently added</option>
          </select>
          <button className="btn btn-primary" onClick={refresh} disabled={busy || !watches?.length}>
            {busy ? "Checking…" : "Check prices now"}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {watches && watches.length > 0 && (
        <div className="stat-cards">
          <div className="card stat-card">
            <span className="stat-label">Watching</span>
            <span className="stat-value">{watches.length}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Cheaper since last check</span>
            <span className="stat-value">{drops}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Pricier since last check</span>
            <span className="stat-value">{rises}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Today</span>
            <span className="stat-value">{shortDate(today())}</span>
          </div>
        </div>
      )}

      {watches?.length === 0 && (
        <div className="card empty muted">
          <Icon name="plane" size={28} />
          <p>Nothing watched yet. Open a trip, search flights or stays, and press Watch on the options you're considering.</p>
        </div>
      )}

      <div className="watch-list">
        {rows.map(({ w, s }) => (
          <article key={w.id} className={`card watch ${s.available ? "" : "unavailable"}`}>
            <div className="watch-info">
              <span className="eyebrow">
                <Icon name={CATEGORY_ICON[w.category]} size={12} /> {CATEGORY_LABEL[w.category]}
                {tripName(w.tripId) && (
                  <>
                    {" · "}
                    <a href={href({ page: "trip", id: w.tripId!, tab: "search" })}>{tripName(w.tripId)}</a>
                  </>
                )}
              </span>
              <h3>{w.title}</h3>
              <p className="muted small">
                {w.subtitle} · {travelSummary(w)}
              </p>
              {!s.available && <p className="warn small">⚠ Not in today's results — it may be sold out. Showing the last seen price.</p>}
              <dl className="watch-stats">
                <div>
                  <dt>Now</dt>
                  <dd className="watch-price">{money(s.current, w.currency)}</dd>
                </div>
                <div>
                  <dt>Since last check</dt>
                  <dd>
                    <Change value={s.dayChange} base={s.previous} currency={w.currency} />
                  </dd>
                </div>
                <div>
                  <dt>Since {shortDate(w.history[0]?.date ?? w.createdAt)}</dt>
                  <dd>
                    <Change value={w.history.length > 1 ? s.totalChange : undefined} base={s.first} currency={w.currency} />
                  </dd>
                </div>
                <div>
                  <dt>Low / high</dt>
                  <dd>
                    {money(s.low, w.currency)} / {money(s.high, w.currency)}
                  </dd>
                </div>
              </dl>
              <div className="form-actions start">
                <a className="btn btn-primary btn-sm" href={w.bookingUrl} target="_blank" rel="noreferrer">
                  Book <Icon name="external" size={12} />
                </a>
                <button className="btn btn-ghost btn-sm" onClick={() => setTableFor(tableFor === w.id ? null : w.id)}>
                  {tableFor === w.id ? "Hide history" : "History table"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(w)}>
                  Stop watching
                </button>
              </div>
            </div>
            <div className="watch-chart">
              <PriceChart history={w.history} currency={w.currency} />
              {tableFor === w.id && (
                <table className="history-table small">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="num">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...w.history].reverse().map((h) => (
                      <tr key={h.date}>
                        <td>{shortDate(h.date)}</td>
                        <td className="num">{h.available ? money(h.amount, w.currency) : "Unavailable"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="muted small">
        Prices are re-checked automatically once a day while the app's server is running. Only results from a live source (flights and stays, once
        SerpApi is connected) can be watched.
      </p>
    </div>
  );
}

function travelSummary(w: Watch): string {
  const p = w.params as unknown as Record<string, string | number | undefined>;
  if (w.category === "flights") return `${shortDate(String(p.departDate))}${p.returnDate ? ` – ${shortDate(String(p.returnDate))}` : ""} · ${p.adults} adult${p.adults === 1 ? "" : "s"}`;
  if (w.category === "hotels") return `${shortDate(String(p.checkIn))} – ${shortDate(String(p.checkOut))} · ${p.guests} guests`;
  if (w.category === "cars") return `${shortDate(String(p.pickupDate))} – ${shortDate(String(p.dropoffDate))}`;
  return p.date ? shortDate(String(p.date)) : "";
}
