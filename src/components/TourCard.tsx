import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { isTourWished } from "../lib/wishlist";
import { businessTypeColor } from "../lib/categories";
import { formatBRL } from "../lib/money";
import { isStay } from "../lib/stays";
import { newId } from "../lib/ids";
import { useT } from "../i18n";
import type { Business, Tour } from "../types";

/**
 * A tour as a listing card: photo first, then where it is, then what it costs.
 *
 * The heart is the want-to-do list, in the place people already look for it.
 * A tour with no photo falls back to a flat colour from the brand's own set
 * rather than to a grey box — an empty card still has to look deliberate.
 */
export function TourCard({ business, tour }: { business: Business; tour: Tour }) {
  const { wishlist, addWish, removeWish, reviews } = useAvena();
  const t = useT();

  const photo = tour.photos?.[0];
  const wished = isTourWished(wishlist, tour.id);
  const existing = wishlist.find((w) => w.tourId === tour.id && !w.doneAt);
  const isNew = !reviews.some((r) => r.businessId === business.id);

  function toggleWish(e: React.MouseEvent) {
    // The heart sits inside a link, so it has to stop the navigation itself.
    e.preventDefault();
    e.stopPropagation();
    if (existing) {
      removeWish(existing.id);
      return;
    }
    addWish({
      id: newId(),
      tourId: tour.id,
      businessId: business.id,
      title: tour.title,
      businessName: business.name,
      city: business.city,
      state: business.state,
      priceFrom: tour.priceFrom,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <Link to={`/tour/${business.id}/${tour.id}`} className="listing-card">
      <div
        className={`listing-card-media ${photo ? "" : "listing-card-media-empty"}`}
        style={photo ? undefined : { background: businessTypeColor[business.type] }}
      >
        {photo && <img src={photo} alt={tour.title} className="listing-card-img" />}
        <button
          type="button"
          className={`listing-card-heart ${wished ? "listing-card-heart-on" : ""}`}
          onClick={toggleWish}
          aria-pressed={wished}
          aria-label={t(wished ? "wish.saved" : "wish.add")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20.7 4.3 13a5 5 0 0 1 7.1-7l.6.6.6-.6a5 5 0 1 1 7.1 7L12 20.7z" />
          </svg>
        </button>
      </div>

      <div className="listing-card-body">
        <div className="listing-card-place">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="listing-card-pin">
            <path
              fill="currentColor"
              d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"
            />
          </svg>
          {t("card.in", { city: business.city })}
        </div>
        <div className="listing-card-title">{tour.title}</div>
        <div className="listing-card-foot">
          <span className="listing-card-price">
            {tour.priceFrom !== undefined
              ? t(isStay(tour) ? "card.perNight" : "card.perPerson", {
                  price: formatBRL(tour.priceFrom),
                })
              : t("card.askPrice")}
          </span>
          {isNew && <span className="listing-card-new">{t("card.new")}</span>}
        </div>
      </div>
    </Link>
  );
}
