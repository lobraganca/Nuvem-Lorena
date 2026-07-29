import { useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { topPlaces, topTours } from "../lib/trending";
import { ReputationBadge } from "./ReputationBadge";
import { businessTypeColor } from "../lib/categories";

export function TrendingSection() {
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
          <h2 className="timeline-title">Passeios em alta</h2>
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
                  <span className="viator-card-media-label">{business.type}</span>
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
                      A partir de <strong>R$ {tour.priceFrom.toLocaleString("pt-BR")}</strong>
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
          <h2 className="timeline-title">Lugares mais procurados</h2>
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
                  {p.count} {p.count === 1 ? "menção" : "menções"}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
