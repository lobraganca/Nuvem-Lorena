import type { Boost, PlanTier } from "../types";

/** Duration options offered when boosting a tour. */
export const BOOST_PACKAGES = [3, 7, 14];

/**
 * Daily price falls with the subscription tier, so the plan a partner already
 * pays for makes advertising cheaper too.
 */
const DAILY_PRICE: Record<PlanTier, number> = {
  Básico: 9.9,
  Pro: 7.9,
  Avançado: 5.9,
};

export function boostDailyPrice(tier: PlanTier): number {
  return DAILY_PRICE[tier];
}

export function boostPrice(tier: PlanTier, days: number): number {
  return Math.round(boostDailyPrice(tier) * days * 100) / 100;
}

export function isBoostActive(boost: Boost, now = new Date()): boolean {
  return new Date(boost.startsAt) <= now && now < new Date(boost.endsAt);
}

export function activeBoosts(boosts: Boost[], now = new Date()): Boost[] {
  return boosts.filter((b) => isBoostActive(b, now));
}

/** Active boost for a given tour, if any. */
export function activeBoostForTour(
  boosts: Boost[],
  tourId: string,
  now = new Date()
): Boost | undefined {
  return boosts.find((b) => b.tourId === tourId && isBoostActive(b, now));
}

export function boostRevenue(boosts: Boost[]): number {
  return Math.round(boosts.reduce((sum, b) => sum + b.pricePaid, 0) * 100) / 100;
}
