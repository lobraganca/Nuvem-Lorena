import type { Review } from "../types";

export function reviewStatsFor(reviews: Review[], businessId: string) {
  const businessReviews = reviews.filter((r) => r.businessId === businessId);
  const count = businessReviews.length;
  const avgRating = count
    ? Math.round((businessReviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
    : 0;
  const recommendPct = count
    ? Math.round((businessReviews.filter((r) => r.recommends).length / count) * 100)
    : 0;

  return { count, avgRating, recommendPct, reviews: businessReviews };
}

/**
 * Below this many reviews an average says almost nothing: a single 5-star
 * review would otherwise let a brand-new agency display "Excelente".
 */
export const MIN_REVIEWS_FOR_LABEL = 3;

export function reputationLabel(avgRating: number): string {
  if (avgRating === 0) return "Sem avaliações";
  if (avgRating >= 4.5) return "Excelente";
  if (avgRating >= 4) return "Muito bom";
  if (avgRating >= 3) return "Bom";
  if (avgRating >= 2) return "Regular";
  return "Ruim";
}

export interface Reputation {
  label: string;
  /** True when there are too few reviews for the average to mean anything. */
  provisional: boolean;
}

export function reputationFor(avgRating: number, count: number): Reputation {
  if (count === 0) return { label: "Sem avaliações ainda", provisional: true };
  if (count < MIN_REVIEWS_FOR_LABEL) {
    return { label: "Poucas avaliações", provisional: true };
  }
  return { label: reputationLabel(avgRating), provisional: false };
}
