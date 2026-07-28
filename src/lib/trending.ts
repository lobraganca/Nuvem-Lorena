import type { Booking, Business, Experience, Review, Tour } from "../types";
import { reviewStatsFor } from "./reviews";

export interface TrendingTour {
  business: Business;
  tour: Tour;
  bookingCount: number;
  avgRating: number;
  reviewCount: number;
}

export interface TrendingPlace {
  city: string;
  state?: string;
  count: number;
}

export function topTours(
  businesses: Business[],
  bookings: Booking[],
  reviews: Review[],
  limit = 4
): TrendingTour[] {
  const scored: TrendingTour[] = [];

  for (const business of businesses) {
    for (const tour of business.tours ?? []) {
      const bookingCount = bookings.filter((b) => b.tourId === tour.id).length;
      const stats = reviewStatsFor(reviews, business.id);
      scored.push({
        business,
        tour,
        bookingCount,
        avgRating: stats.avgRating,
        reviewCount: stats.count,
      });
    }
  }

  return scored
    .sort((a, b) => {
      const scoreA = a.bookingCount * 10 + a.avgRating * a.reviewCount;
      const scoreB = b.bookingCount * 10 + b.avgRating * b.reviewCount;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

export function topPlaces(
  experiences: Experience[],
  businesses: Business[],
  limit = 6
): TrendingPlace[] {
  const counts = new Map<string, TrendingPlace>();

  function bump(city: string, state?: string) {
    const key = city;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { city, state, count: 1 });
    }
  }

  for (const exp of experiences) bump(exp.city, exp.state);
  for (const b of businesses) bump(b.city, b.state);

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
