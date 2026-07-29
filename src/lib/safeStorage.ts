/**
 * localStorage that cannot take the app down with it.
 *
 * Reading `window.localStorage` throws outright in more situations than one
 * would expect: a page opened straight from a file, private browsing on some
 * versions of Safari, storage blocked by the browser's privacy settings, an
 * embedded webview. An unguarded `localStorage.getItem` at start-up turns any
 * of those into a blank white screen, which is the worst possible failure —
 * nothing works and nothing explains why.
 *
 * So every access goes through here, and when the browser refuses, the app
 * falls back to memory: it runs normally for the session and only loses the
 * data when the tab closes. `storageAvailable` lets the interface say so.
 */

const memory = new Map<string, string>();
let available: boolean | null = null;

function probe(): boolean {
  if (available !== null) return available;
  try {
    const key = "__avena_probe__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

/** False when the browser refuses to store anything, so nothing will persist. */
export function storageAvailable(): boolean {
  return probe();
}

export function readStored(key: string): string | null {
  if (!probe()) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

/** Returns false when the value could not be persisted, so callers can warn. */
export function writeStored(key: string, value: string): boolean {
  memory.set(key, value);
  if (!probe()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    // Almost always the quota, hit by photos.
    return false;
  }
}

export function removeStored(key: string): void {
  memory.delete(key);
  if (!probe()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do: it is already gone as far as this session is concerned.
  }
}
