/**
 * Where a business signs up.
 *
 * Inside the installed app this opens the website in the browser instead of a
 * screen, and the reason is money rather than taste: Apple and Google take
 * 15–30% of anything sold inside an app, and the joining fee a partner pays is
 * exactly that kind of sale. Sending them to the web keeps the whole fee, and
 * is what every marketplace of this shape does — the traveller side stays in
 * the app, the seller side lives on the site.
 *
 * It also fits the work: registering a business means Cadastur, documents,
 * photos and a payment account. That is a desktop job, not a phone job.
 *
 * In a plain browser tab there is nothing to gain by bouncing the person out,
 * so the in-app route is used. Set the address once the partner site exists at
 * its own URL; while it is empty, everything stays in-app and nothing breaks.
 */
export const PARTNER_SITE_URL = "";

/**
 * True when running as an installed app rather than a browser tab — which is
 * where the store's cut would apply.
 */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS uses its own flag rather than the standard media query.
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

/** The address to send a business to, or null when it should stay in-app. */
export function partnerSignupUrl(): string | null {
  if (!PARTNER_SITE_URL.startsWith("https://")) return null;
  return isInstalledApp() ? PARTNER_SITE_URL : null;
}
