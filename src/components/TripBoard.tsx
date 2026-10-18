import type { ItemStatus, Trip, TripItem } from "../../shared/types.ts";
import { money, shortDate, time } from "../format.ts";
import { CATEGORY_ICON, Icon } from "../icons.tsx";
import type { TripActions } from "./Workspace.tsx";

export const STATUS_LABEL: Record<ItemStatus, string> = { idea: "Idea", shortlisted: "Shortlisted", booked: "Booked" };
const ORDER: ItemStatus[] = ["booked", "shortlisted", "idea"];

export function ItemRow({ item, actions, compact }: { item: TripItem; actions: TripActions; compact?: boolean }) {
  return (
    <div className={`item-row status-border-${item.status}`}>
      <span className="item-icon">
        <Icon name={CATEGORY_ICON[item.category]} size={16} />
      </span>
      <button className="item-main" onClick={() => actions.editItem(item)} title="Edit">
        <span className="item-title">{item.title}</span>
        <span className="muted small">
          {item.start ? `${shortDate(item.start)}${time(item.start) ? ` ${time(item.start)}` : ""} · ` : ""}
          {item.subtitle}
        </span>
        {item.confirmation && <span className="small conf">Conf. {item.confirmation}</span>}
      </button>
      <div className="item-side">
        <span className="item-cost">{money(item.cost)}</span>
        {!compact && (
          <select
            className={`status-select status-${item.status}`}
            value={item.status}
            onChange={(e) => actions.updateItem(item.id, { status: e.target.value as ItemStatus })}
            aria-label="Status"
          >
            {ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export function TripBoard({ trip, actions }: { trip: Trip; actions: TripActions }) {
  return (
    <aside className="board card">
      <div className="board-head">
        <h2>Trip board</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => actions.editItem("new")}>
          <Icon name="plus" size={14} /> Add your own
        </button>
      </div>
      {trip.items.length === 0 && <p className="muted small">Saved options land here. Shortlist a few, compare, then book the winners.</p>}
      {ORDER.map((status) => {
        const items = trip.items.filter((i) => i.status === status);
        if (!items.length) return null;
        const total = items.reduce((s, i) => s + i.cost.amount, 0);
        return (
          <div key={status} className="board-group">
            <div className="board-group-head">
              <span className={`status-chip status-${status}`}>{STATUS_LABEL[status]}</span>
              <span className="muted small">
                {items.length} · {money(total, trip.currency)}
              </span>
            </div>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} actions={actions} />
            ))}
          </div>
        );
      })}
    </aside>
  );
}
