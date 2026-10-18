import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Trip } from "../../shared/types.ts";
import { Icon } from "../icons.tsx";
import type { TripActions } from "./Workspace.tsx";

export function Checklist({ trip, actions }: { trip: Trip; actions: TripActions }) {
  const [text, setText] = useState("");
  const [notes, setNotes] = useState(trip.notes);
  const [saved, setSaved] = useState(true);
  const latest = useRef(notes);
  latest.current = notes;

  // Autosave notes shortly after typing stops.
  useEffect(() => {
    if (notes === trip.notes) return;
    setSaved(false);
    const t = setTimeout(() => actions.updateTrip({ notes: latest.current }).then(() => setSaved(true)), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const setList = (checklist: Trip["checklist"]) => actions.updateTrip({ checklist });
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setList([...trip.checklist, { id: crypto.randomUUID(), text: text.trim(), done: false }]);
    setText("");
  };
  const done = trip.checklist.filter((c) => c.done).length;

  return (
    <div className="two-col">
      <section className="card">
        <div className="board-head">
          <h2>Checklist</h2>
          <span className="muted small">
            {done}/{trip.checklist.length} done
          </span>
        </div>
        <ul className="checklist">
          {trip.checklist.map((c) => (
            <li key={c.id} className={c.done ? "done" : ""}>
              <label>
                <input type="checkbox" checked={c.done} onChange={() => setList(trip.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))} />
                {c.text}
              </label>
              <button className="icon-btn" aria-label={`Remove ${c.text}`} onClick={() => setList(trip.checklist.filter((x) => x.id !== c.id))}>
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
        <form className="add-row" onSubmit={add}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a to-do, e.g. Book airport transfer" />
          <button className="btn btn-secondary">
            <Icon name="plus" size={14} /> Add
          </button>
        </form>
      </section>
      <section className="card">
        <div className="board-head">
          <h2>Notes</h2>
          <span className="muted small">{saved ? "Saved" : "Saving…"}</span>
        </div>
        <textarea className="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ideas, links, addresses, who's bringing what…" />
      </section>
    </div>
  );
}
