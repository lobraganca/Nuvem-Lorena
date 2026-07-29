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

export type ReputationKey =
  | "reputation.none"
  | "reputation.few"
  | "reputation.excellent"
  | "reputation.veryGood"
  | "reputation.good"
  | "reputation.average"
  | "reputation.poor";

export function reputationLabelKey(avgRating: number): ReputationKey {
  if (avgRating === 0) return "reputation.none";
  if (avgRating >= 4.5) return "reputation.excellent";
  if (avgRating >= 4) return "reputation.veryGood";
  if (avgRating >= 3) return "reputation.good";
  if (avgRating >= 2) return "reputation.average";
  return "reputation.poor";
}

export interface Reputation {
  labelKey: ReputationKey;
  /** True when there are too few reviews for the average to mean anything. */
  provisional: boolean;
}

export function reputationFor(avgRating: number, count: number): Reputation {
  if (count === 0) return { labelKey: "reputation.none", provisional: true };
  if (count < MIN_REVIEWS_FOR_LABEL) {
    return { labelKey: "reputation.few", provisional: true };
  }
  return { labelKey: reputationLabelKey(avgRating), provisional: false };
}
