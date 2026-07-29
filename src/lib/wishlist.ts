import type { Business, WishlistItem } from "../types";

/** A wish is "open" until the traveller says they did it. */
export function openWishes(wishlist: WishlistItem[]): WishlistItem[] {
  return wishlist
    .filter((w) => !w.doneAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function doneWishes(wishlist: WishlistItem[]): WishlistItem[] {
  return wishlist
    .filter((w) => w.doneAt)
    .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
}

export function isTourWished(wishlist: WishlistItem[], tourId: string): boolean {
  return wishlist.some((w) => w.tourId === tourId && !w.doneAt);
}

export interface WantedTour {
  tourId: string;
  title: string;
  businessId: string;
  businessName: string;
  city?: string;
  state?: string;
  wishes: number;
}

/**
 * The published tours travellers marked as "quero fazer", most wanted first.
 *
 * Every wish points at a tour that already exists in a business record, so this
 * measures interest in the catalogue as it stands — which partner to push, which
 * date to open — not demand for places nobody sells yet.
 */
export function wantedTours(wishlist: WishlistItem[]): WantedTour[] {
  const byTour = new Map<string, WantedTour>();

  for (const wish of wishlist) {
    const existing = byTour.get(wish.tourId);
    if (existing) {
      existing.wishes += 1;
      continue;
    }
    byTour.set(wish.tourId, {
      tourId: wish.tourId,
      title: wish.title,
      businessId: wish.businessId,
      businessName: wish.businessName,
      city: wish.city,
      state: wish.state,
      wishes: 1,
    });
  }

  return [...byTour.values()].sort(
    (a, b) => b.wishes - a.wishes || a.title.localeCompare(b.title)
  );
}

/**
 * True when the tour behind a wish is no longer on offer — taken down by the
 * business, or the business itself suspended.
 *
 * A wish that points at nothing has to say so. Left silent it shows a price
 * that is not for sale and leads to a page with no way to book, which reads as
 * a broken app rather than as a tour that ended.
 */
export function isWishGone(wish: WishlistItem, businesses: Business[]): boolean {
  const business = businesses.find((b) => b.id === wish.businessId);
  if (!business || business.status === "suspensa") return true;
  return !(business.tours ?? []).some((tour) => tour.id === wish.tourId);
}
