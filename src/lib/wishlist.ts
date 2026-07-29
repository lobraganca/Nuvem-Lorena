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

/** Partners already on Avena in the city of a wish, so it can be acted on. */
export function partnersForWish(
  wish: WishlistItem,
  businesses: Business[]
): Business[] {
  if (!wish.city) return [];
  const city = wish.city.toLowerCase();
  return businesses.filter(
    (b) => b.status !== "suspensa" && b.city.toLowerCase() === city
  );
}

export interface WantedDestination {
  city: string;
  state?: string;
  wishes: number;
  /** How many partners Avena already has there. */
  partners: number;
}

/**
 * Where travellers want to go, and whether Avena has anyone to sell it.
 *
 * A city with many wishes and no partner is the clearest prospecting list the
 * platform can produce: demand that already exists and nobody to serve it.
 */
export function wantedDestinations(
  wishlist: WishlistItem[],
  businesses: Business[]
): WantedDestination[] {
  const byCity = new Map<string, WantedDestination>();

  for (const wish of wishlist) {
    if (!wish.city) continue;
    const key = wish.city.toLowerCase();
    const existing = byCity.get(key);
    if (existing) {
      existing.wishes += 1;
    } else {
      byCity.set(key, {
        city: wish.city,
        state: wish.state,
        wishes: 1,
        partners: businesses.filter(
          (b) => b.status !== "suspensa" && b.city.toLowerCase() === key
        ).length,
      });
    }
  }

  return [...byCity.values()].sort((a, b) => {
    // Unserved demand first: that is where a new partner is worth the most.
    if (a.partners === 0 && b.partners > 0) return -1;
    if (b.partners === 0 && a.partners > 0) return 1;
    return b.wishes - a.wishes;
  });
}
