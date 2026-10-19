import { useState } from "react";
import type { PricePoint } from "../../shared/types.ts";
import { money, shortDate } from "../format.ts";

const W = 560;
const H = 150;
const PAD = { top: 12, right: 12, bottom: 22, left: 52 };

/** Price over time for one watched option, with a hover crosshair and tooltip. */
export function PriceChart({ history, currency }: { history: PricePoint[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = history.filter((h) => h.available);
  if (points.length < 2) {
    return <p className="muted small chart-empty">Tracking started {history[0] ? shortDate(history[0].date) : "today"}. The chart fills in as the price is re-checked each day.</p>;
  }

  const amounts = points.map((p) => p.amount);
  const lo = Math.min(...amounts);
  const hi = Math.max(...amounts);
  const span = hi - lo || hi * 0.05 || 1;
  const yMin = lo - span * 0.15;
  const yMax = hi + span * 0.15;
  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const x = (d: string) => PAD.left + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.amount).toFixed(1)}`).join("");
  const active = hover === null ? null : points[hover];

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * (W - PAD.left - PAD.right) + PAD.left;
    let best = 0;
    points.forEach((p, i) => Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px) && (best = i));
    setHover(best);
  };

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Price from ${money(points[0].amount, currency)} to ${money(points[points.length - 1].amount, currency)}`}>
        {[hi, lo].map((v) => (
          <g key={v}>
            <line className="grid-line" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="axis-label" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">
              {money(v, currency)}
            </text>
          </g>
        ))}
        <text className="axis-label" x={PAD.left} y={H - 4}>
          {shortDate(points[0].date)}
        </text>
        <text className="axis-label" x={W - PAD.right} y={H - 4} textAnchor="end">
          {shortDate(points[points.length - 1].date)}
        </text>
        <path className="price-line" d={path} />
        <circle className="price-dot" cx={x(points[points.length - 1].date)} cy={y(points[points.length - 1].amount)} r={4} />
        {active && (
          <g>
            <line className="crosshair" x1={x(active.date)} x2={x(active.date)} y1={PAD.top} y2={H - PAD.bottom} />
            <circle className="price-dot" cx={x(active.date)} cy={y(active.amount)} r={5} />
          </g>
        )}
        <rect x={PAD.left} y={0} width={W - PAD.left - PAD.right} height={H} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {active && (
        <div className="chart-tip" style={{ left: `${Math.min(88, Math.max(12, (x(active.date) / W) * 100))}%` }}>
          <strong>{money(active.amount, currency)}</strong>
          <span className="muted">{shortDate(active.date)}</span>
        </div>
      )}
    </div>
  );
}
