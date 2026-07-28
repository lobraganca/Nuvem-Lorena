import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BookTourButton } from "../components/BookTourButton";
import { reviewStatsFor } from "../lib/reviews";

export function BusinessDetail() {
  const { id } = useParams();
  const { businesses, reviews } = useAvena();
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
      {stats.count > 0 && (
        <p>
          ⭐ {stats.avgRating} ({stats.count} {stats.count === 1 ? "avaliação" : "avaliações"}) ·{" "}
          {stats.recommendPct}% recomendam
        </p>
      )}

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
            {business.tours.map((t) => (
              <div key={t.id} className="tour-card">
                <div className="timeline-card-title">{t.title}</div>
                <div className="muted">
                  {t.priceFrom !== undefined && `A partir de R$ ${t.priceFrom}`}
                  {t.durationHours !== undefined && ` · ${t.durationHours}h`}
                </div>
                <BookTourButton business={business} tour={t} />
              </div>
            ))}
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
                  <span>{"⭐".repeat(r.rating)}</span>
                  <span className="muted">{r.recommends ? "👍 Recomenda" : "👎 Não recomenda"}</span>
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
