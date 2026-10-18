import { useCallback, useEffect, useState } from "react";
import { offerToItem, type Category, type ItemStatus, type Offer, type SearchResponse, type Trip, type TripInput, type TripItem } from "../../shared/types.ts";
import { api, type NewItem } from "../api.ts";
import { dateRange, daysBetween, money } from "../format.ts";
import { Icon, type IconName } from "../icons.tsx";
import { href, navigate, type WorkspaceTab } from "../router.ts";
import { Budget } from "./Budget.tsx";
import { Checklist } from "./Checklist.tsx";
import { Itinerary } from "./Itinerary.tsx";
import { ItemModal } from "./ItemModal.tsx";
import { Modal } from "./Modal.tsx";
import { SearchPanel, type SearchState } from "./SearchPanel.tsx";
import { TripBoard } from "./TripBoard.tsx";
import { TripForm } from "./TripForm.tsx";

const TABS: { id: WorkspaceTab; label: string; icon: IconName }[] = [
  { id: "search", label: "Search & save", icon: "search" },
  { id: "itinerary", label: "Itinerary", icon: "calendar" },
  { id: "budget", label: "Budget", icon: "wallet" },
  { id: "checklist", label: "Checklist & notes", icon: "list" },
];

export interface TripActions {
  saveOffer: (offer: Offer, status?: ItemStatus, extra?: Partial<TripItem>) => Promise<void>;
  addItem: (item: Partial<NewItem>) => Promise<void>;
  updateItem: (itemId: string, patch: Partial<TripItem>) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  updateTrip: (patch: Partial<Trip>) => Promise<void>;
  editItem: (item: TripItem | "new") => void;
}

export function Workspace({ id, tab }: { id: string; tab: WorkspaceTab }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState("");
  const [editingTrip, setEditingTrip] = useState(false);
  const [editingItem, setEditingItem] = useState<TripItem | "new" | null>(null);
  // Search state lives here so results survive switching tabs.
  const [search, setSearch] = useState<SearchState>({ category: "flights", params: {}, results: {} as Partial<Record<Category, SearchResponse>> });

  const reload = useCallback(() => api.trip(id).then(setTrip), [id]);

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [reload]);

  if (error) {
    return (
      <div className="card empty">
        <p className="error">{error}</p>
        <a href={href({ page: "home" })}>Back to trips</a>
      </div>
    );
  }
  if (!trip) return <p className="muted empty">Loading trip…</p>;

  const run = async (op: () => Promise<unknown>) => {
    try {
      await op();
    } finally {
      await reload();
    }
  };

  const actions: TripActions = {
    saveOffer: (offer, status = "shortlisted", extra) => run(() => api.addItem(trip.id, { ...offerToItem(offer, trip.travelers, status), ...extra })),
    addItem: (item) => run(() => api.addItem(trip.id, item)),
    updateItem: (itemId, patch) => run(() => api.updateItem(trip.id, itemId, patch)),
    deleteItem: (itemId) => run(() => api.deleteItem(trip.id, itemId)),
    updateTrip: (patch) => run(() => api.updateTrip(trip.id, patch)),
    editItem: setEditingItem,
  };

  const booked = trip.items.filter((i) => i.status === "booked");
  const bookedTotal = booked.reduce((s, i) => s + i.cost.amount, 0);
  const nights = daysBetween(trip.startDate, trip.endDate);
  const pct = trip.budget ? Math.min(100, (bookedTotal / trip.budget) * 100) : 0;

  return (
    <div className="workspace">
      <section className="trip-header card">
        <div className="trip-header-main">
          <a className="back-link" href={href({ page: "home" })}>
            <Icon name="arrowLeft" size={14} /> All trips
          </a>
          <h1>{trip.name}</h1>
          <p className="muted">
            {trip.origin ? `${trip.origin} → ` : ""}
            {trip.destination} · {dateRange(trip.startDate, trip.endDate)} · {nights} night{nights === 1 ? "" : "s"} · {trip.travelers} traveler
            {trip.travelers === 1 ? "" : "s"}
          </p>
        </div>
        <div className="trip-header-stats">
          <div className="stat">
            <span className="stat-value">{trip.items.length}</span>
            <span className="stat-label">saved</span>
          </div>
          <div className="stat">
            <span className="stat-value">{booked.length}</span>
            <span className="stat-label">booked</span>
          </div>
          <div className="stat stat-budget">
            <span className="stat-value">{money(bookedTotal, trip.currency)}</span>
            <span className="stat-label">{trip.budget ? `of ${money(trip.budget, trip.currency)} budget` : "booked so far"}</span>
            {trip.budget > 0 && (
              <span className="meter">
                <span className={bookedTotal > trip.budget ? "meter-fill over" : "meter-fill"} style={{ width: `${pct}%` }} />
              </span>
            )}
          </div>
          <button className="btn btn-ghost" onClick={() => setEditingTrip(true)}>
            Edit trip
          </button>
        </div>
      </section>

      <nav className="tabs" aria-label="Trip sections">
        {TABS.map((t) => (
          <a key={t.id} href={href({ page: "trip", id: trip.id, tab: t.id })} className={`tab ${tab === t.id ? "active" : ""}`}>
            <Icon name={t.icon} size={16} /> {t.label}
          </a>
        ))}
      </nav>

      {tab === "search" && (
        <div className="split">
          <SearchPanel trip={trip} state={search} setState={setSearch} actions={actions} />
          <TripBoard trip={trip} actions={actions} />
        </div>
      )}
      {tab === "itinerary" && <Itinerary trip={trip} actions={actions} />}
      {tab === "budget" && <Budget trip={trip} actions={actions} />}
      {tab === "checklist" && <Checklist trip={trip} actions={actions} />}

      {editingTrip && (
        <Modal title="Edit trip" onClose={() => setEditingTrip(false)}>
          <TripForm
            initial={tripInput(trip)}
            submitLabel="Save changes"
            onCancel={() => setEditingTrip(false)}
            onSubmit={async (input) => {
              await api.updateTrip(trip.id, input);
              await reload();
              setEditingTrip(false);
            }}
          />
          <div className="danger-zone">
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (!confirm(`Delete "${trip.name}" and everything saved on it?`)) return;
                await api.deleteTrip(trip.id);
                navigate({ page: "home" });
              }}
            >
              <Icon name="trash" size={16} /> Delete trip
            </button>
          </div>
        </Modal>
      )}

      {editingItem && <ItemModal trip={trip} item={editingItem === "new" ? null : editingItem} actions={actions} onClose={() => setEditingItem(null)} />}
    </div>
  );
}

function tripInput(trip: Trip): TripInput {
  const { name, origin, destination, startDate, endDate, travelers, budget, currency } = trip;
  return { name, origin, destination, startDate, endDate, travelers, budget, currency };
}
