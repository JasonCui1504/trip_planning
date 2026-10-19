import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { CATEGORIES, type Category, type EditHotel, type Offer, type SearchParamsMap, type SearchResponse, type Trip } from "../../shared/types.ts";
import { api } from "../api.ts";
import { CATEGORY_LABEL, money } from "../format.ts";
import { CATEGORY_ICON, Icon } from "../icons.tsx";
import { Modal } from "./Modal.tsx";
import { ResultCard } from "./ResultCard.tsx";
import { defaultParams, SearchForm, type AnyParams } from "./SearchForm.tsx";
import type { TripActions } from "./Workspace.tsx";

export interface SearchState {
  category: Category;
  params: AnyParams;
  results: Partial<Record<Category, SearchResponse>>;
}

type SortKey = "recommended" | "price" | "price-desc" | "rating" | "duration" | "departure";

const SORTS: { key: SortKey; label: string; only?: Category[] }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "price", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "rating", label: "Top rated" },
  { key: "duration", label: "Shortest", only: ["flights"] },
  { key: "departure", label: "Earliest departure", only: ["flights"] },
];

const flightMinutes = (o: Offer) => (o.legs ?? []).reduce((s, l) => s + l.durationMinutes, 0);

function sortOffers(offers: Offer[], key: SortKey): Offer[] {
  const sorted = [...offers];
  switch (key) {
    case "price":
      return sorted.sort((a, b) => a.totalPrice.amount - b.totalPrice.amount);
    case "price-desc":
      return sorted.sort((a, b) => b.totalPrice.amount - a.totalPrice.amount);
    case "rating":
      return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "duration":
      return sorted.sort((a, b) => flightMinutes(a) - flightMinutes(b));
    case "departure":
      return sorted.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
    default:
      // Rank by tags the provider flagged first, then a mix of rating and price.
      return sorted.sort((a, b) => score(b) - score(a));
  }
}

function score(o: Offer): number {
  const flagged = o.tags.includes("Best value") || o.tags.includes("Google best") ? 3 : o.tags.some((t) => t === "Cheapest" || t === "Fastest") ? 1 : 0;
  return flagged + (o.rating ?? 4) - Math.log10(o.totalPrice.amount + 1) * 0.6;
}

