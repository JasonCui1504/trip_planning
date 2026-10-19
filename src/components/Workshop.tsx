import { useMemo, useState, type FormEvent } from "react";
import type { Category, DriveLeg, Scenario, Trip, TripItem } from "../../shared/types.ts";
import { api } from "../api.ts";
import { CATEGORY_LABEL, duration, money, shortDate, time } from "../format.ts";
import { CATEGORY_ICON, Icon } from "../icons.tsx";
import { datesOf, destinationOf, driveFromRoute, FUEL_PER_KM, newScenario, scenarioTotals, suggestDrives, variantsOf, type ScenarioTotals } from "../scenario.ts";
import { ScenarioSchedule } from "./ScenarioSchedule.tsx";
import { greatCircle, MapView, type MapLine, type MapMarker } from "./MapView.tsx";
import { PointPicker, type NamedPoint } from "./PointPicker.tsx";
import type { TripActions } from "./Workspace.tsx";

export const CATEGORY_COLOR: Record<Category | "custom", string> = {
  flights: "#7fb38f",
  hotels: "#d1ad66",
  cars: "#8fb3d9",
  activities: "#c79bd4",
  dining: "#e0957a",
  custom: "#b0c8b8",
};

const SOURCE_LABEL: Record<DriveLeg["source"], string> = { osrm: "OpenStreetMap", google: "Google Maps", estimate: "Estimate" };
const GROUPS: (Category | "custom")[] = ["flights", "cars", "hotels", "activities", "dining", "custom"];

export function Workshop({ trip, actions }: { trip: Trip; actions: TripActions }) {
  const scenarios = trip.scenarios;
  const [selectedId, setSelectedId] = useState<string | null>(scenarios[0]?.id ?? null);
  const selected = scenarios.find((s) => s.id === selectedId) ?? scenarios[0];
  const totals = useMemo(() => new Map(scenarios.map((s) => [s.id, scenarioTotals(s, trip)])), [scenarios, trip]);

  const save = (next: Scenario[]) => actions.updateTrip({ scenarios: next });
  const update = (patch: Partial<Scenario>) => selected && save(scenarios.map((s) => (s.id === selected.id ? { ...s, ...patch } : s)));
  const add = (scenario: Scenario) => {
    setSelectedId(scenario.id);
    return save([...scenarios, scenario]);
  };
  const addMany = (list: Scenario[]) => {
    if (list[0]) setSelectedId(list[0].id);
    return save([...scenarios, ...list]);
  };

  const cheapest = minBy(scenarios, (s) => totals.get(s.id)!.cost);
  const quickest = minBy(scenarios.filter((s) => totals.get(s.id)!.travelMinutes > 0), (s) => totals.get(s.id)!.travelMinutes);

  if (!selected) {
    return (
      <div className="card empty workshop-empty">
        <span className="eyebrow">Workshop</span>
        <h2 className="plain-heading">Try out different combinations</h2>
        <p className="muted">
          A scenario is one way of doing the trip — e.g. <em>fly into Narita + train</em> vs. <em>fly into Haneda + rental car</em>. Pick pieces from your saved
          options, add drives, and compare total cost and travel time side by side.
        </p>
        <div className="form-actions center">
          <button className="btn btn-primary" onClick={() => add({ ...newScenario("Plan A"), itemIds: starterItems(trip) })}>
            Start with the cheapest of each
          </button>
          <button className="btn btn-ghost" onClick={() => add(newScenario("Plan A"))}>
            Blank scenario
          </button>
        </div>
        {trip.items.length === 0 && <p className="muted small">Tip: save a few flights, cars and stays from Search & save first.</p>}
      </div>
    );
  }

  return (
    <div className="workshop">
      <div className="scenario-strip">
        {scenarios.map((s) => {
          const t = totals.get(s.id)!;
          return (
            <button key={s.id} className={`card scenario-card ${s.id === selected.id ? "active" : ""}`} onClick={() => setSelectedId(s.id)}>
              <span className="scenario-card-head">
                <span className="scenario-name">{s.name}</span>
                <span className="scenario-badges">
                  {scenarios.length > 1 && s.id === cheapest?.id && <span className="tag tag-hot">Cheapest</span>}
                  {scenarios.length > 1 && s.id === quickest?.id && <span className="tag tag-hot">Quickest</span>}
                  {trip.items.some((i) => i.category === "flights") && !t.items.some((i) => i.category === "flights") && <span className="tag">No flight</span>}
                </span>
              </span>
              <span className="scenario-cost">{money(t.cost, trip.currency)}</span>
              {destinationOf(t.items) && <span className="small">→ {destinationOf(t.items)}</span>}
              <span className="muted small">
                {t.travelMinutes ? `${duration(t.travelMinutes)} travelling` : "No travel time yet"} · {t.items.length} pieces · {s.drives.length} drives
              </span>
            </button>
          );
        })}
        <div className="scenario-new">
          <button className="btn btn-secondary" onClick={() => add(newScenario(`Plan ${String.fromCharCode(65 + scenarios.length)}`))}>
            <Icon name="plus" size={14} /> New
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => add({ ...selected, id: crypto.randomUUID(), name: `${selected.name} (copy)`, drives: selected.drives.map((d) => ({ ...d, id: crypto.randomUUID() })), createdAt: new Date().toISOString() })}
          >
            Duplicate
          </button>
          {trip.items.filter((i) => i.category === "flights").length > 1 && (
            <button className="btn btn-ghost" title="Copies this plan once per saved flight, to compare flights and destinations side by side" onClick={() => addMany(variantsOf(selected, trip, "flights"))}>
              A plan per flight
            </button>
          )}
          {trip.items.filter((i) => i.category === "hotels").length > 1 && (
            <button className="btn btn-ghost" title="Copies this plan once per saved stay" onClick={() => addMany(variantsOf(selected, trip, "hotels"))}>
              A plan per stay
            </button>
          )}
        </div>
      </div>

      {scenarios.length > 1 && <CompareTable scenarios={scenarios} totals={totals} trip={trip} />}

      <div className="workshop-grid">
        <ScenarioEditor key={selected.id} trip={trip} scenario={selected} totals={totals.get(selected.id)!} update={update} onDelete={() => save(scenarios.filter((s) => s.id !== selected.id))} onExport={() => actions.exportPlan(selected.id)} />
        <ScenarioMap scenario={selected} totals={totals.get(selected.id)!} trip={trip} />
      </div>

      <ScenarioSchedule key={`schedule-${selected.id}`} trip={trip} scenario={selected} update={update} />
    </div>
  );
}

