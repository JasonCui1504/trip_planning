import { useEffect, useState, type FormEvent } from "react";
import { gridCells, repeatDates, type PriceGrid } from "../../shared/types.ts";
import { api } from "../api.ts";
import { addDays, money, shortDate, today } from "../format.ts";
import { Icon } from "../icons.tsx";
import { href, navigate } from "../router.ts";
import { GridView } from "./GridView.tsx";
import { Modal } from "./Modal.tsx";

/** Cheapest price anywhere in the grid right now, and where. */
export function bestCell(grid: PriceGrid) {
  let best: { key: string; low: number } | null = null;
  for (const s of gridCells(grid)) {
    const low = grid.cells[s.key]?.history.at(-1)?.low;
    if (low !== undefined && (!best || low < best.low)) best = { key: s.key, low };
  }
  return best;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 0 → "12 AM", 17 → "5 PM", 24 → "midnight". */
export function hourLabel(h: number): string {
  if (h === 0 || h === 24) return h ? "midnight" : "12 AM";
  if (h === 12) return "noon";
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
}

/** "Every Thu · next 12 weeks", or "3 dates". */
export function scheduleLabel(grid: Pick<PriceGrid, "repeat" | "dates">): string {
  if (grid.repeat) return `Every ${grid.repeat.weekdays.map((d) => WEEKDAYS[d]).join(" & ")} · next ${grid.repeat.weeks} week${grid.repeat.weeks === 1 ? "" : "s"}`;
  return `${grid.dates.length} date${grid.dates.length === 1 ? "" : "s"}`;
}

/** "leaving 5 PM–midnight", or "" for any time. */
export function windowLabel(window?: [number, number]): string {
  return window ? `leaving ${hourLabel(window[0])}–${hourLabel(window[1])}` : "";
}

/** The Prices dashboard: grids of routes or hotel areas × dates, compared and tracked. */
export function Prices({ id }: { id?: string }) {
  if (id) return <GridView key={id} id={id} />;
  return <GridList />;
}

const EXPANDED_KEY = "tw:prices-expanded";

/** Which grids are expanded on the list, remembered in this browser. */
function useExpanded() {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const save = (next: Set<string>) => {
    setExpanded(next);
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
    } catch {
      // Private mode or storage blocked: it just won't be remembered.
    }
  };
  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save(next);
  };
  return { expanded, toggle, setAll: (ids: string[]) => save(new Set(ids)) };
}

