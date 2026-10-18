import { useState } from "react";
import type { Trip, TripItem } from "../../shared/types.ts";
import { addDays, dayLabel, daysBetween, money, time } from "../format.ts";
import { CATEGORY_ICON, Icon } from "../icons.tsx";
import { ItemRow } from "./TripBoard.tsx";
import type { TripActions } from "./Workspace.tsx";

interface Entry {
  item: TripItem;
  at: string;
  label?: string;
}

const END_LABEL: Partial<Record<TripItem["category"], string>> = { hotels: "Check out", cars: "Drop off" };
const START_LABEL: Partial<Record<TripItem["category"], string>> = { hotels: "Check in", cars: "Pick up" };

export function Itinerary({ trip, actions }: { trip: Trip; actions: TripActions }) {
  const [bookedOnly, setBookedOnly] = useState(false);
  const items = trip.items.filter((i) => !bookedOnly || i.status === "booked");
  const days = Array.from({ length: daysBetween(trip.startDate, trip.endDate) + 1 }, (_, i) => addDays(trip.startDate, i));

  const entries: Entry[] = [];
  for (const item of items) {
    if (!item.start) continue;
    entries.push({ item, at: item.start, label: START_LABEL[item.category] });
    if (item.moments?.length) {
      for (const m of item.moments) entries.push({ item, at: m.at, label: m.label });
    } else if (item.end && END_LABEL[item.category] && item.end.slice(0, 10) !== item.start.slice(0, 10)) {
      entries.push({ item, at: item.end, label: END_LABEL[item.category] });
    }
  }
  entries.sort((a, b) => a.at.localeCompare(b.at));

  const unscheduled = items.filter((i) => !i.start);
  // Judge by start only: an overnight return flight landing the day after the trip is fine.
  const outside = items.filter((i) => i.start && (i.start.slice(0, 10) < trip.startDate || i.start.slice(0, 10) > trip.endDate));
  const staysOn = (day: string) => items.filter((i) => i.category === "hotels" && i.start && i.end && i.start.slice(0, 10) <= day && i.end.slice(0, 10) > day);

  return (
    <div className="itinerary">
      <div className="results-toolbar">
        <span className="muted small">
          {days.length} days · {entries.length} scheduled · {unscheduled.length} unscheduled
        </span>
        <label className="inline">
          <input type="checkbox" checked={bookedOnly} onChange={(e) => setBookedOnly(e.target.checked)} /> Booked only
        </label>
      </div>

      <div className="itinerary-layout">
        <ol className="days">
          {days.map((day, n) => {
            const todays = entries.filter((e) => e.at.slice(0, 10) === day);
            const stays = staysOn(day);
            const dayCost = todays.filter((e) => !e.label || e.label === START_LABEL[e.item.category]).reduce((s, e) => s + (e.item.category === "hotels" ? 0 : e.item.cost.amount), 0);
            return (
              <li key={day} className="day card">
                <div className="day-head">
                  <div>
                    <span className="day-num">Day {n + 1}</span>
                    <h3>{dayLabel(day)}</h3>
                  </div>
                  {dayCost > 0 && <span className="muted small">{money(dayCost, trip.currency)} planned</span>}
                </div>
                {todays.length === 0 && <p className="muted small">Nothing planned yet — a free day, or search activities to fill it.</p>}
                <ul className="timeline">
                  {todays.map((e) => (
                    <li key={`${e.item.id}-${e.at}`} className={`timeline-entry status-border-${e.item.status}`}>
                      <span className="timeline-time">{time(e.at) || "—"}</span>
                      <span className="item-icon">
                        <Icon name={CATEGORY_ICON[e.item.category]} size={16} />
                      </span>
                      <button className="item-main" onClick={() => actions.editItem(e.item)}>
                        <span className="item-title">
                          {e.label ? `${e.label}: ` : ""}
                          {e.item.title}
                        </span>
                        <span className="muted small">
                          {e.item.subtitle}
                          {e.item.confirmation ? ` · Conf. ${e.item.confirmation}` : ""}
                        </span>
                      </button>
                      <span className={`status-chip status-${e.item.status}`}>{e.item.status}</span>
                    </li>
                  ))}
                </ul>
                {stays.length > 0 && (
                  <p className="stay-line small">
                    <Icon name="bed" size={14} /> Night at {stays.map((s) => s.title).join(" or ")}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        <aside className="itinerary-side">
          <div className="card">
            <h2>Unscheduled</h2>
            {unscheduled.length === 0 && <p className="muted small">Everything has a time. Nice.</p>}
            {unscheduled.map((item) => (
              <div key={item.id} className="unscheduled">
                <ItemRow item={item} actions={actions} compact />
                <label className="inline small">
                  Schedule for
                  <select value="" onChange={(e) => e.target.value && actions.updateItem(item.id, { start: `${e.target.value}T10:00` })}>
                    <option value="">Pick a day…</option>
                    {days.map((d, n) => (
                      <option key={d} value={d}>
                        Day {n + 1} · {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
          {outside.length > 0 && (
            <div className="card">
              <h2>Outside trip dates</h2>
              <p className="muted small">These fall before or after your trip — check the dates.</p>
              {outside.map((item) => (
                <ItemRow key={item.id} item={item} actions={actions} compact />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
