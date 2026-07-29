import { useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { topPlaces, topTours } from "../lib/trending";
import { ReputationBadge } from "./ReputationBadge";
import { businessTypeColor } from "../lib/categories";
import { formatBRL } from "../lib/money";
import { useT } from "../i18n";
import { businessTypeKey } from "../i18n/domain";

export function TrendingSection() {
  const t = useT();
  const { businesses, bookings, reviews, experiences } = useAvena();
  const navigate = useNavigate();

  const visible = businesses.filter((b) => b.status !== "suspensa");
  const tours = topTours(visible, bookings, reviews, 4);
  const places = topPlaces(
    experiences.filter((e) => e.country === "Brasil"),
    visible.filter((b) => b.country === "Brasil"),
    6
  );

  if (tours.length === 0 && places.length === 0) return null;

  return (
    <section className="trending-section">
      {tours.length > 0 && (
        <>
          <h2 className="timeline-title">{t("trending.tours")}</h2>
          <div className="viator-grid">
            {tours.map(({ business, tour, avgRating, reviewCount }) => (
              <button
                key={tour.id}
                type="button"
                className="viator-card trending-tour-card"
                onClick={() => navigate(`/business/${business.id}`)}
              >
                <div
                  className="viator-card-media"
                  style={{ background: businessTypeColor[business.type] }}
                >
                  <span className="viator-card-media-label">{t(businessTypeKey[business.type])}</span>
                </div>
                <div className="viator-card-body">
                  <div className="viator-card-title">{tour.title}</div>
                  <div className="muted">
                    {business.name} · {business.city}
                    {business.state ? `, ${business.state}` : ""}
                  </div>
                  <ReputationBadge avgRating={avgRating} count={reviewCount} />
                  {tour.priceFrom !== undefined && (
                    <div className="viator-card-price">
                      {t("common.from")} <strong>R$ {formatBRL(tour.priceFrom)}</strong>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {places.length > 0 && (
        <>
          <h2 className="timeline-title">{t("trending.places")}</h2>
          <div className="trending-places-row">
            {places.map((p) => (
              <button
                key={p.city}
                type="button"
                className="trending-place-card"
                onClick={() => navigate(`/destination?city=${encodeURIComponent(p.city)}`)}
              >
                <div className="timeline-card-title">{p.city}</div>
                <div className="muted">
                  {p.state ? `${p.state} · ` : ""}
                  {t(p.count === 1 ? "trending.mentionOne" : "trending.mentions", { count: p.count })}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