/** One flight, stay and car (the cheapest saved of each) plus every activity and meal. */
function starterItems(trip: Trip): string[] {
  const candidates = trip.items.filter((i) => i.status !== "idea");
  const ids: string[] = [];
  for (const cat of GROUPS) {
    const items = candidates.filter((i) => i.category === cat);
    if (cat === "flights" || cat === "hotels" || cat === "cars") {
      const pick = items.find((i) => i.status === "booked") ?? minBy(items, (i) => i.cost.amount);
      if (pick) ids.push(pick.id);
    } else ids.push(...items.map((i) => i.id));
  }
  return ids;
}

function minBy<T>(list: T[], f: (x: T) => number): T | undefined {
  return list.reduce<T | undefined>((best, x) => (best === undefined || f(x) < f(best) ? x : best), undefined);
}

function CompareTable({ scenarios, totals, trip }: { scenarios: Scenario[]; totals: Map<string, ScenarioTotals>; trip: Trip }) {
  const rows: { label: string; value: (t: ScenarioTotals) => number; format: (n: number) => string; lowerIsBetter?: boolean }[] = [
    { label: "Total cost", value: (t) => t.cost, format: (n) => money(n, trip.currency), lowerIsBetter: true },
    { label: "Per person", value: (t) => t.cost / trip.travelers, format: (n) => money(n, trip.currency), lowerIsBetter: true },
    { label: "Travel time", value: (t) => t.travelMinutes, format: (n) => (n ? duration(n) : "—"), lowerIsBetter: true },
    { label: "In the air", value: (t) => t.flightMinutes, format: (n) => (n ? duration(n) : "—") },
    { label: "On the road", value: (t) => t.driveMinutes, format: (n) => (n ? duration(n) : "—") },
    { label: "Driving distance", value: (t) => t.driveKm, format: (n) => (n ? `${Math.round(n).toLocaleString()} km` : "—") },
    { label: "Est. fuel", value: (t) => t.fuelCost, format: (n) => money(n, trip.currency) },
  ];
  return (
    <div className="card table-scroll">
      <h2>Compare scenarios</h2>
      <table className="compare-table">
        <thead>
          <tr>
            <th />
            {scenarios.map((s) => (
              <th key={s.id}>{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Goes to</th>
            {scenarios.map((s) => (
              <td key={s.id}>{destinationOf(totals.get(s.id)!.items) || "—"}</td>
            ))}
          </tr>
          <tr>
            <th>Dates</th>
            {scenarios.map((s) => {
              const d = datesOf(totals.get(s.id)!.items);
              return <td key={s.id}>{d ? (d.from === d.to ? shortDate(d.from) : `${shortDate(d.from)} – ${shortDate(d.to)}`) : "—"}</td>;
            })}
          </tr>
          {rows.map((row) => {
            const values = scenarios.map((s) => row.value(totals.get(s.id)!));
            const best = row.lowerIsBetter ? Math.min(...values.filter((v) => v > 0)) : NaN;
            return (
              <tr key={row.label}>
                <th>{row.label}</th>
                {values.map((v, i) => (
                  <td key={scenarios[i].id} className={v === best && values.filter((x) => x > 0).length > 1 ? "best" : ""}>
                    {row.format(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScenarioEditor({ trip, scenario, totals, update, onDelete, onExport }: { trip: Trip; scenario: Scenario; totals: ScenarioTotals; update: (p: Partial<Scenario>) => Promise<void> | undefined; onDelete: () => void; onExport: () => void }) {
  const [name, setName] = useState(scenario.name);
  const [from, setFrom] = useState<NamedPoint | null>(null);
  const [to, setTo] = useState<NamedPoint | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const included = new Set(scenario.itemIds);
  const toggle = (item: TripItem) => update({ itemIds: included.has(item.id) ? scenario.itemIds.filter((id) => id !== item.id) : [...scenario.itemIds, item.id] });

  // Places worth driving between: everything with a location on the trip, plus earlier drive ends.
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: NamedPoint[] = [];
    const push = (p: NamedPoint) => {
      const key = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
      if (!seen.has(key)) seen.add(key), out.push(p);
    };
    for (const item of trip.items) for (const p of item.points ?? []) push({ lat: p.lat, lon: p.lon, label: p.label ?? item.title, detail: CATEGORY_LABEL[item.category] });
    for (const d of scenario.drives) [d.from, d.to].forEach((p) => push({ ...p, detail: "Used in a drive" }));
    return out;
  }, [trip.items, scenario.drives]);

  const addDrives = async (pairs: { from: NamedPoint; to: NamedPoint }[]) => {
    setError("");
    try {
      const legs: DriveLeg[] = [];
      for (const pair of pairs) {
        setBusy(`Routing ${pair.from.label} → ${pair.to.label}…`);
        legs.push(driveFromRoute(pair.from, pair.to, await api.route([pair.from, pair.to])));
      }
      await update({ drives: [...scenario.drives, ...legs] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const submitDrive = async (e: FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setError("Pick both a start and an end point from the suggestions.");
    await addDrives([{ from, to }]);
    setFrom(null);
    setTo(null);
  };

  const suggested = suggestDrives(scenario, trip);

  return (
    <section className="card scenario-editor">
      <div className="board-head">
        <input
          className="scenario-title-input"
          value={name}
          aria-label="Scenario name"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== scenario.name && update({ name: name.trim() })}
        />
        <button className="btn btn-secondary btn-sm" onClick={onExport} title="Send this plan, with its own schedule, to your travel budget at jascui.com">
          <Icon name="external" size={14} /> Export this plan
        </button>
        <button className="icon-btn" aria-label="Delete scenario" title="Delete scenario" onClick={() => confirm(`Delete "${scenario.name}"?`) && onDelete()}>
          <Icon name="trash" size={16} />
        </button>
      </div>

      <h2>Pieces</h2>
      {trip.items.length === 0 && <p className="muted small">Nothing saved yet. Save flights, cars and stays from Search & save, then mix and match them here.</p>}
      {GROUPS.map((cat) => {
        const items = trip.items.filter((i) => i.category === cat);
        if (!items.length) return null;
        const picked = items.filter((i) => included.has(i.id)).length;
        return (
          <div key={cat} className="piece-group">
            <span className="eyebrow">
              <Icon name={CATEGORY_ICON[cat]} size={12} /> {CATEGORY_LABEL[cat]}
            </span>
            {picked > 1 && (cat === "flights" || cat === "hotels" || cat === "cars") && (
              <p className="warn small piece-warn">{picked} {CATEGORY_LABEL[cat].toLowerCase()} ticked — all of them count toward this scenario's totals.</p>
            )}
            {items.map((item) => (
              <label key={item.id} className={`piece ${included.has(item.id) ? "on" : ""}`}>
                <input type="checkbox" checked={included.has(item.id)} onChange={() => toggle(item)} />
                <span className="piece-main">
                  <span className="item-title">{item.title}</span>
                  <span className="muted small">
                    {item.start ? `${shortDate(item.start)} ${time(item.start)} · ` : ""}
                    {item.subtitle}
                  </span>
                </span>
                <span className="piece-side">
                  <span className="item-cost">{money(item.cost)}</span>
                  {item.durationMinutes ? <span className="muted small">{duration(item.durationMinutes)}</span> : null}
                </span>
              </label>
            ))}
          </div>
        );
      })}

      <h2 className="spaced">Drives</h2>
      {scenario.drives.length === 0 && <p className="muted small">Add the drives this plan needs — airport to hotel, day trips, one-way road trips — to see real driving times.</p>}
      <ul className="drives">
        {scenario.drives.map((d) => (
          <li key={d.id} className="drive">
            <span className="item-icon">
              <Icon name="car" size={16} />
            </span>
            <span className="piece-main">
              <span className="item-title">
                {d.from.label} → {d.to.label}
              </span>
              <span className="muted small">
                {duration(d.durationMinutes)} · {d.distanceKm.toLocaleString()} km · ~{money(d.distanceKm * FUEL_PER_KM, trip.currency)} fuel ·{" "}
                <span className={d.source === "estimate" ? "warn" : ""}>{SOURCE_LABEL[d.source]}</span>
              </span>
            </span>
            <button className="icon-btn" aria-label="Remove drive" onClick={() => update({ drives: scenario.drives.filter((x) => x.id !== d.id) })}>
              <Icon name="x" size={14} />
            </button>
          </li>
        ))}
      </ul>

      {suggested.length > 0 && (
        <div className="suggest">
          <span className="small">
            <Icon name="sparkle" size={14} /> {suggested.length} transfer{suggested.length === 1 ? "" : "s"} missing between your stops:{" "}
            {suggested.slice(0, 3).map((s) => `${s.from.label} → ${s.to.label}`).join("; ")}
            {suggested.length > 3 ? "…" : ""}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={Boolean(busy)} onClick={() => addDrives(suggested)}>
            Add {suggested.length === 1 ? "it" : "all"}
          </button>
        </div>
      )}

      <form className="drive-form" onSubmit={submitDrive}>
        <PointPicker label="From" value={from} onChange={setFrom} suggestions={suggestions} />
        <PointPicker label="To" value={to} onChange={setTo} suggestions={suggestions} />
        <button className="btn btn-primary" disabled={Boolean(busy)}>
          {busy ? "Routing…" : "Add drive"}
        </button>
      </form>
      {busy && <p className="muted small">{busy}</p>}
      {error && <p className="error small">{error}</p>}

      <label className="spaced">
        Notes
        <textarea rows={2} defaultValue={scenario.notes} onBlur={(e) => e.target.value !== scenario.notes && update({ notes: e.target.value })} placeholder="Trade-offs, things to check…" />
      </label>
      {totals.items.length === 0 && scenario.drives.length === 0 && <p className="muted small">Tick pieces above to build this scenario.</p>}
    </section>
  );
}

function ScenarioMap({ scenario, totals, trip }: { scenario: Scenario; totals: ScenarioTotals; trip: Trip }) {
  const [view, setView] = useState<"trip" | "ground">("ground");
  const { markers, lines, ground } = useMemo(() => {
    const markers: MapMarker[] = [];
    const lines: MapLine[] = [];
    // Everything except the far end of flights: the part of the trip you drive around in.
    const ground: [number, number][] = [];
    for (const item of totals.items) {
      const pts = item.points ?? [];
      const color = CATEGORY_COLOR[item.category];
      pts.forEach((p) => markers.push({ lat: p.lat, lon: p.lon, label: p.label ?? item.title, color }));
      if (item.category === "flights") pts.slice(1).forEach((p) => ground.push([p.lat, p.lon]));
      else pts.forEach((p) => ground.push([p.lat, p.lon]));
      if (item.category === "flights" && pts.length >= 2) lines.push({ path: greatCircle(pts[0], pts[1]), color, dashed: true, label: item.title });
    }
    for (const d of scenario.drives) {
      lines.push({ path: d.geometry.length > 1 ? d.geometry : [[d.from.lat, d.from.lon], [d.to.lat, d.to.lon]], color: CATEGORY_COLOR.cars, label: `${d.from.label} → ${d.to.label} · ${duration(d.durationMinutes)}` });
      markers.push({ ...d.from, color: CATEGORY_COLOR.cars }, { ...d.to, color: CATEGORY_COLOR.cars });
      ground.push(...(d.geometry.length ? d.geometry : [[d.from.lat, d.from.lon] as [number, number], [d.to.lat, d.to.lon] as [number, number]]));
    }
    return { markers, lines, ground };
  }, [scenario, totals]);

  return (
    <aside className="workshop-side">
      <div className="card totals">
        <h2>{scenario.name} · totals</h2>
        <div className="totals-grid">
          <div>
            <span className="stat-label">Total cost</span>
            <span className="stat-value">{money(totals.cost, trip.currency)}</span>
            <span className="muted small">{money(totals.cost / trip.travelers, trip.currency)} per person</span>
          </div>
          <div>
            <span className="stat-label">Travel time</span>
            <span className="stat-value">{totals.travelMinutes ? duration(totals.travelMinutes) : "—"}</span>
            <span className="muted small">
              {duration(totals.flightMinutes)} flying · {duration(totals.driveMinutes)} driving
            </span>
          </div>
        </div>
        <dl className="breakdown small">
          {GROUPS.map((cat) => {
            const sum = totals.items.filter((i) => i.category === cat).reduce((s, i) => s + i.cost.amount, 0);
            return sum ? (
              <div key={cat}>
                <dt>{CATEGORY_LABEL[cat]}</dt>
                <dd>{money(sum, trip.currency)}</dd>
              </div>
            ) : null;
          })}
          {totals.fuelCost > 0 && (
            <div>
              <dt>Fuel (est. {Math.round(totals.driveKm).toLocaleString()} km)</dt>
              <dd>{money(totals.fuelCost, trip.currency)}</dd>
            </div>
          )}
          {trip.budget > 0 && (
            <div className={totals.cost > trip.budget ? "over" : ""}>
              <dt>vs. budget {money(trip.budget, trip.currency)}</dt>
              <dd>{totals.cost > trip.budget ? `${money(totals.cost - trip.budget, trip.currency)} over` : `${money(trip.budget - totals.cost, trip.currency)} left`}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="card map-card">
        {markers.length || lines.length ? (
          <>
            <div className="chips map-toggle">
              <button className={`chip ${view === "ground" ? "active" : ""}`} onClick={() => setView("ground")}>
                On the ground
              </button>
              <button className={`chip ${view === "trip" ? "active" : ""}`} onClick={() => setView("trip")}>
                Whole trip
              </button>
            </div>
            <MapView markers={markers} lines={lines} focus={view === "ground" && ground.length ? ground : undefined} />
          </>
        ) : (
          <p className="muted small empty">Pieces with a location and drives appear on the map.</p>
        )}
        <div className="legend small">
          {(["flights", "hotels", "cars", "activities", "dining"] as const).map((c) => (
            <span key={c}>
              <i className="swatch" style={{ background: CATEGORY_COLOR[c], borderRadius: "50%" }} /> {CATEGORY_LABEL[c]}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
