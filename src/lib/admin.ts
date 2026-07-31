import { cadasturRequired } from "./categories";
import type { Booking, Boost, Business, PlanTier, Review } from "../types";
import { plans } from "./plans";
import { activeBoosts, boostRevenue } from "./boosts";
import { reviewStatsFor } from "./reviews";

export interface PlanBreakdown {
  tier: PlanTier;
  count: number;
}

export interface AdminMetrics {
  businessesTotal: number;
  businessesActive: number;
  businessesSuspended: number;
  businessesVerified: number;
  withoutCadastur: number;
  planBreakdown: PlanBreakdown[];
  commissionTotal: number;
  adsTotal: number;
  totalRevenue: number;
  bookingsTotal: number;
  bookingsConfirmed: number;
  bookingsCancelled: number;
  gmv: number;
  refundedTotal: number;
  effectiveRate: number;
  activeBoostsCount: number;
  reviewsTotal: number;
  avgRatingPlatform: number;
}

export function computeAdminMetrics(
  businesses: Business[],
  bookings: Booking[],
  boosts: Boost[],
  reviews: Review[]
): AdminMetrics {
  const suspended = businesses.filter((b) => b.status === "suspensa");
  const active = businesses.filter((b) => b.status !== "suspensa");

  // A headcount per tier, not a bill. Joining is free, so multiplying these
  // by a monthly price produced revenue that nobody was ever charged — and it
  // was the first number on the first screen of this panel.
  const planBreakdown: PlanBreakdown[] = plans.map((plan) => ({
    tier: plan.tier,
    count: active.filter((b) => b.planTier === plan.tier).length,
  }));

  const confirmed = bookings.filter((b) => b.status === "confirmada");
  const cancelled = bookings.filter((b) => b.status === "cancelada");

  // Commission is only earned on bookings that were not cancelled.
  const commissionTotal =
    Math.round(confirmed.reduce((s, b) => s + b.serviceFee, 0) * 100) / 100;
  const gmv = Math.round(confirmed.reduce((s, b) => s + b.totalPrice, 0) * 100) / 100;
  const refundedTotal =
    Math.round(cancelled.reduce((s, b) => s + (b.refundAmount ?? 0), 0) * 100) / 100;

  const adsTotal = boostRevenue(boosts);

  const ratingSum = reviews.reduce((s, r) => s + r.rating, 0);

  return {
    businessesTotal: businesses.length,
    businessesActive: active.length,
    businessesSuspended: suspended.length,
    businessesVerified: businesses.filter((b) => b.verified).length,
    withoutCadastur: businesses.filter(
      (b) => !b.cadastur && cadasturRequired(b.type)
    ).length,
    planBreakdown,
    commissionTotal,
    adsTotal,
    totalRevenue: Math.round((commissionTotal + adsTotal) * 100) / 100,
    bookingsTotal: bookings.length,
    bookingsConfirmed: confirmed.length,
    bookingsCancelled: cancelled.length,
    gmv,
    refundedTotal,
    effectiveRate: gmv > 0 ? Math.round((commissionTotal / gmv) * 1000) / 10 : 0,
    activeBoostsCount: activeBoosts(boosts).length,
    reviewsTotal: reviews.length,
    avgRatingPlatform: reviews.length
      ? Math.round((ratingSum / reviews.length) * 10) / 10
      : 0,
  };
}

export interface BusinessRow {
  business: Business;
  bookings: number;
  gmv: number;
  commission: number;
  adSpend: number;
  avgRating: number;
  reviewCount: number;
  /** Signals that need the admin's attention. */
  flags: string[];
}

export function buildBusinessRows(
  businesses: Business[],
  bookings: Booking[],
  boosts: Boost[],
  reviews: Review[]
): BusinessRow[] {
  return businesses
    .map((business) => {
      const own = bookings.filter(
        (b) => b.businessId === business.id && b.status === "confirmada"
      );
      const stats = reviewStatsFor(reviews, business.id);
      const requiresCadastur = cadasturRequired(business.type);

      const flags: string[] = [];
      if (requiresCadastur && !business.cadastur) flags.push("Sem Cadastur");
      if (stats.count >= 3 && stats.avgRating < 3) flags.push("Reputação baixa");
      if (business.status === "suspensa") flags.push("Suspensa");

      return {
        business,
        bookings: own.length,
        gmv: Math.round(own.reduce((s, b) => s + b.totalPrice, 0) * 100) / 100,
        commission:
          Math.round(own.reduce((s, b) => s + b.serviceFee, 0) * 100) / 100,
        adSpend: boostRevenue(boosts.filter((b) => b.businessId === business.id)),
        avgRating: stats.avgRating,
        reviewCount: stats.count,
        flags,
      };
    })
    .sort((a, b) => b.commission - a.commission);
}
