import { useState } from "react";
import type { Offer, TripItem } from "../../shared/types.ts";
import { duration, money, shortDate, time } from "../format.ts";
import { CATEGORY_ICON, Icon } from "../icons.tsx";

export function Thumb({ hue = 180, category }: { hue?: number; category: Offer["category"] | "custom" }) {
  return (
    <div className="thumb" style={{ background: `linear-gradient(135deg, hsl(${hue} 28% 34%), hsl(${(hue + 40) % 360} 32% 20%))` }}>
      <Icon name={CATEGORY_ICON[category]} size={22} />
    </div>
  );
}

const HIGHLIGHT_TAGS = new Set(["Cheapest", "Fastest", "Best value", "Likely to sell out", "Local favourite"]);

export function ResultCard({ offer, saved, comparing, onSave, onBook, onToggleCompare }: { offer: Offer; saved?: TripItem; comparing: boolean; onSave: () => void; onBook: () => void; onToggleCompare: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <article className={`result card ${comparing ? "is-comparing" : ""}`}>
      <Thumb hue={offer.imageHue} category={offer.category} />
      <div className="result-body">
        <div className="result-title-row">
          <h3>{offer.title}</h3>
          {offer.rating !== undefined && (
            <span className="rating" title={`${offer.reviewCount?.toLocaleString()} reviews`}>
              <Icon name="star" size={13} /> {offer.rating.toFixed(1)}
              <span className="muted"> ({offer.reviewCount?.toLocaleString()})</span>
            </span>
          )}
        </div>
        <p className="muted">{offer.subtitle}</p>

        {offer.legs && (
          <div className="legs">
            {offer.legs.map((leg, i) => (
              <div key={i} className="leg">
                <span className="leg-date">{shortDate(leg.depart)}</span>
                <strong>{time(leg.depart)}</strong>
                <span className="leg-line">
                  <span className="muted small">
                    {duration(leg.durationMinutes)} · {leg.stops === 0 ? "nonstop" : `via ${leg.stopCities.join(", ")}`}
                  </span>
                </span>
                <strong>
                  {time(leg.arrive)}
                  {leg.arrive.slice(0, 10) !== leg.depart.slice(0, 10) && <sup>+{Math.round((Date.parse(leg.arrive.slice(0, 10)) - Date.parse(leg.depart.slice(0, 10))) / 86_400_000)}</sup>}
                </strong>
                <span className="muted small">
                  {leg.from}–{leg.to}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="tags">
          {offer.tags.map((t) => (
            <span key={t} className={`tag ${HIGHLIGHT_TAGS.has(t) ? "tag-hot" : ""}`}>
              {t}
            </span>
          ))}
          <button className="link-btn small" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide details" : "Details"}
          </button>
        </div>

        {open && (
          <dl className="details">
            {Object.entries(offer.details).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
            <div>
              <dt>Source</dt>
              <dd>{offer.provider}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="result-side">
        <div className="price">
          <span className="price-amount">{money(offer.price)}</span>
          <span className="muted small">{offer.priceUnit}</span>
          {offer.totalPrice.amount !== offer.price.amount && <span className="small">{money(offer.totalPrice)} total</span>}
        </div>
        <div className="result-actions">
          {saved ? (
            <span className={`status-chip status-${saved.status}`}>
              <Icon name="check" size={14} /> {saved.status === "booked" ? "Booked" : "Saved"}
            </span>
          ) : (
            <button className="btn btn-secondary" onClick={onSave}>
              <Icon name="plus" size={16} /> Save
            </button>
          )}
          {saved?.status !== "booked" && (
            <a className="btn btn-primary" href={offer.bookingUrl} target="_blank" rel="noreferrer" onClick={onBook}>
              Book <Icon name="external" size={14} />
            </a>
          )}
          <label className="compare-toggle small">
            <input type="checkbox" checked={comparing} onChange={onToggleCompare} /> Compare
          </label>
        </div>
      </div>
    </article>
  );
}