export function SearchPanel({ trip, state, setState, actions }: { trip: Trip; state: SearchState; setState: Dispatch<SetStateAction<SearchState>>; actions: TripActions }) {
  const { category } = state;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("recommended");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState("");
  const [compare, setCompare] = useState<Offer[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [booking, setBooking] = useState<Offer | null>(null);
  const [watched, setWatched] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.watches().then((list) => setWatched(new Set(list.map((w) => w.offerId)))).catch(() => undefined);
  }, []);

  const watch = async (offer: Offer) => {
    try {
      await api.watch(category, params, offer.id, trip.id);
      setWatched((s) => new Set(s).add(offer.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const params = (state.params[category] ?? defaultParams(category, trip)) as SearchParamsMap[typeof category];
  const response = state.results[category];

  const setCategory = (c: Category) => {
    setState((s) => ({ ...s, category: c }));
    setTagFilter([]);
    setMaxPrice("");
    setSort("recommended");
  };

  const runSearch = async (next: SearchParamsMap[Category]) => {
    setBusy(true);
    setError("");
    setState((s) => ({ ...s, params: { ...s.params, [category]: next } }));
    try {
      const res = await api.search(category, next);
      setState((s) => ({ ...s, results: { ...s.results, [category]: res } }));
      setTagFilter([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of response?.offers ?? []) for (const t of o.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].filter(([, n]) => n > 1 || response!.offers.length < 4).map(([t]) => t).slice(0, 10);
  }, [response]);

  const visible = useMemo(() => {
    const limit = Number(maxPrice);
    const filtered = (response?.offers ?? []).filter(
      (o) => tagFilter.every((t) => o.tags.includes(t)) && (!limit || o.totalPrice.amount <= limit),
    );
    return sortOffers(filtered, sort);
  }, [response, tagFilter, maxPrice, sort]);

  const savedByOffer = new Map(trip.items.filter((i) => i.offerId).map((i) => [i.offerId!, i]));

  const toggleCompare = (offer: Offer) =>
    setCompare((list) => (list.some((o) => o.id === offer.id) ? list.filter((o) => o.id !== offer.id) : [...list, offer].slice(-4)));

  return (
    <section className="search-panel">
      <div className="category-tabs" role="tablist">
        {CATEGORIES.map((c) => (
          <button key={c} role="tab" aria-selected={c === category} className={`category-tab ${c === category ? "active" : ""}`} onClick={() => setCategory(c)}>
            <Icon name={CATEGORY_ICON[c]} size={16} /> {CATEGORY_LABEL[c]}
            {state.results[c] && <span className="dot" />}
          </button>
        ))}
      </div>

      <div className="card">
        <SearchForm key={category} category={category} trip={trip} initial={params} busy={busy} onSearch={runSearch} />
      </div>

      {error && <p className="error">{error}</p>}

      {category === "hotels" && (
        <EditPanel
          location={(params as SearchParamsMap["hotels"]).location || trip.destination}
          dates={params as SearchParamsMap["hotels"]}
          live={Boolean(state.results.hotels?.live)}
          onCheckPrice={(name, city) => runSearch({ ...(params as SearchParamsMap["hotels"]), location: `${name}, ${city}` })}
          onSaveIdea={(hotel, url) =>
            actions.addItem({
              category: "hotels",
              status: "idea",
              title: hotel.name,
              subtitle: `Chase Edit · ${hotel.brand}${hotel.selectCredit ? " · $250 Select credit" : ""} · ${hotel.location}`,
              location: hotel.location,
              provider: "Chase Edit list",
              bookingUrl: url,
              cost: { amount: 0, currency: trip.currency },
            })
          }
          savedTitles={new Set(trip.items.filter((i) => i.category === "hotels").map((i) => i.title))}
        />
      )}

      {response ? (
        <>
          {response.warnings.map((w) => (
            <p key={w} className="notice">
              <Icon name="sparkle" size={14} /> {w}
            </p>
          ))}
          {response.insights?.map((w) => (
            <p key={w} className="notice notice-insight">
              <Icon name="sparkle" size={14} /> {w}
            </p>
          ))}
          <div className="results-toolbar">
            <span className="muted small">
              {visible.length} of {response.offers.length} results · {response.provider}
            </span>
            <div className="toolbar-controls">
              <label className="inline">
                Max total
                <input type="number" min={0} step={50} placeholder="Any" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </label>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort results">
                {SORTS.filter((s) => !s.only || s.only.includes(category)).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {tagOptions.length > 0 && (
            <div className="chips">
              {tagOptions.map((t) => (
                <button key={t} className={`chip ${tagFilter.includes(t) ? "active" : ""}`} onClick={() => setTagFilter((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]))}>
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="results">
            {visible.map((offer) => (
              <ResultCard
                key={offer.id}
                offer={offer}
                saved={savedByOffer.get(offer.id)}
                comparing={compare.some((o) => o.id === offer.id)}
                watching={watched.has(offer.id)}
                onWatch={() => watch(offer)}
                onSave={() => actions.saveOffer(offer)}
                onBook={() => setBooking(offer)}
                onToggleCompare={() => toggleCompare(offer)}
              />
            ))}
            {visible.length === 0 && <p className="muted empty">No results match those filters.</p>}
          </div>
        </>
      ) : (
        <div className="card empty muted">
          <Icon name={CATEGORY_ICON[category]} size={28} />
          <p>Search {CATEGORY_LABEL[category].toLowerCase()} for {trip.destination}. The form is pre-filled from your trip.</p>
        </div>
      )}

      {compare.length > 0 && (
        <div className="compare-tray card">
          <span>
            <Icon name="compare" size={16} /> {compare.length} selected
          </span>
          <button className="btn btn-primary" disabled={compare.length < 2} onClick={() => setShowCompare(true)}>
            Compare
          </button>
          <button className="btn btn-ghost" onClick={() => setCompare([])}>
            Clear
          </button>
        </div>
      )}

      {showCompare && <CompareModal offers={compare} onClose={() => setShowCompare(false)} onSave={(o) => actions.saveOffer(o)} saved={savedByOffer} />}
      {booking && <BookModal offer={booking} trip={trip} actions={actions} existing={savedByOffer.get(booking.id)} onClose={() => setBooking(null)} />}
    </section>
  );
}

function CompareModal({ offers, saved, onClose, onSave }: { offers: Offer[]; saved: Map<string, unknown>; onClose: () => void; onSave: (o: Offer) => void }) {
  const keys = [...new Set(offers.flatMap((o) => Object.keys(o.details)))];
  const cheapest = Math.min(...offers.map((o) => o.totalPrice.amount));
  return (
    <Modal title="Compare options" onClose={onClose} wide>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th />
              {offers.map((o) => (
                <th key={o.id}>
                  {o.title}
                  <div className="muted small">{o.subtitle}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Price</th>
              {offers.map((o) => (
                <td key={o.id}>
                  {money(o.price)} <span className="muted small">{o.priceUnit}</span>
                </td>
              ))}
            </tr>
            <tr>
              <th>Total</th>
              {offers.map((o) => (
                <td key={o.id} className={o.totalPrice.amount === cheapest ? "best" : ""}>
                  {money(o.totalPrice)}
                </td>
              ))}
            </tr>
            <tr>
              <th>Rating</th>
              {offers.map((o) => (
                <td key={o.id}>{o.rating ? `${o.rating.toFixed(1)} ★` : "—"}</td>
              ))}
            </tr>
            {keys.map((k) => (
              <tr key={k}>
                <th>{k}</th>
                {offers.map((o) => (
                  <td key={o.id}>{o.details[k] ?? "—"}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th />
              {offers.map((o) => (
                <td key={o.id}>
                  {saved.has(o.id) ? (
                    <span className="status-chip status-shortlisted">
                      <Icon name="check" size={14} /> Saved
                    </span>
                  ) : (
                    <button className="btn btn-secondary" onClick={() => onSave(o)}>
                      Save
                    </button>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function BookModal({ offer, trip, existing, actions, onClose }: { offer: Offer; trip: Trip; existing?: { id: string }; actions: TripActions; onClose: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const perPerson = offer.category === "activities" || offer.category === "dining";
  const [cost, setCost] = useState(String(perPerson ? offer.totalPrice.amount * trip.travelers : offer.totalPrice.amount));
  const host = new URL(offer.bookingUrl).hostname.replace(/^www\./, "");

  const record = async () => {
    const patch = { status: "booked" as const, confirmation, cost: { amount: Number(cost) || 0, currency: offer.totalPrice.currency } };
    if (existing) await actions.updateItem(existing.id, patch);
    else await actions.saveOffer(offer, "booked", patch);
    onClose();
  };

  return (
    <Modal title="Record your booking" onClose={onClose}>
      <p>
        We opened <strong>{host}</strong> in a new tab with your search pre-filled. Once you've booked <strong>{offer.title}</strong>, record it here so it shows up on
        your itinerary and budget.
      </p>
      <div className="form-grid">
        <label>
          Confirmation #
          <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="e.g. ABC123" autoFocus />
        </label>
        <label>
          Final price ({offer.totalPrice.currency})
          <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
        <div className="form-actions span-2">
          <button
            className="btn btn-ghost"
            onClick={async () => {
              if (!existing) await actions.saveOffer(offer);
              onClose();
            }}
          >
            Not yet — just save it
          </button>
          <button className="btn btn-primary" onClick={record}>
            Mark as booked
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditPanel({ location, dates, live, onCheckPrice, onSaveIdea, savedTitles }: { location: string; dates: SearchParamsMap["hotels"]; live: boolean; onCheckPrice: (name: string, city: string) => void; onSaveIdea: (h: EditHotel, url: string) => void; savedTitles: Set<string> }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ hotels: EditHotel[]; total: number } | null>(null);
  const city = location.split(",")[0].trim();

  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    api.editHotels(city).then((d) => !cancelled && setData(d)).catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [city]);

  if (!data || data.total === 0) return null;
  const googleUrl = (h: EditHotel) =>
    `https://www.google.com/travel/search?q=${encodeURIComponent(`${h.name} ${h.location}`)}&checkin=${dates.checkIn}&checkout=${dates.checkOut}&adults=${dates.guests}`;

  return (
    <div className="card edit-panel">
      <button className="edit-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>
          <span className="eyebrow">Chase Sapphire Reserve · The Edit</span>
          <span className="edit-count">
            {data.hotels.length ? `${data.hotels.length} Edit hotel${data.hotels.length === 1 ? "" : "s"} in ${city}` : `No Edit hotels found in ${city}`}
          </span>
        </span>
        {data.hotels.length > 0 && <span className="link-btn small">{open ? "Hide" : "Show"}</span>}
      </button>
      {open && data.hotels.length > 0 && (
        <>
          <p className="muted small">
            Edit stays come with perks such as daily breakfast and a property credit, plus your card's annual Edit credit. IHG, Omni, Virgin, Montage, Pendry, Minor and Pan Pacific
            hotels also qualify for the extra 2026 Select Hotels credit. List from{" "}
            <a href="https://edithotelsearch.com/" target="_blank" rel="noreferrer">
              edithotelsearch.com
            </a>{" "}
            — not affiliated with Chase; confirm on Chase Travel before booking.
          </p>
          <ul className="edit-list">
            {data.hotels.map((h) => (
              <li key={h.name}>
                <span className="piece-main">
                  <span className="item-title">{h.name}</span>
                  <span className="muted small">
                    {h.brand} · {h.location}
                  </span>
                </span>
                {h.selectCredit && <span className="tag tag-edit">$250 credit</span>}
                <span className="edit-actions">
                  {live && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onCheckPrice(h.name, h.location)}>
                      Live price
                    </button>
                  )}
                  <a className="btn btn-ghost btn-sm" href={googleUrl(h)} target="_blank" rel="noreferrer">
                    Google Hotels <Icon name="external" size={12} />
                  </a>
                  {savedTitles.has(h.name) ? (
                    <span className="status-chip status-idea">Saved</span>
                  ) : (
                    <button className="btn btn-secondary btn-sm" onClick={() => onSaveIdea(h, googleUrl(h))}>
                      <Icon name="plus" size={12} /> Idea
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
