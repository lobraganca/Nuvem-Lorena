/**
 * Taking the new version as soon as it arrives.
 *
 * The app is installable, which means a service worker keeps a copy of it on
 * the phone and answers from there — that is what makes it open offline. The
 * cost is that a page already running keeps running the old code even after
 * the new one has been downloaded and taken over: the screens on the phone are
 * the ones from the last visit, and stay that way until the person happens to
 * open the app twice.
 *
 * While the app changes several times a day, that is not acceptable — someone
 * asked to look at a fix would be looking at the version before it. So when
 * the new worker takes control, the page reloads once and comes back current.
 *
 * Once, guarded: two workers changing hands during the same visit must not put
 * the phone in a reload loop.
 */
export function reloadOnNewVersion() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}
