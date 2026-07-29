import { Link } from "react-router-dom";
import { ReputationBadge } from "./ReputationBadge";
import { reviewStatsFor } from "../lib/reviews";
import { businessTypeColor } from "../lib/categories";
import type { Business, Review } from "../types";
import { formatBRL } from "../lib/money";

function lowestPrice(business: Business): number | undefined {
  const prices = (business.tours ?? [])
    .map((t) => t.priceFrom)
    .filter((p): p is number => p !== undefined);
  return prices.length ? Math.min(...prices) : undefined;
}

export function BusinessCard({
  business,
  reviews,
}: {
  business: Business;
  reviews: Review[];
}) {
  const stats = reviewStatsFor(reviews, business.id);
  const price = lowestPrice(business);
  const cover = (business.tours ?? []).flatMap((t) => t.photos ?? [])[0];

  return (
    <Link to={`/business/${business.id}`} className="viator-card">
      <div
        className="viator-card-media"
        style={cover ? undefined : { background: businessTypeColor[business.type] }}
      >
        {cover && (
          <img src={cover} alt={`Passeio de ${business.name}`} className="viator-card-img" />
        )}
        <span className="viator-card-media-label">{business.type}</span>
      </div>
      <div className="viator-card-body">
        <span className={`plan-badge plan-badge-${business.planTier.toLowerCase()}`}>
          {business.planTier}
        </span>
        <div className="viator-card-title">{business.name}</div>
        <div className="muted">
          {business.city}
          {business.state ? `, ${business.state}` : ""}
        </div>
        <ReputationBadge avgRating={stats.avgRating} count={stats.count} />
        {price !== undefined && (
          <div className="viator-card-price">
            A partir de <strong>R$ {formatBRL(price)}</strong>
          </div>
        )}
      </div>
    </Link>
  );
}
