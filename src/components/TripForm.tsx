import { useState, type FormEvent } from "react";
import type { TripInput } from "../../shared/types.ts";
import { addDays, today } from "../format.ts";
import { PlaceInput } from "./PlaceInput.tsx";

export function TripForm({ initial, submitLabel, onSubmit, onCancel }: { initial?: TripInput; submitLabel: string; onSubmit: (input: TripInput) => Promise<void>; onCancel?: () => void }) {
  const start = addDays(today(), 30);
  const [form, setForm] = useState<TripInput>(
    initial ?? { name: "", origin: "", destination: "", startDate: start, endDate: addDays(start, 6), travelers: 2, budget: 3000, currency: "USD" },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TripInput>(key: K, value: TripInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit({ ...form, name: form.name.trim() || `Trip to ${form.destination.trim()}` });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="span-2">
        Where to?
        <PlaceInput value={form.destination} onChange={(v) => set("destination", v)} placeholder="Tokyo, Lisbon, Cancún…" required />
      </label>
      <label className="span-2">
        Leaving from
        <PlaceInput value={form.origin} onChange={(v) => set("origin", v)} placeholder="Your home city or airport" />
      </label>
      <label>
        Start
        <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} required />
      </label>
      <label>
        End
        <input type="date" value={form.endDate} min={form.startDate} onChange={(e) => set("endDate", e.target.value)} required />
      </label>
      <label>
        Travelers
        <input type="number" min={1} max={20} value={form.travelers} onChange={(e) => set("travelers", Number(e.target.value))} required />
      </label>
      <label>
        Budget (USD)
        <input type="number" min={0} step={50} value={form.budget} onChange={(e) => set("budget", Number(e.target.value))} />
      </label>
      <label className="span-2">
        <span>
          Trip name <span className="muted">(optional)</span>
        </span>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={form.destination ? `Trip to ${form.destination}` : "Spring getaway"} />
      </label>
      {error && <p className="error span-2">{error}</p>}
      <div className="form-actions span-2">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
