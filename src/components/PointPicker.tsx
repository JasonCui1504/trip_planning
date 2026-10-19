import { useEffect, useId, useState } from "react";
import type { GeoPoint } from "../../shared/types.ts";
import { api } from "../api.ts";

export type NamedPoint = GeoPoint & { label: string; detail?: string };

/**
 * Pick a location: offers the trip's own places first (airports, hotels…),
 * then OpenStreetMap search results as you type.
 */
export function PointPicker({ label, value, onChange, suggestions }: { label: string; value: NamedPoint | null; onChange: (p: NamedPoint | null) => void; suggestions: NamedPoint[] }) {
  const id = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<NamedPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => setText(value?.label ?? ""), [value]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 3 || q === value?.label) return setRemote([]);
    setLoading(true);
    const t = setTimeout(() => {
      api.geocode(q).then(setRemote).catch(() => setRemote([])).finally(() => setLoading(false));
    }, 450);
    return () => clearTimeout(t);
  }, [text, value]);

  const q = text.trim().toLowerCase();
  const local = suggestions.filter((s) => !q || q === value?.label.toLowerCase() || s.label.toLowerCase().includes(q));
  const options = [...local.map((p) => ({ ...p, group: "On this trip" })), ...remote.map((p) => ({ ...p, group: "Map search" }))];

  return (
    <label className="picker">
      {label}
      <input
        id={id}
        value={text}
        placeholder="Airport, hotel, address…"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
      />
      {open && (options.length > 0 || loading) && (
        <ul className="picker-menu" role="listbox">
          {options.map((o, i) => (
            <li key={`${o.group}-${i}`}>
              {(i === 0 || options[i - 1].group !== o.group) && <span className="picker-group">{o.group}</span>}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ lat: o.lat, lon: o.lon, label: o.label, detail: o.detail });
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                {o.detail && <span className="muted small">{o.detail}</span>}
              </button>
            </li>
          ))}
          {loading && <li className="muted small picker-loading">Searching the map…</li>}
        </ul>
      )}
    </label>
  );
}
