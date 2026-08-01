import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { ReputationBadge } from "../components/ReputationBadge";
import { reviewStatsFor } from "../lib/reviews";
import { useT } from "../i18n";
import { PresenceDot } from "../components/PresenceDot";
import { MeetingPoint } from "../components/MeetingPoint";
import { TourCard } from "../components/TourCard";
import { canSeeContact } from "../lib/contactVisibility";
import { responseTimeFor, responseTimeLabel } from "../lib/responseTime";
import { businessTypeKey, planTierKey } from "../i18n/domain";


export function BusinessDetail() {
  const { id } = useParams();
  const { businesses, reviews, bookings, messages } = useAvena();
  // Every hook runs before the early return: React requires the same hooks in
  // the same order on every render.
  const t = useT();
  const business = businesses.find((b) => b.id === id);
  // Contato direto só para quem já reservou. Ver lib/contactVisibility.ts.
  const mostrarContato = business ? canSeeContact(business, bookings) : false;
  const tempoDeResposta = business ? responseTimeFor(messages, business.id) : null;

  if (!business) return <div className="page">{t("common.notFound")}</div>;

  const stats = reviewStatsFor(reviews, business.id);

  return (
    <div className="page">
      <Link to="/business" className="back-link">
        ← {t("common.back")}
      </Link>
      <div className="business-header">
        <h1>{business.name}</h1>
        <span className={`plan-badge plan-badge-${business.planTier.toLowerCase()}`}>
          {t(planTierKey[business.planTier])}
        </span>
        <PresenceDot business={business} />
        <Link to={`/messages/${business.id}`} className="btn-outline">
          {t("business.sendMessage")}
        </Link>
      </div>
      <p className="muted">
        {t(businessTypeKey[business.type])} · {business.city}
        {business.state ? `, ${business.state}` : ""} — {business.country}
      </p>
      <div style={{ margin: "8px 0" }}>
        <ReputationBadge avgRating={stats.avgRating} count={stats.count} />
        {stats.count > 0 && (
          <span className="muted"> · {t("business.recommendPct", { pct: stats.recommendPct })}</span>
        )}
      </div>

      {business.status === "suspensa" && (
        <div className="insight-card">
          {t("business.suspended")}
        </div>
      )}

      {business.claimStatus === "nao-reivindicada" && (
        <div className="insight-card">
          <strong>{t("business.unclaimedTitle")}</strong>
          <p className="muted">{t("business.unclaimedText")}</p>
        </div>
      )}

      {business.verified && (
        <div className="cadastur-badge">
          {t("business.verified")}
        </div>
      )}

      {business.cadastur && (
        <>
          <div className="cadastur-badge">
            {t("business.cadastur", { number: business.cadastur })}
          </div>
          {/* The badge used to say "registered with the Ministry of Tourism",
              which reads as a check Avena never made. Saying who provided the
              number costs one line and keeps the platform honest. */}
          <p className="muted cadastur-note">{t("business.cadasturUnverified")}</p>
        </>
      )}

      <div className="detail-block">
        <h3>{t("business.about")}</h3>
        <p>{business.description}</p>
      </div>

      <div className="detail-block">
        <h3>{t("business.contact")}</h3>
        {mostrarContato ? (
          <p>
            {business.email}
            {business.phone ? ` · ${business.phone}` : ""}
            {business.website ? ` · ${business.website}` : ""}
          </p>
        ) : (
          <>
            <p className="muted">Contato liberado depois da reserva.</p>
            <Link to={`/messages/${business.id}`} className="btn-outline">
              {t("business.sendMessage")}
            </Link>
          </>
        )}
      </div>

      {tempoDeResposta && (
        <p className="muted">{responseTimeLabel(tempoDeResposta)}</p>
      )}

      <MeetingPoint business={business} />

      {business.tours && business.tours.length > 0 && (
        <div className="detail-block">
          <h3>{t("business.tours")}</h3>
          {/* Cartões que levam à página do passeio. O que estava aqui era
              cada passeio aberto por inteiro — preço, vagas, temporada,
              acessibilidade e um formulário de reserva — empilhados numa
              página só: quem queria um passeio tinha de achá-lo no meio dos
              outros seis e depois desviar deles. */}
          <div className="card-rail">
            {business.tours.filter((tour) => !tour.paused).map((tour) => (
              <TourCard key={tour.id} business={business} tour={tour} />
            ))}
          </div>
        </div>
      )}

      {stats.reviews.length > 0 && (
        <div className="detail-block">
          <h3>{t("business.travelerReviews")}</h3>
          <p className="muted">{t("review.verifiedHint")}</p>
          <div className="review-list">
            {stats.reviews.map((r) => (
              <div key={r.id} className="review-item">
                <div className="review-item-top">
                  <strong>{r.authorName}</strong>
                  <span className="verified-review">{t("review.verified")}</span>
                  <span className="star-rating" aria-label={`Nota ${r.rating} de 5`}>
                    {"★".repeat(r.rating)}
                  </span>
                  <span className="muted">{t(r.recommends ? "business.recommends" : "business.doesNotRecommend")}</span>
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
