import { useEffect, useMemo, useState } from "react";
import { gridCells, type GridCell, type GridCellSpec, type PriceGrid } from "../../shared/types.ts";
import { api } from "../api.ts";
import { addDays, duration, money, shortDate, today } from "../format.ts";
import { Icon } from "../icons.tsx";
import { href, navigate } from "../router.ts";
import { Modal } from "./Modal.tsx";
import { PriceChart } from "./PriceChart.tsx";
import { bestCell, GridForm, TRACK_LABEL } from "./Prices.tsx";

const BATCH = 3;

const latest = (cell?: GridCell) => cell?.history.at(-1);
const previous = (cell?: GridCell) => cell?.history.at(-2);
const weekday = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });

export function GridView({ id }: { id: string }) {
  const [grid, setGrid] = useState<PriceGrid | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api.grid(id).then(setGrid).catch((e) => setError(e.message));
  }, [id]);

  const specs = useMemo(() => (grid ? gridCells(grid) : []), [grid]);
  const rows = useMemo(() => [...new Set(specs.map((s) => s.row))], [specs]);
  const upcoming = specs.filter((s) => s.date >= today());
  const due = upcoming.filter((s) => latest(grid?.cells[s.key])?.date !== today());

  // Heat scale across the whole grid: cheapest green, priciest neutral.
  const lows = specs.map((s) => latest(grid?.cells[s.key])?.low).filter((v): v is number => v !== undefined);
  const lo = Math.min(...lows);
  const hi = Math.max(...lows);
  const best = grid ? bestCell(grid) : null;

  if (error && !grid) return <p className="error">{error}</p>;
  if (!grid) return <p className="muted empty">Loading…</p>;

  const check = async (list: GridCellSpec[]) => {
    setError("");
    setProgress({ done: 0, total: list.length });
    try {
      for (let i = 0; i < list.length; i += BATCH) {
        const batch = list.slice(i, i + BATCH);
        setGrid(await api.checkGrid(grid.id, batch.map((s) => s.key)));
        setProgress({ done: Math.min(list.length, i + BATCH), total: list.length });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const spec = specs.find((s) => s.key === selected);
  const rowBest = (row: string) => Math.min(...specs.filter((s) => s.row === row).map((s) => latest(grid.cells[s.key])?.low ?? Infinity));
  const dateBest = (date: string) => Math.min(...specs.filter((s) => s.date === date).map((s) => latest(grid.cells[s.key])?.low ?? Infinity));
  const flights = grid.kind === "flights";

  return (
    <div className="home grid-view">
      <section className="grid-head">
        <div>
          <a className="back-link" href={href({ page: "prices" })}>
            <Icon name="arrowLeft" size={14} /> All grids
          </a>
          <h1>{grid.name}</h1>
          <p className="muted">
            {flights
              ? `${grid.nights ? `Round trip, back ${grid.nights} day${grid.nights === 1 ? "" : "s"} later` : "One way"} · ${grid.travelers} adult${grid.travelers === 1 ? "" : "s"} · ${grid.cabin}`
              : `Hotels.com · ${grid.nights} night${grid.nights === 1 ? "" : "s"} · ${grid.travelers} guest${grid.travelers === 1 ? "" : "s"}, ${grid.rooms} room${grid.rooms === 1 ? "" : "s"}`}{" "}
            · Re-check: {TRACK_LABEL[grid.trackEveryDays].toLowerCase()}
          </p>
        </div>
        <div className="grid-actions">
          <button className="btn btn-primary" disabled={Boolean(progress) || !due.length} onClick={() => check(due)} title="Cells not yet checked today">
            {progress ? `Checking ${progress.done}/${progress.total}…` : `Check prices (${due.length} search${due.length === 1 ? "" : "es"})`}
          </button>
          <button className="btn btn-ghost" disabled={Boolean(progress)} onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            className="icon-btn"
            aria-label="Delete grid"
            title="Delete grid"
            onClick={async () => {
              if (!confirm(`Delete "${grid.name}" and its price history?`)) return;
              await api.deleteGrid(grid.id);
              navigate({ page: "prices" });
            }}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </section>
      {error && <p className="error">{error}</p>}
      {best && (
        <p className="notice notice-insight">
          <Icon name="sparkle" size={14} /> Cheapest right now: {money(best.low)} · {specs.find((s) => s.key === best.key)?.row} on {shortDate(specs.find((s) => s.key === best.key)!.date)}
        </p>
      )}

      <div className="card table-scroll">
        <table className="price-grid">
          <thead>
            <tr>
              <th>{flights ? "Route" : "Where"}</th>
              {grid.dates.map((d) => (
                <th key={d}>
                  {weekday(d)} {shortDate(d)}
                  {grid.nights > 0 && <span className="muted small block">→ {shortDate(addDays(d, grid.nights))}</span>}
                </th>
              ))}
              <th>Best</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <th>{row}</th>
                {grid.dates.map((date) => {
                  const s = specs.find((x) => x.row === row && x.date === date)!;
                  const cell = grid.cells[s.key];
                  const now = latest(cell);
                  const before = previous(cell);
                  const t = now && hi > lo ? (now.low - lo) / (hi - lo) : 0;
                  const change = now && before ? now.low - before.low : 0;
                  return (
                    <td key={date}>
                      <button
                        className={`grid-cell ${selected === s.key ? "active" : ""} ${best?.key === s.key ? "best" : ""}`}
                        style={now ? { background: `color-mix(in srgb, var(--booked) ${Math.round(28 * (1 - t))}%, transparent)` } : undefined}
                        onClick={() => setSelected(selected === s.key ? null : s.key)}
                        title={cell?.error ?? (now ? `Checked ${shortDate(now.date)}` : "Not checked yet")}
                      >
                        {now ? <span className="grid-price">{money(now.low)}</span> : <span className="muted">{s.date < today() ? "Past" : "—"}</span>}
                        {change !== 0 && <span className={`grid-change ${change < 0 ? "down" : "up"}`}>{change < 0 ? "▼" : "▲"} {money(Math.abs(change))}</span>}
                        {now?.alt !== undefined && <span className="muted small">{flights ? "Nonstop" : "Chase Edit"} {money(now.alt)}</span>}
                        {!flights && now?.median !== undefined && <span className="muted small">Typical {money(now.median)}</span>}
                        {cell?.level && <span className={`tag grid-level level-${cell.level}`}>{cell.level}</span>}
                        {cell?.error && <span className="warn small">⚠ {cell.error.length > 30 ? "Failed" : cell.error}</span>}
                      </button>
                    </td>
                  );
                })}
                <td className="grid-best">{Number.isFinite(rowBest(row)) ? money(rowBest(row)) : "—"}</td>
              </tr>
            ))}
            <tr>
              <th>Best</th>
              {grid.dates.map((d) => (
                <td key={d} className="grid-best">
                  {Number.isFinite(dateBest(d)) ? money(dateBest(d)) : "—"}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Click a cell for the options and its price history. Green is cheaper; ▲▼ is the change since the previous check.
        {flights && " Low / typical / high is Google Flights' own read on the price."}
      </p>

      {spec && <CellDetail grid={grid} spec={spec} onCheck={() => check([spec])} busy={Boolean(progress)} />}

      {editing && (
        <Modal title="Edit grid" onClose={() => setEditing(false)} wide>
          <GridForm
            kind={grid.kind}
            initial={grid}
            onCancel={() => setEditing(false)}
            onSubmit={async (input) => {
              setGrid(await api.updateGrid(grid.id, input));
              setEditing(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function CellDetail({ grid, spec, onCheck, busy }: { grid: PriceGrid; spec: GridCellSpec; onCheck: () => void; busy: boolean }) {
  const cell = grid.cells[spec.key];
  const flights = grid.kind === "flights";
  const ours = (cell?.history ?? []).map((h) => ({ date: h.date, amount: h.low, available: true }));
  return (
    <section className="card cell-detail">
      <div className="board-head">
        <h2>
          {spec.row} · {shortDate(spec.date)}
          {grid.nights > 0 && ` – ${shortDate(addDays(spec.date, grid.nights))}`}
        </h2>
        <button className="btn btn-secondary btn-sm" disabled={busy || spec.date < today()} onClick={onCheck}>
          Check this one
        </button>
      </div>
      {cell?.error && <p className="error small">{cell.error}</p>}
      {cell?.typical && (
        <p className="small muted">
          Google Flights: prices are <strong>{cell.level}</strong> for this trip; usually {money(cell.typical[0])}–{money(cell.typical[1])}.
        </p>
      )}
      {!cell?.options.length && !cell?.error && <p className="muted small">Not checked yet.</p>}
      <div className="cell-options">
        {cell?.options.map((o, i) => (
          <a key={i} className="cell-option" href={o.bookingUrl} target="_blank" rel="noreferrer">
            <span className="piece-main">
              <span className="item-title">{o.title}</span>
              <span className="muted small">
                {o.subtitle}
                {o.durationMinutes ? ` · ${duration(o.durationMinutes)}` : ""}
                {o.rating ? ` · ★ ${o.rating}` : ""}
              </span>
              <span className="chips">
                {o.edit && <span className="tag tag-hot">{o.edit.selectCredit ? "Chase Edit · $250 credit" : "Chase Edit"}</span>}
                {o.tags.filter((t) => !t.startsWith("Chase Edit")).map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </span>
            </span>
            <span className="piece-side">
              <span className="item-cost">{money(o.total)}</span>
              <span className="muted small">
                {money(o.unitPrice)} {o.unit}
              </span>
              <span className="small">
                {flights ? "Google Flights" : "Hotels.com"} <Icon name="external" size={12} />
              </span>
            </span>
          </a>
        ))}
      </div>
      <div className="cell-charts">
        <div>
          <span className="eyebrow">Your checks</span>
          <PriceChart history={ours} currency="USD" />
        </div>
        {cell?.googleHistory && cell.googleHistory.length > 1 && (
          <div>
            <span className="eyebrow">Google Flights price history</span>
            <PriceChart history={cell.googleHistory} currency="USD" />
          </div>
        )}
      </div>
    </section>
  );
}
