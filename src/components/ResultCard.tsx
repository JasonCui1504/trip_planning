import { useState } from "react";
import type { Offer, TripItem } from "../../shared/types.ts";
import { duration, money, shortDate, time } from "../format.ts";
import { CATEGORY_ICON, Icon } from "../icons.tsx";

export function Thumb({ hue = 180, category, imageUrl }: { hue?: number; category: Offer["category"] | "custom"; imageUrl?: string }) {
  const [broken, setBroken] = useState(false);
  if (imageUrl && !broken) return <img className="thumb" src={imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return (
    <div className="thumb" style={{ background: `linear-gradient(135deg, hsl(${hue} 28% 34%), hsl(${(hue + 40) % 360} 32% 20%))` }}>
      <Icon name={CATEGORY_ICON[category]} size={22} />
    </div>
  );
}

const HIGHLIGHT_TAGS = new Set(["Cheapest", "Fastest", "Best value", "Google best", "Likely to sell out", "Local favourite"]);

export function ResultCard({ offer, saved, comparing, watching, onSave, onBook, onToggleCompare, onWatch }: { offer: Offer; saved?: TripItem; comparing: boolean; watching: boolean; onSave: () => void; onBook: () => void; onToggleCompare: () => void; onWatch: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <article className={`result card ${comparing ? "is-comparing" : ""}`}>
      <Thumb hue={offer.imageHue} category={offer.category} imageUrl={offer.imageUrl} />
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
            <span key={t} className={`tag ${t.startsWith("Chase Edit") ? "tag-edit" : HIGHLIGHT_TAGS.has(t) ? "tag-hot" : ""}`}>
              {t}
            </span>
          ))}
          <button className="link-btn small" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide details" : "Details"}
          </button>
        </div>

        {offer.priceSources && offer.priceSources.length > 0 && (
          <div className="price-sources small">
            <span className="muted">Prices by site (whole stay):</span>
            {offer.priceSources.slice(0, 6).map((p, i) => (
              <a key={p.source} className={`price-source ${i === 0 ? "lowest" : ""}`} href={p.link ?? offer.bookingUrl} target="_blank" rel="noreferrer" title={p.freeCancellation ? "Free cancellation" : undefined}>
                {p.source} <strong>{money({ amount: p.amount, currency: offer.totalPrice.currency })}</strong>
              </a>
            ))}
          </div>
        )}

        {offer.altLinks && offer.altLinks.length > 1 && (
          <p className="alt-links small">
            <span className="muted">Also check:</span>
            {offer.altLinks.slice(1).map((l) => (
              <a key={l.label} href={l.url} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ))}
          </p>
        )}

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
          {(offer.category === "flights" || offer.category === "hotels" || offer.category === "cars") && (
            <button className={`btn btn-ghost btn-sm ${watching ? "is-watching" : ""}`} onClick={onWatch} disabled={watching} title="Re-check this price every day on the Price watch dashboard">
              <Icon name="eye" size={14} /> {watching ? "Watching" : "Watch price"}
            </button>
          )}
          <label className="compare-toggle small">
            <input type="checkbox" checked={comparing} onChange={onToggleCompare} /> Compare
          </label>
        </div>
      </div>
    </article>
  );
}
