import { useEffect, useId, useState } from "react";
import type { Place } from "../../shared/types.ts";
import { api } from "../api.ts";

/** Text input with city / airport suggestions. Any free text is still accepted. */
export function PlaceInput({ value, onChange, placeholder, required, id }: { value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; id?: string }) {
  const listId = useId();
  const [places, setPlaces] = useState<Place[]>([]);

  useEffect(() => {
    const t = setTimeout(() => api.places(value).then(setPlaces).catch(() => setPlaces([])), 150);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <>
      <input id={id} list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} autoComplete="off" />
      <datalist id={listId}>
        {places.map((p) => (
          <option key={p.code} value={p.city}>
            {p.code} · {p.airport}, {p.country}
          </option>
        ))}
      </datalist>
    </>
  );
}
