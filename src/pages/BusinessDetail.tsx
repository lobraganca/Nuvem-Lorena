import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BookTourButton } from "../components/BookTourButton";
import { ReputationBadge } from "../components/ReputationBadge";
import { reviewStatsFor } from "../lib/reviews";
import { cancellationPolicyLabel } from "../lib/cancellation";
import { availabilityFor } from "../lib/availability";

const today = new Date().toISOString().slice(0, 10);

export function BusinessDetail() {
  const { id } = useParams();
  const { businesses, reviews, bookings } = useAvena();
  const business = businesses.find((b) => b.id === id);

  if (!business) return <div className="page">Empresa não encontrada.</div>;

  const stats = reviewStatsFor(reviews, business.id);

  return (
    <div className="page">
      <Link to="/business" className="back-link">
        ← Voltar para empresas
      </Link>
      <div className="business-header">
        <h1>{business.name}</h1>
        <span className={`plan-badge plan-badge-${business.planTier.toLowerCase()}`}>
          {business.planTier}
        </span>
      </div>
      <p className="muted">
        {business.type} · {business.city}
        {business.state ? `, ${business.state}` : ""} — {business.country}
      </p>
      <div style={{ margin: "8px 0" }}>
        <ReputationBadge avgRating={stats.avgRating} count={stats.count} />
        {stats.count > 0 && (
          <span className="muted"> · {stats.recommendPct}% recomendam</span>
        )}
      </div>

      <div className="detail-block">
        <h3>Sobre</h3>
        <p>{business.description}</p>
      </div>

      <div className="detail-block">
        <h3>Contato</h3>
        <p>
          {business.email}
          {business.phone ? ` · ${business.phone}` : ""}
          {business.website ? ` · ${business.website}` : ""}
        </p>
      </div>

      {business.tours && business.tours.length > 0 && (
        <div className="detail-block">
          <h3>Passeios disponíveis</h3>
          <div className="tour-cards">
            {business.tours.map((t) => {
              const availability = availabilityFor(t, bookings, today);
              return (
                <div key={t.id} className="tour-card">
                  <div className="timeline-card-title">{t.title}</div>
                  <div className="muted">
                    {t.priceFrom !== undefined && `A partir de R$ ${t.priceFrom}`}
                    {t.durationHours !== undefined && ` · ${t.durationHours}h`}
                  </div>
                  <div className="muted">
                    Cancelamento {cancellationPolicyLabel[t.cancellationPolicy ?? "moderada"]}
                  </div>
                  {availability.tracked && (
                    <div
                      className={`availability-note ${availability.remaining === 0 ? "availability-none" : ""}`}
                    >
                      {availability.remaining === 0
                        ? "Sem vagas hoje"
                        : `${availability.remaining} de ${availability.capacity} vagas hoje`}
                    </div>
                  )}
                  <BookTourButton business={business} tour={t} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.reviews.length > 0 && (
        <div className="detail-block">
          <h3>Avaliações de viajantes</h3>
          <div className="review-list">
            {stats.reviews.map((r) => (
              <div key={r.id} className="review-item">
                <div className="review-item-top">
                  <strong>{r.authorName}</strong>
                  <span className="star-rating">{"★".repeat(r.rating)}</span>
                  <span className="muted">{r.recommends ? "Recomenda" : "Não recomenda"}</span>
                </div>
                <div className="muted">{r.tourTitle}</div>
                <p>{r.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
