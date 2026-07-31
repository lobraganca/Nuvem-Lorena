/**
 * Opening the app as if for the first time.
 *
 * Everything the app knows lives in this browser, so the second visit is never
 * the first one again — which makes it impossible to walk through the entrance,
 * the account and the onboarding while testing. This clears that, and only when
 * the address says so out loud.
 *
 * It runs before React so no screen ever reads the old data, and it is
 * destructive by design: on a real phone with real memories it would erase
 * them, which is why it is a deliberate address and not a button. It also
 * strips itself out of the URL, so a reload does not wipe the fresh start.
 */
import { removeStored } from "./safeStorage";

/** Every key the app writes. Kept together so nothing survives by omission. */
const ALL_KEYS = [
  "avena-data-v19",
  "avena-account",
  "avena-session",
  "avena-phone-pending",
  "avena-cookie-consent",
  "avena-app-offer-dismissed",
  "avena-lang",
];

const FLAG = "recomecar";

export function startOverIfAsked() {
  if (typeof window === "undefined") return;

  // Works with either router: BrowserRouter keeps the query in the search,
  // HashRouter pushes it after the '#'.
  const inSearch = new URLSearchParams(window.location.search).get(FLAG);
  const hashQuery = window.location.hash.split("?")[1] ?? "";
  const inHash = new URLSearchParams(hashQuery).get(FLAG);
  if (inSearch !== "1" && inHash !== "1") return;

  for (const key of ALL_KEYS) removeStored(key);
  try {
    // Anything else this app wrote, including keys added later.
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("avena")) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage is unavailable; the removeStored calls above already covered
    // the in-memory copy, which is all there is in that case.
  }

  window.history.replaceState({}, "", window.location.pathname);
}
