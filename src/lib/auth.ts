/**
 * Accounts, while there is no server.
 *
 * Everything here happens in the browser, so it protects the password against
 * someone reading the stored data — not against someone who controls the
 * device. That is a real but limited guarantee, and the sign-in screen says so
 * out loud instead of implying a cadastre that does not exist yet.
 *
 * When the backend arrives, the shape below is what moves: an account has an
 * e-mail, a name and a derived key, and never the password itself.
 */

export interface Account {
  name: string;
  email: string;
  /** PBKDF2-SHA-256 of the password, base64. The password is never stored. */
  passwordHash: string;
  salt: string;
  createdAt: string;
}

/** Password hashing needs Web Crypto, which a page opened from a file lacks. */
export function canHashPasswords(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle?.deriveBits === "function";
}

const ITERATIONS = 210_000;

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export function newSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64(bytes.buffer);
}

/**
 * PBKDF2 rather than a plain digest: a stored password must stay expensive to
 * guess even when the attacker has the whole file in front of them.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromBase64(salt) as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256
  );
  return toBase64(bits);
}

export async function verifyPassword(
  password: string,
  account: Account
): Promise<boolean> {
  const candidate = await hashPassword(password, account.salt);
  // Compared byte by byte in constant time, so the answer takes the same time
  // whether the first character is wrong or only the last one is.
  if (candidate.length !== account.passwordHash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ account.passwordHash.charCodeAt(i);
  }
  return diff === 0;
}

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export type PasswordProblem = "curta" | "sem-numero" | null;

/**
 * Deliberately modest rules. Long is what matters; a wall of requirements
 * mostly produces the same weak password with a "1!" glued to the end.
 */
export function passwordProblem(password: string): PasswordProblem {
  if (password.length < 8) return "curta";
  if (!/\d/.test(password) && password.length < 12) return "sem-numero";
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
