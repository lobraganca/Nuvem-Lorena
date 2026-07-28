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
