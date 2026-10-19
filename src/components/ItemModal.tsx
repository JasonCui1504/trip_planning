import { useState, type FormEvent } from "react";
import type { ItemStatus, Trip, TripItem } from "../../shared/types.ts";
import { CATEGORY_LABEL } from "../format.ts";
import { Icon } from "../icons.tsx";
import { Modal } from "./Modal.tsx";
import { STATUS_LABEL } from "./TripBoard.tsx";
import type { TripActions } from "./Workspace.tsx";

const CATS = ["flights", "hotels", "activities", "cars", "dining", "custom"] as const;

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm"; date-only values get a default time.
const toLocal = (v?: string) => (!v ? "" : v.length === 10 ? `${v}T09:00` : v.slice(0, 16));

export function ItemModal({ trip, item, actions, onClose }: { trip: Trip; item: TripItem | null; actions: TripActions; onClose: () => void }) {
  const [form, setForm] = useState({
    category: item?.category ?? "custom",
    status: item?.status ?? ("booked" as ItemStatus),
    title: item?.title ?? "",
    subtitle: item?.subtitle ?? "",
    start: toLocal(item?.start),
    end: toLocal(item?.end),
    location: item?.location ?? "",
    cost: String(item?.cost.amount ?? ""),
    confirmation: item?.confirmation ?? "",
    bookingUrl: item?.bookingUrl ?? "",
    notes: item?.notes ?? "",
  });
  const [error, setError] = useState("");
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const patch = {
      ...form,
      category: form.category as TripItem["category"],
      cost: { amount: Number(form.cost) || 0, currency: item?.cost.currency ?? trip.currency },
    };
    try {
      if (item) await actions.updateItem(item.id, patch);
      else await actions.addItem({ ...patch, provider: "Manual entry", details: {} });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal title={item ? "Edit item" : "Add your own item"} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label className="span-2">
          Title
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Train to Kyoto, museum tickets, dinner reservation…" required autoFocus={!item} />
        </label>
        <label>
          Type
          <select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {(["idea", "shortlisted", "booked"] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Starts
          <input type="datetime-local" value={form.start} onChange={(e) => set("start", e.target.value)} />
        </label>
        <label>
          Ends
          <input type="datetime-local" value={form.end} min={form.start} onChange={(e) => set("end", e.target.value)} />
        </label>
        <label>
          Cost ({item?.cost.currency ?? trip.currency})
          <input type="number" min={0} value={form.cost} onChange={(e) => set("cost", e.target.value)} />
        </label>
        <label>
          Confirmation #
          <input value={form.confirmation} onChange={(e) => set("confirmation", e.target.value)} />
        </label>
        <label className="span-2">
          Details
          <input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Short description" />
        </label>
        <label>
          Location
          <input value={form.location} onChange={(e) => set("location", e.target.value)} />
        </label>
        <label>
          Booking link
          <input type="url" value={form.bookingUrl} onChange={(e) => set("bookingUrl", e.target.value)} placeholder="https://" />
        </label>
        <label className="span-2">
          Notes
          <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </label>
        {item && Object.keys(item.details).length > 0 && (
          <dl className="details span-2">
            {Object.entries(item.details).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {item?.altLinks && item.altLinks.length > 0 && (
          <p className="alt-links small span-2">
            <span className="muted">Compare on:</span>
            {item.altLinks.map((l) => (
              <a key={l.label} href={l.url} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ))}
          </p>
        )}
        {error && <p className="error span-2">{error}</p>}
        <div className="form-actions span-2">
          {item && (
            <button
              type="button"
              className="btn btn-danger push-left"
              onClick={async () => {
                await actions.deleteItem(item.id);
                onClose();
              }}
            >
              <Icon name="trash" size={14} /> Remove
            </button>
          )}
          {form.bookingUrl && (
            <a className="btn btn-ghost" href={form.bookingUrl} target="_blank" rel="noreferrer">
              Open link <Icon name="external" size={14} />
            </a>
          )}
          <button className="btn btn-primary">{item ? "Save" : "Add to trip"}</button>
        </div>
      </form>
    </Modal>
  );
}
