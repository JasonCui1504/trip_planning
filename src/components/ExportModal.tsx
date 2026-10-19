import { useEffect, useState, type FormEvent } from "react";
import { applyScenario, type Trip } from "../../shared/types.ts";
import { api } from "../api.ts";
import { Icon } from "../icons.tsx";
import { Modal } from "./Modal.tsx";

/**
 * Send the trip to the travel budget on jascui.com. A login typed here is
 * used for this export only; the server can also keep one in its env vars.
 */
export function ExportModal({ trip, plan: initialPlan = "", onDone, onClose }: { trip: Trip; plan?: string; onDone: (trip: Trip) => void; onClose: () => void }) {
  const [info, setInfo] = useState<{ url: string; savedLogin: boolean } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Trip | null>(null);
  // "" = everything saved; otherwise one Workshop plan with its own schedule.
  const [planId, setPlanId] = useState(initialPlan);

  useEffect(() => {
    api.travelBudget().then(setInfo).catch((e) => setError(e.message));
  }, []);

  const plan = trip.scenarios.find((s) => s.id === planId);
  const items = plan ? applyScenario(trip, plan).items : trip.items;
  const scheduled = items.filter((i) => i.status !== "idea" && i.start);
  const ideas = items.length - scheduled.length;
  const link = (result ?? trip).travelBudget;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const updated = await api.exportTravelBudget(trip.id, { ...(info?.savedLogin && !username ? {} : { username, password }), scenarioId: planId || undefined });
      setResult(updated);
      onDone(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Export to travel budget" onClose={onClose}>
      {result?.travelBudget ? (
        <div className="export-done">
          <p>
            Exported. {result.travelBudget.eventIds.length} calendar event{result.travelBudget.eventIds.length === 1 ? "" : "s"}, {result.travelBudget.days.length} day
            {result.travelBudget.days.length === 1 ? "" : "s"} of stays and cars, {result.travelBudget.ideaIds.length} idea{result.travelBudget.ideaIds.length === 1 ? "" : "s"}.
          </p>
          <div className="form-actions">
            <a className="btn btn-primary" href={result.travelBudget.url} target="_blank" rel="noreferrer">
              Open in travel budget <Icon name="external" size={14} />
            </a>
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      ) : (
        <form className="form-grid" onSubmit={submit}>
          <p className="muted span-2">
            {link ? (
              <>
                Updates the{" "}
                <a href={link.url} target="_blank" rel="noreferrer">
                  trip exported on {new Date(link.exportedAt).toLocaleDateString()}
                </a>
                . What the last export added is replaced; anything you added on the travel budget stays.
              </>
            ) : (
              <>Creates this trip on {info ? new URL(info.url).host : "jascui.com"}/travel_budget.</>
            )}{" "}
            Dated items go on the calendar ({scheduled.length}), stays and cars fill each day, and ideas or undated items ({ideas}) go to the Ideas list.
          </p>
          {trip.scenarios.length > 0 && (
            <label className="span-2">
              What to export
              <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">Everything saved on the trip</option>
                {trip.scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    Workshop plan: {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {info?.savedLogin && <p className="small muted span-2">A travel budget login is saved on the server. Leave these blank to use it.</p>}
          <label>
            Travel budget username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required={!info?.savedLogin} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required={!info?.savedLogin || Boolean(username)} />
          </label>
          {error && <p className="error span-2">{error}</p>}
          <div className="form-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy || !info}>
              {busy ? "Exporting…" : link ? "Update export" : "Export"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
