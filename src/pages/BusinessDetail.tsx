import { Link, useParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { BookTourButton } from "../components/BookTourButton";
import { ReputationBadge } from "../components/ReputationBadge";
import { reviewStatsFor } from "../lib/reviews";
import { cancellationLabelKey } from "../lib/cancellation";
import { availabilityFor } from "../lib/availability";
import { monthsLeftInSeason, seasonLabel } from "../lib/tourAttributes";
import { useT } from "../i18n";
import { PresenceDot } from "../components/PresenceDot";
import { accessibilityKey, businessTypeKey, difficultyKey, planTierKey } from "../i18n/domain";

const today = new Date().toISOString().slice(0, 10);

export function BusinessDetail() {
  const { id } = useParams();
  const { businesses, reviews, bookings } = useAvena();
  // Every hook runs before the early return: React requires the same hooks in
  // the same order on every render.
  const t = useT();
  const business = businesses.find((b) => b.id === id);

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
        <div className="cadastur-badge">
          {t("business.cadastur", { number: business.cadastur })}
        </div>
      )}

      <div className="detail-block">
        <h3>{t("business.about")}</h3>
        <p>{business.description}</p>
      </div>

      <div className="detail-block">
        <h3>{t("business.contact")}</h3>
        <p>
          {business.email}
          {business.phone ? ` · ${business.phone}` : ""}
          {business.website ? ` · ${business.website}` : ""}
        </p>
      </div>

      {business.tours && business.tours.length > 0 && (
        <div className="detail-block">
          <h3>{t("business.tours")}</h3>
          <div className="tour-cards">
            {business.tours.map((tour) => {
              const availability = availabilityFor(tour, bookings, today);
              return (
                <div key={tour.id} className="tour-card">
                  {tour.photos && tour.photos.length > 0 && (
                    <div className="tour-photos">
                      {tour.photos.map((photo, i) => (
                        <img
                          key={i}
                          src={photo}
                          alt={`${tour.title} ${i + 1}`}
                          className="tour-photo"
                        />
                      ))}
                    </div>
                  )}
                  <div className="timeline-card-title">{tour.title}</div>
                  <div className="muted">
                    {tour.priceFrom !== undefined &&
                      `${t("common.from")} R$ ${tour.priceFrom}`}
                    {tour.durationHours !== undefined && ` · ${tour.durationHours}h`}
                  </div>
                  <div className="muted">
                    {t("business.cancellation", {
                      policy: t(cancellationLabelKey[tour.cancellationPolicy ?? "moderada"]),
                    })}
                    {tour.difficulty
                      ? ` · ${t("business.effort", { level: t(difficultyKey[tour.difficulty]).toLowerCase() })}`
                      : ""}
                  </div>
                  {seasonLabel(tour.seasonMonths) && (
                    <div className="season-note">
                      {t("business.bestSeason", {
                        season: seasonLabel(tour.seasonMonths) ?? "",
                      })}
                      {monthsLeftInSeason(tour.seasonMonths) !== null &&
                        ` · ${t(
                          monthsLeftInSeason(tour.seasonMonths) === 1
                            ? "business.seasonLeftOne"
                            : "business.seasonLeft",
                          { count: monthsLeftInSeason(tour.seasonMonths) ?? 0 }
                        )}`}
                    </div>
                  )}
                  {tour.accessibility && tour.accessibility.length > 0 && (
                    <div className="chip-row">
                      {tour.accessibility.map((a) => (
                        <span key={a} className="access-tag">
                          {t(accessibilityKey[a])}
                        </span>
                      ))}
                    </div>
                  )}
                  {availability.tracked && (
                    <div
                      className={`availability-note ${availability.remaining === 0 ? "availability-none" : ""}`}
                    >
                      {availability.remaining === 0
                        ? t("business.noSpotsToday")
                        : t("business.spotsToday", {
                            remaining: availability.remaining,
                            capacity: availability.capacity ?? 0,
                          })}
                    </div>
                  )}
                  <BookTourButton business={business} tour={tour} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.reviews.length > 0 && (
        <div className="detail-block">
          <h3>{t("business.travelerReviews")}</h3>
          <div className="review-list">
            {stats.reviews.map((r) => (
              <div key={r.id} className="review-item">
                <div className="review-item-top">
                  <strong>{r.authorName}</strong>
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
