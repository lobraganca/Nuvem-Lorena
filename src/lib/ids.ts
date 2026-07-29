/**
 * A unique id that works everywhere.
 *
 * `crypto.randomUUID` only exists in a secure context, so it is missing when
 * the app is opened straight from a file — exactly how the single-file build
 * is shared. Calling it there throws and takes the screen down with it. The
 * fallback is not cryptographic, and does not need to be: these ids only have
 * to be distinct inside one device's data.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const random = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random()}-${random()}`;
}
