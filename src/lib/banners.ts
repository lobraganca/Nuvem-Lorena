import type { Banner, BannerPlacement } from "../types";

export const bannerPlacements: BannerPlacement[] = [
  "home-top",
  "destination-top",
  "feed-top",
  "bookings-top",
  "wishlist-top",
];

export const placementLabel: Record<BannerPlacement, string> = {
  "home-top": "Topo da tela inicial",
  "destination-top": "Topo da busca de destinos",
  "feed-top": "Topo do feed de quem você segue",
  "bookings-top": "Topo das minhas reservas",
  "wishlist-top": "Topo da lista de desejos",
};

/**
 * The responsible-tourism banner ships with the app rather than being seeded
 * into storage, so it cannot be lost by a restore and its text follows the
 * chosen language.
 */
export const RESPONSIBLE_TOURISM_BANNER: Banner = {
  id: "banner-turismo-responsavel",
  placement: "home-top",
  kind: "institucional",
  title: "",
  text: "",
  translationKey: "responsible",
  active: true,
};

/** A banner is live when it is active and today falls inside its window. */
export function isBannerLive(banner: Banner, today = new Date().toISOString().slice(0, 10)): boolean {
  if (!banner.active) return false;
  if (banner.startsAt && banner.startsAt > today) return false;
  if (banner.endsAt && banner.endsAt < today) return false;
  return true;
}

export function bannersFor(banners: Banner[], placement: BannerPlacement): Banner[] {
  return banners.filter((b) => b.placement === placement && isBannerLive(b));
}