function GridList() {
  const [grids, setGrids] = useState<PriceGrid[] | null>(null);
  const [creating, setCreating] = useState<PriceGrid["kind"] | null>(null);
  const [error, setError] = useState("");
  const { expanded, toggle, setAll } = useExpanded();
  const allExpanded = Boolean(grids?.length) && grids!.every((g) => expanded.has(g.id));

  useEffect(() => {
    api.grids().then(setGrids).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="home">
      <section>
        <span className="eyebrow">Prices</span>
        <h1>Compare and track prices</h1>
        <p className="muted">
          Set up a grid for each route you care about, e.g. DC (IAD, DCA, BWI) to the Bay Area (SFO, OAK, SJC) every Thursday after 5 PM for the next 12 weeks,
          and see each day's cheapest price in one row. Press Check every few days; each cell shows how its price moved since the last check. Make as many grids as
          you like, one per route.
        </p>
        <div className="form-actions start">
          <button className="btn btn-primary" onClick={() => setCreating("flights")}>
            <Icon name="plane" size={16} /> New flight grid
          </button>
          <button className="btn btn-secondary" onClick={() => setCreating("hotels")}>
            <Icon name="bed" size={16} /> New hotel grid
          </button>
        </div>
      </section>
      {error && <p className="error">{error}</p>}
      {grids && grids.length > 0 && (
        <div className="grid-list-tools">
          <button className="btn btn-ghost btn-sm" onClick={() => setAll(allExpanded ? [] : grids.map((g) => g.id))}>
            <Icon name="chevronDown" size={14} className={allExpanded ? "flip" : ""} /> {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}
      <section className="grid-list">
        {grids?.length === 0 && <p className="muted">No grids yet.</p>}
        {grids?.map((g) => {
          if (expanded.has(g.id))
            return (
              // A single route (dates down the page) only needs half the width; wider grids take a full row.
              <div key={g.id} className={new Set(gridCells(g).map((c) => c.row)).size === 1 ? "grid-list-half" : "grid-list-wide"}>
                <GridView id={g.id} initial={g} embedded onCollapse={() => {
                    toggle(g.id);
                    api.grids().then(setGrids).catch(() => {});
                  }} onDeleted={() => setGrids(grids.filter((x) => x.id !== g.id))} />
              </div>
            );
          const best = bestCell(g);
          const cells = gridCells(g).length;
          return (
            <div key={g.id} className="card grid-card">
              <span className="grid-card-top">
                <span className="eyebrow">
                  <Icon name={g.kind === "flights" ? "plane" : "bed"} size={12} /> {g.kind === "flights" ? "Flights" : "Hotels.com"}
                </span>
                <button className="icon-btn" aria-label={`Expand ${g.name}`} title="Show the table here" aria-expanded="false" onClick={() => toggle(g.id)}>
                  <Icon name="chevronDown" size={16} />
                </button>
              </span>
              <a className="trip-card-name grid-card-link" href={href({ page: "prices", id: g.id })}>
                {g.name}
              </a>
              <span className="muted small">
                {g.kind === "flights" ? `${g.origins.join(g.combineAirports ? "/" : ", ")} → ${g.destinations.join(g.combineAirports ? "/" : ", ")}` : g.destinations.join(" · ")}
              </span>
              <span className="muted small">
                {[scheduleLabel(g), g.kind === "flights" ? windowLabel(g.departWindow) : "", `${cells} searches per check`].filter(Boolean).join(" · ")}
              </span>
              {best && <span className="grid-card-best">From {money(best.low)}</span>}
            </div>
          );
        })}
      </section>
      {creating && (
        <Modal title={creating === "flights" ? "New flight grid" : "New hotel grid"} onClose={() => setCreating(null)} wide>
          <GridForm
            kind={creating}
            onSubmit={async (input) => {
              const grid = await api.createGrid(input);
              navigate({ page: "prices", id: grid.id });
            }}
            onCancel={() => setCreating(null)}
          />
        </Modal>
      )}
    </div>
  );
}

/** Dates as removable chips, added one at a time or as a run of consecutive days. */
function DatePicker({ dates, onChange, label }: { dates: string[]; onChange: (d: string[]) => void; label: string }) {
  const [day, setDay] = useState(addDays(today(), 30));
  const [count, setCount] = useState(1);
  const add = () => {
    const next = new Set(dates);
    for (let i = 0; i < count; i++) next.add(addDays(day, i));
    onChange([...next].sort());
  };
  return (
    <div className="span-2 date-picker">
      {label && <span className="field-label">{label}</span>}
      <div className="date-picker-row">
        <input type="date" value={day} min={today()} onChange={(e) => setDay(e.target.value)} aria-label="Date to add" />
        <label className="inline">
          <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} aria-label="Days in a row" />
          day{count === 1 ? "" : "s"} in a row
        </label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
      <div className="chips">
        {dates.length === 0 && <span className="muted small">No dates yet.</span>}
        {dates.map((d) => (
          <button type="button" key={d} className="chip active" onClick={() => onChange(dates.filter((x) => x !== d))} title="Remove">
            {shortDate(d)} <Icon name="x" size={12} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function GridForm({ kind, initial, onSubmit, onCancel }: { kind: PriceGrid["kind"]; initial?: PriceGrid; onSubmit: (g: Partial<PriceGrid>) => Promise<void>; onCancel: () => void }) {
  const flights = kind === "flights";
  const [name, setName] = useState(initial?.name ?? "");
  const [origins, setOrigins] = useState(initial?.origins.join(", ") ?? "");
  // Hotel locations can contain commas ("Shinjuku, Tokyo"), so they're one per line.
  const [destinations, setDestinations] = useState(initial?.destinations.join(flights ? ", " : "\n") ?? "");
  const [dates, setDates] = useState<string[]>(initial && !initial.repeat ? initial.dates : []);
  const [dateMode, setDateMode] = useState<"repeat" | "pick">(initial && !initial.repeat ? "pick" : "repeat");
  const [weekdays, setWeekdays] = useState<number[]>(initial?.repeat?.weekdays ?? [4]);
  const [weeks, setWeeks] = useState(initial?.repeat?.weeks ?? 12);
  const [departFrom, setDepartFrom] = useState(initial?.departWindow?.[0] ?? 0);
  const [departTo, setDepartTo] = useState(initial?.departWindow?.[1] ?? 24);
  // New grids search all the airports together (one search per date); older grids keep one row per airport pair.
  const [combine, setCombine] = useState(initial ? Boolean(initial.combineAirports) : true);
  const [nights, setNights] = useState(initial?.nights ?? (flights ? 0 : 2));
  const [travelers, setTravelers] = useState(initial?.travelers ?? (flights ? 1 : 2));
  const [rooms, setRooms] = useState(initial?.rooms ?? 1);
  const [cabin, setCabin] = useState<PriceGrid["cabin"]>(initial?.cabin ?? "economy");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const split = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean);
  const originList = split(origins, /[,\s]+/);
  const destList = flights ? split(destinations, /[,\s]+/) : split(destinations, /\n/);
  const dateCount = dateMode === "repeat" ? repeatDates({ weekdays, weeks }, today()).length : dates.length;
  const rowCount = flights ? (combine ? Math.min(1, originList.length * destList.length) : originList.length * destList.length) : destList.length;
  const searches = rowCount * dateCount;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const repeat = dateMode === "repeat" ? { weekdays, weeks } : null;
      await onSubmit({
        kind,
        name,
        origins: originList,
        destinations: destList,
        dates: repeat ? [] : dates,
        // null switches an edited grid back to picked dates.
        repeat: repeat as PriceGrid["repeat"],
        nights,
        travelers,
        rooms,
        cabin,
        ...(flights && { departWindow: [departFrom, departTo] as [number, number], combineAirports: combine }),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="span-2">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={flights ? "e.g. DC to the Bay Area, spring" : "e.g. Tokyo neighbourhoods"} />
      </label>
      {flights ? (
        <>
          <label>
            From (airport codes)
            <input value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder="IAD, DCA, BWI" required />
          </label>
          <label>
            To (airport codes)
            <input value={destinations} onChange={(e) => setDestinations(e.target.value)} placeholder="SFO, OAK, SJC" required />
          </label>
          <label className="check-row span-2">
            <input type="checkbox" checked={combine} onChange={(e) => setCombine(e.target.checked)} />
            <span>
              Search these airports together: one search per date finds the cheapest flight from any of them to any of them.
              <span className="muted small block">Turn off to compare each airport pair in its own row (one search per pair per date).</span>
            </span>
          </label>
        </>
      ) : (
        <label className="span-2">
          Places to compare, one per line
          <textarea rows={3} value={destinations} onChange={(e) => setDestinations(e.target.value)} placeholder={"Shinjuku, Tokyo\nShibuya, Tokyo\nAsakusa, Tokyo"} required />
        </label>
      )}
      <div className="span-2">
        <span className="field-label">{flights ? "Departure dates" : "Check-in dates"}</span>
        <div className="mode-toggle">
          <button type="button" className={`chip ${dateMode === "repeat" ? "active" : ""}`} onClick={() => setDateMode("repeat")}>
            Repeat weekly
          </button>
          <button type="button" className={`chip ${dateMode === "pick" ? "active" : ""}`} onClick={() => setDateMode("pick")}>
            Pick dates
          </button>
        </div>
        {dateMode === "repeat" ? (
          <>
            <div className="weekday-chips">
              {WEEKDAYS.map((label, d) => (
                <button
                  type="button"
                  key={label}
                  className={`chip ${weekdays.includes(d) ? "active" : ""}`}
                  aria-pressed={weekdays.includes(d)}
                  onClick={() => setWeekdays(weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d].sort())}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="inline repeat-row">
              For the next
              <input type="number" min={1} max={26} value={weeks} onChange={(e) => setWeeks(Math.max(1, Math.min(26, Number(e.target.value) || 1)))} aria-label="Weeks ahead" />
              weeks
              <span className="muted small">
                ({dateCount} date{dateCount === 1 ? "" : "s"}, counted from the day you check, so past days drop off and new ones are added)
              </span>
            </label>
          </>
        ) : (
          <DatePicker dates={dates} onChange={setDates} label="" />
        )}
      </div>
      {flights && (
        <>
          <label>
            Leave after
            <select value={departFrom} onChange={(e) => setDepartFrom(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h} disabled={h >= departTo}>
                  {h === 0 ? "Any time" : hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Leave before
            <select value={departTo} onChange={(e) => setDepartTo(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h} disabled={h <= departFrom}>
                  {h === 24 ? "Any time (midnight)" : hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {flights ? (
        <>
          <label>
            Return
            <select value={nights} onChange={(e) => setNights(Number(e.target.value))}>
              <option value={0}>One way</option>
              {Array.from({ length: 21 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} day{n === 1 ? "" : "s"} later
                </option>
              ))}
            </select>
          </label>
          <label>
            Cabin
            <select value={cabin} onChange={(e) => setCabin(e.target.value as PriceGrid["cabin"])}>
              <option value="economy">Economy</option>
              <option value="premium">Premium</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </label>
          <label>
            Adults
            <input type="number" min={1} max={9} value={travelers} onChange={(e) => setTravelers(Number(e.target.value))} />
          </label>
        </>
      ) : (
        <>
          <label>
            Nights
            <input type="number" min={1} max={30} value={nights} onChange={(e) => setNights(Number(e.target.value))} />
          </label>
          <label>
            Guests
            <input type="number" min={1} max={9} value={travelers} onChange={(e) => setTravelers(Number(e.target.value))} />
          </label>
          <label>
            Rooms
            <input type="number" min={1} max={8} value={rooms} onChange={(e) => setRooms(Number(e.target.value))} />
          </label>
        </>
      )}
      <p className={`small span-2 ${searches > 40 ? "error" : "muted"}`}>
        {searches} search{searches === 1 ? "" : "es"} per check
        {flights ? ` · about ${searches * 10} a month if you check every 3 days (SerpApi's free plan has 250 a month, shared by all your grids)` : " (Hotels.com via RapidAPI: about 1–2 requests each)"}
        {searches > 40 && " · keep it to 40 or fewer"}
      </p>
      {error && <p className="error span-2">{error}</p>}
      <div className="form-actions span-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy || !dateCount || !destList.length || (flights && !originList.length)}>
          {busy ? "Saving…" : initial ? "Save changes" : "Create grid"}
        </button>
      </div>
    </form>
  );
}
