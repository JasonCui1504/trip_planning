import { useEffect, useState, type FormEvent } from "react";
import { gridCells, type PriceGrid } from "../../shared/types.ts";
import { api } from "../api.ts";
import { addDays, money, shortDate, today } from "../format.ts";
import { Icon } from "../icons.tsx";
import { href, navigate } from "../router.ts";
import { GridView } from "./GridView.tsx";
import { Modal } from "./Modal.tsx";

export const TRACK_LABEL: Record<number, string> = { 0: "Only when I press Check", 1: "Every day", 2: "Every 2 days", 3: "Every 3 days", 7: "Every week" };

/** Cheapest price anywhere in the grid right now, and where. */
export function bestCell(grid: PriceGrid) {
  let best: { key: string; low: number } | null = null;
  for (const s of gridCells(grid)) {
    const low = grid.cells[s.key]?.history.at(-1)?.low;
    if (low !== undefined && (!best || low < best.low)) best = { key: s.key, low };
  }
  return best;
}

/** The Prices dashboard: grids of routes or hotel areas × dates, compared and tracked. */
export function Prices({ id }: { id?: string }) {
  if (id) return <GridView key={id} id={id} />;
  return <GridList />;
}

function GridList() {
  const [grids, setGrids] = useState<PriceGrid[] | null>(null);
  const [creating, setCreating] = useState<PriceGrid["kind"] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.grids().then(setGrids).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="home">
      <section>
        <span className="eyebrow">Prices</span>
        <h1>Compare and track prices</h1>
        <p className="muted">
          Set up a grid once, e.g. BWI and DCA to SFO and SJC across a few dates, or three neighbourhoods across two weekends, and see every combination's
          cheapest price in one table. Check it whenever you like, or let it re-check on a schedule and watch the prices move.
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
      <section className="grid-list">
        {grids?.length === 0 && <p className="muted">No grids yet.</p>}
        {grids?.map((g) => {
          const best = bestCell(g);
          const cells = gridCells(g).length;
          return (
            <a key={g.id} className="card grid-card" href={href({ page: "prices", id: g.id })}>
              <span className="eyebrow">
                <Icon name={g.kind === "flights" ? "plane" : "bed"} size={12} /> {g.kind === "flights" ? "Flights" : "Hotels.com"}
              </span>
              <span className="trip-card-name">{g.name}</span>
              <span className="muted small">
                {g.kind === "flights" ? `${g.origins.join(", ")} → ${g.destinations.join(", ")}` : g.destinations.join(" · ")}
              </span>
              <span className="muted small">
                {g.dates.length} date{g.dates.length === 1 ? "" : "s"} · {cells} searches per check · {TRACK_LABEL[g.trackEveryDays]}
              </span>
              {best && <span className="grid-card-best">From {money(best.low)}</span>}
            </a>
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
      <span className="field-label">{label}</span>
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
  const [dates, setDates] = useState<string[]>(initial?.dates ?? []);
  const [nights, setNights] = useState(initial?.nights ?? (flights ? 0 : 2));
  const [travelers, setTravelers] = useState(initial?.travelers ?? (flights ? 1 : 2));
  const [rooms, setRooms] = useState(initial?.rooms ?? 1);
  const [cabin, setCabin] = useState<PriceGrid["cabin"]>(initial?.cabin ?? "economy");
  const [trackEveryDays, setTrack] = useState(initial?.trackEveryDays ?? 0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const split = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean);
  const originList = split(origins, /[,\s]+/);
  const destList = flights ? split(destinations, /[,\s]+/) : split(destinations, /\n/);
  const searches = (flights ? originList.length : 1) * destList.length * dates.length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit({ kind, name, origins: originList, destinations: destList, dates, nights, travelers, rooms, cabin, trackEveryDays });
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
            <input value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder="BWI, DCA" required />
          </label>
          <label>
            To (airport codes)
            <input value={destinations} onChange={(e) => setDestinations(e.target.value)} placeholder="SFO, SJC" required />
          </label>
        </>
      ) : (
        <label className="span-2">
          Places to compare, one per line
          <textarea rows={3} value={destinations} onChange={(e) => setDestinations(e.target.value)} placeholder={"Shinjuku, Tokyo\nShibuya, Tokyo\nAsakusa, Tokyo"} required />
        </label>
      )}
      <DatePicker dates={dates} onChange={setDates} label={flights ? "Departure dates" : "Check-in dates"} />
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
      <label>
        Re-check prices
        <select value={trackEveryDays} onChange={(e) => setTrack(Number(e.target.value))}>
          {Object.entries(TRACK_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <p className={`small span-2 ${searches > 40 ? "error" : "muted"}`}>
        {searches} search{searches === 1 ? "" : "es"} per check
        {flights ? " (SerpApi: 250 free a month)" : " (Hotels.com via RapidAPI: about 1–2 requests each)"}
        {trackEveryDays > 0 && searches > 0 && ` · about ${Math.round((searches * 30) / trackEveryDays)} a month when tracked ${TRACK_LABEL[trackEveryDays].toLowerCase()}`}
        {searches > 40 && " · keep it to 40 or fewer"}
      </p>
      {error && <p className="error span-2">{error}</p>}
      <div className="form-actions span-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy || !dates.length || !destList.length || (flights && !originList.length)}>
          {busy ? "Saving…" : initial ? "Save changes" : "Create grid"}
        </button>
      </div>
    </form>
  );
}
