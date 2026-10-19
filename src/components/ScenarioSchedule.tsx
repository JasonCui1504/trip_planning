import { applyScenario, type Scenario, type ScheduleTime, type Trip, type TripItem } from "../../shared/types.ts";
import { addDays, dayLabel, money } from "../format.ts";
import { CATEGORY_ICON, Icon } from "../icons.tsx";
import { datesOf } from "../scenario.ts";

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm"; date-only values get a default time.
const toLocal = (v?: string) => (!v ? "" : v.length === 10 ? `${v}T09:00` : v.slice(0, 16));

/** Pieces that span a stay or a rental get an end time too. */
const HAS_END: TripItem["category"][] = ["hotels", "cars", "flights"];

/**
 * This plan's own day-by-day schedule. Moving a piece here changes it for this
 * plan only, so Plan A and Plan B can do the same things on different days.
 */
export function ScenarioSchedule({ trip, scenario, update }: { trip: Trip; scenario: Scenario; update: (p: Partial<Scenario>) => Promise<void> | undefined }) {
  const { items } = applyScenario(trip, scenario);
  const base = new Map(trip.items.map((i) => [i.id, i]));
  const range = datesOf(items) ?? { from: trip.startDate, to: trip.endDate };
  const from = range.from < trip.startDate ? range.from : trip.startDate;
  const to = range.to > trip.endDate ? range.to : trip.endDate;
  const days: string[] = [];
  for (let d = from; d <= to && days.length < 60; d = addDays(d, 1)) days.push(d);

  const setTime = (item: TripItem, patch: ScheduleTime) => {
    const original = base.get(item.id)!;
    const next = { ...scenario.times?.[item.id], ...patch };
    // Back to the saved item's own time: drop the override.
    if ((next.start ?? original.start) === original.start) delete next.start;
    if ((next.end ?? original.end) === original.end) delete next.end;
    const times = { ...scenario.times };
    if (next.start || next.end) times[item.id] = next;
    else delete times[item.id];
    return update({ times });
  };

  const row = (item: TripItem) => {
    const moved = Boolean(scenario.times?.[item.id]);
    return (
      <div key={item.id} className={`schedule-row ${moved ? "moved" : ""}`}>
        <span className="item-icon">
          <Icon name={CATEGORY_ICON[item.category]} size={16} />
        </span>
        <span className="piece-main">
          <span className="item-title">{item.title}</span>
          <span className="muted small">
            {money(item.cost)}
            {moved && <> · <span className="tag">This plan only</span></>}
          </span>
        </span>
        <span className="schedule-times">
          <input type="datetime-local" aria-label={`${item.title} start`} value={toLocal(item.start)} onChange={(e) => e.target.value && setTime(item, { start: e.target.value })} />
          {HAS_END.includes(item.category) && (
            <input type="datetime-local" aria-label={`${item.title} end`} value={toLocal(item.end)} min={toLocal(item.start)} onChange={(e) => e.target.value && setTime(item, { end: e.target.value })} />
          )}
          {moved && (
            <button className="icon-btn" title="Back to the saved time" aria-label="Reset time" onClick={() => setTime(item, { start: base.get(item.id)!.start, end: base.get(item.id)!.end })}>
              <Icon name="x" size={14} />
            </button>
          )}
        </span>
      </div>
    );
  };

  const unscheduled = items.filter((i) => !i.start);
  return (
    <section className="card schedule">
      <div className="board-head">
        <h2>{scenario.name} · schedule</h2>
        <span className="muted small">Times you change here apply to this plan only.</span>
      </div>
      {items.length === 0 && <p className="muted small">Tick pieces above, then arrange them by day here.</p>}
      <ol className="schedule-days">
        {days.map((day, n) => {
          const todays = items.filter((i) => i.start?.slice(0, 10) === day).sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
          const sleeping = items.find((i) => i.category === "hotels" && i.start && i.end && i.start.slice(0, 10) < day && i.end.slice(0, 10) > day);
          if (!todays.length && !sleeping) return null;
          return (
            <li key={day} className="schedule-day">
              <span className="eyebrow">
                Day {n + 1} · {dayLabel(day)}
              </span>
              {todays.map(row)}
              {sleeping && !todays.some((i) => i.id === sleeping.id) && <p className="muted small">Staying at {sleeping.title}</p>}
            </li>
          );
        })}
      </ol>
      {unscheduled.length > 0 && (
        <div className="schedule-day">
          <span className="eyebrow">Not on a day yet</span>
          {unscheduled.map(row)}
        </div>
      )}
    </section>
  );
}
