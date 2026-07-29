import { useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { activeBoosts } from "../lib/boosts";
import { businessTypeColor } from "../lib/categories";
import { reviewStatsFor } from "../lib/reviews";
import { ReputationBadge } from "./ReputationBadge";

/**
 * Paid placements on the traveler's first screen. Every card carries a
 * "Patrocinado" label — advertising has to be identifiable as advertising
 * (art. 36 do Código de Defesa do Consumidor).
 */
export function PromotedTours({ compact = false }: { compact?: boolean }) {
  const { boosts, businesses, reviews } = useAvena();
  const navigate = useNavigate();

  const promoted = activeBoosts(boosts)
    .map((boost) => {
      const business = businesses.find(
        (b) => b.id === boost.businessId && b.status !== "suspensa"
      );
      const tour = business?.tours?.find((t) => t.id === boost.tourId);
      return business && tour ? { boost, business, tour } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (promoted.length === 0) return null;

  if (compact) {
    return (
      <section className="promoted-compact">
        <h2 className="timeline-title">Em destaque</h2>
        {promoted.slice(0, 3).map(({ boost, business, tour }) => (
          <button
            key={boost.id}
            type="button"
            className="promoted-compact-card"
            onClick={() => navigate(`/business/${business.id}`)}
          >
            <div className="promoted-label">Patrocinado</div>
            <div className="timeline-card-title">{tour.title}</div>
            <div className="muted">
              {business.name} · {business.city}
            </div>
            {tour.priceFrom !== undefined && (
              <div className="viator-card-price">
                A partir de <strong>R$ {tour.priceFrom.toLocaleString("pt-BR")}</strong>
              </div>
            )}
          </button>
        ))}
      </section>
    );
  }

  return (
    <section className="trending-section">
      <h2 className="timeline-title">Em destaque</h2>
      <div className="viator-grid">
        {promoted.map(({ boost, business, tour }) => {
          const stats = reviewStatsFor(reviews, business.id);
          return (
            <button
              key={boost.id}
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
                <div className="promoted-label">Patrocinado</div>
                <div className="viator-card-title">{tour.title}</div>
                {tour.description && <div className="muted">{tour.description}</div>}
                <div className="muted">
                  {business.name} · {business.city}
                  {business.state ? `, ${business.state}` : ""}
                </div>
                <ReputationBadge avgRating={stats.avgRating} count={stats.count} />
                {tour.priceFrom !== undefined && (
                  <div className="viator-card-price">
                    A partir de{" "}
                    <strong>R$ {tour.priceFrom.toLocaleString("pt-BR")}</strong>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
