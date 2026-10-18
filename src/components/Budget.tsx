import { CATEGORIES, type Trip } from "../../shared/types.ts";
import { CATEGORY_LABEL, daysBetween, money } from "../format.ts";
import { CATEGORY_ICON, Icon } from "../icons.tsx";
import type { TripActions } from "./Workspace.tsx";

export function Budget({ trip, actions }: { trip: Trip; actions: TripActions }) {
  const sum = (filter: (i: Trip["items"][number]) => boolean) => trip.items.filter(filter).reduce((s, i) => s + i.cost.amount, 0);
  const booked = sum((i) => i.status === "booked");
  const shortlisted = sum((i) => i.status === "shortlisted");
  const remaining = trip.budget - booked;
  const days = Math.max(1, daysBetween(trip.startDate, trip.endDate));
  const scale = Math.max(trip.budget, booked + shortlisted, 1);

  const rows = [...CATEGORIES, "custom" as const]
    .map((c) => ({
      category: c,
      booked: sum((i) => i.category === c && i.status === "booked"),
      shortlisted: sum((i) => i.category === c && i.status === "shortlisted"),
      count: trip.items.filter((i) => i.category === c).length,
    }))
    .filter((r) => r.count > 0);
  const rowMax = Math.max(1, ...rows.map((r) => r.booked + r.shortlisted));

  return (
    <div className="budget">
      <div className="stat-cards">
        <div className="card stat-card">
          <span className="stat-label">Budget</span>
          <span className="stat-value">{trip.budget ? money(trip.budget, trip.currency) : "Not set"}</span>
          <button className="link-btn small" onClick={() => {
            const value = prompt("Trip budget", String(trip.budget));
            if (value !== null && !Number.isNaN(Number(value))) actions.updateTrip({ budget: Math.round(Number(value)) });
          }}>
            Change
          </button>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Booked</span>
          <span className="stat-value">{money(booked, trip.currency)}</span>
          <span className="muted small">{money(booked / trip.travelers, trip.currency)} per person</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Shortlisted (not booked)</span>
          <span className="stat-value">{money(shortlisted, trip.currency)}</span>
          <span className="muted small">if you book everything shortlisted</span>
        </div>
        <div className={`card stat-card ${remaining < 0 ? "over" : ""}`}>
          <span className="stat-label">{remaining < 0 ? "Over budget" : "Remaining"}</span>
          <span className="stat-value">{trip.budget ? money(Math.abs(remaining), trip.currency) : "—"}</span>
          <span className="muted small">{trip.budget ? `${money(Math.max(0, remaining) / days, trip.currency)} per day left` : "Set a budget to track this"}</span>
        </div>
      </div>

      <div className="card">
        <h2>Spend vs. budget</h2>
        <div className="stack-bar" role="img" aria-label={`Booked ${money(booked)}, shortlisted ${money(shortlisted)}, budget ${money(trip.budget)}`}>
          <span className="seg seg-booked" style={{ width: `${(booked / scale) * 100}%` }} />
          <span className="seg seg-short" style={{ width: `${(shortlisted / scale) * 100}%` }} />
          {trip.budget > 0 && <span className="budget-mark" style={{ left: `${(trip.budget / scale) * 100}%` }} title="Budget" />}
        </div>
        <div className="legend small">
          <span><i className="swatch seg-booked" /> Booked</span>
          <span><i className="swatch seg-short" /> Shortlisted</span>
          {trip.budget > 0 && <span><i className="swatch swatch-line" /> Budget</span>}
        </div>
      </div>

      <div className="card">
        <h2>By category</h2>
        {rows.length === 0 && <p className="muted small">Save some options from Search & save to see where the money goes.</p>}
        <table className="budget-table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.category}>
                <th>
                  <Icon name={CATEGORY_ICON[r.category]} size={16} /> {CATEGORY_LABEL[r.category]}
                </th>
                <td className="bar-cell">
                  <span className="mini-bar">
                    <span className="seg seg-booked" style={{ width: `${(r.booked / rowMax) * 100}%` }} />
                    <span className="seg seg-short" style={{ width: `${(r.shortlisted / rowMax) * 100}%` }} />
                  </span>
                </td>
                <td className="num">{money(r.booked, trip.currency)}</td>
                <td className="num muted">+ {money(r.shortlisted, trip.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">Ideas aren't counted. Shortlisted totals can include alternatives you won't all book (e.g. three hotels for the same nights).</p>
      </div>
    </div>
  );
}
