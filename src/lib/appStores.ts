/**
 * Where the app lives in each store.
 *
 * Empty until it is actually published. The badges read this: with no address
 * they render as "coming soon" instead of as a link that goes nowhere, because
 * a store button that 404s costs more trust than an honest wait.
 *
 * To go live, paste the address the store gives you and nothing else changes:
 *
 *   Google Play  https://play.google.com/store/apps/details?id=br.com.avenaapp
 *   App Store    https://apps.apple.com/br/app/avena/id0000000000
 */
export const PLAY_STORE_URL = "";
export const APP_STORE_URL = "";

export type StoreName = "play" | "apple";

export function storeUrl(store: StoreName): string {
  return store === "play" ? PLAY_STORE_URL : APP_STORE_URL;
}

export function isStoreLive(store: StoreName): boolean {
  return storeUrl(store).startsWith("https://");
}

/** True once at least one store has the app, so the page can change its tune. */
export function anyStoreLive(): boolean {
  return isStoreLive("play") || isStoreLive("apple");
}
