/**
 * Confirming that the phone number belongs to whoever is holding the phone.
 *
 * The shape is the one every app uses: type the number, receive a six-digit
 * code, type it back. What matters is *where the code is compared*, and that
 * is the whole reason this file exists as a seam.
 *
 * With a server (VITE_SMS_ENDPOINT set), the code is generated on the server,
 * delivered by SMS, and checked on the server. The browser never sees it. That
 * is a real proof: only someone holding the SIM can answer.
 *
 * Without a server, there is no way to send an SMS and nowhere to keep a
 * secret — anything this file generates lives in the same browser that is
 * being asked to prove itself, so it proves nothing. Rather than pretend, the
 * local mode is labelled "teste" everywhere it is recorded, so a number
 * confirmed in test mode can never later be mistaken for a verified one. When
 * the server arrives, those numbers must be confirmed again.
 *
 * Every rule below (expiry, attempt limit, resend cooldown, hourly cap) is
 * enforced here AND has to be enforced again on the server: a limit that lives
 * only in the browser is a limit anyone can delete with the developer tools.
 * They are here so the screen behaves correctly, not because they defend
 * anything.
 */
import { onlyDigits } from "./documents";
import { readStored, removeStored, writeStored } from "./safeStorage";

/** Where the server that sends the SMS lives. Empty until it exists. */
const SMS_ENDPOINT = (import.meta.env.VITE_SMS_ENDPOINT as string | undefined) ?? "";

export function hasSmsServer(): boolean {
  return SMS_ENDPOINT.startsWith("https://");
}

/** How the number was confirmed — and therefore how much it is worth. */
export type VerificationLevel = "servidor" | "teste";

export const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 3;

export type SendFailure =
  | "telefone-invalido"
  | "espere"
  | "muitos-envios"
  | "sem-rede";

export type SendResult =
  | {
      ok: true;
      /** Seconds until "resend" becomes available. */
      resendInSeconds: number;
      /**
       * Only ever set in test mode, where there is no SMS to receive. The
       * screen shows it and says plainly that it is not a real check.
       */
      testCode?: string;
    }
  | { ok: false; reason: SendFailure; resendInSeconds?: number };

export type ConfirmFailure = "codigo-errado" | "expirado" | "muitas-tentativas" | "sem-rede";

export type ConfirmResult =
  | { ok: true; level: VerificationLevel }
  | { ok: false; reason: ConfirmFailure; attemptsLeft?: number };

/** A Brazilian mobile number: two digits of area code plus nine digits. */
export function isSendablePhone(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  // Area codes run from 11 to 99, and mobiles begin with 9.
  if (Number(digits.slice(0, 2)) < 11) return false;
  return digits[2] === "9";
}

/** The number as the server should see it: +55 and eleven digits. */
export function e164(value: string): string {
  return `+55${onlyDigits(value)}`;
}

/**
 * What the current pending code looks like. In test mode it holds the code
 * itself, which is exactly why test mode proves nothing.
 */
interface Pending {
  phone: string;
  code?: string;
  expiresAt: number;
  attempts: number;
  sentAt: number;
  /** Timestamps of the sends in the last hour, for the cap. */
  history: number[];
}

const PENDING_KEY = "avena-phone-pending";

function loadPending(): Pending | null {
  const raw = readStored(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Pending;
  } catch {
    return null;
  }
}

function savePending(p: Pending | null) {
  if (p) writeStored(PENDING_KEY, JSON.stringify(p));
  else removeStored(PENDING_KEY);
}

function secondsUntil(at: number): number {
  return Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

function newCode(): string {
  const digits = new Uint8Array(CODE_LENGTH);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(digits);
  } else {
    for (let i = 0; i < CODE_LENGTH; i++) digits[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(digits, (d) => String(d % 10)).join("");
}

/** Seconds left on the resend cooldown for a number, or 0. */
export function resendWaitSeconds(phone: string): number {
  const pending = loadPending();
  if (!pending || pending.phone !== e164(phone)) return 0;
  return secondsUntil(pending.sentAt + RESEND_COOLDOWN_MS);
}

/** Asks for a code to be sent to this number. */
export async function requestCode(phone: string): Promise<SendResult> {
  if (!isSendablePhone(phone)) return { ok: false, reason: "telefone-invalido" };

  const number = e164(phone);
  const now = Date.now();
  const previous = loadPending();
  const sameNumber = previous?.phone === number;

  if (sameNumber && previous) {
    const wait = secondsUntil(previous.sentAt + RESEND_COOLDOWN_MS);
    if (wait > 0) return { ok: false, reason: "espere", resendInSeconds: wait };
  }

  const history = (sameNumber && previous ? previous.history : []).filter(
    (t) => now - t < 60 * 60 * 1000
  );
  if (history.length >= MAX_SENDS_PER_HOUR) {
    return { ok: false, reason: "muitos-envios" };
  }
  history.push(now);

  if (hasSmsServer()) {
    // The server generates the code, sends the SMS, and keeps the code. All
    // that comes back is whether it went out.
    try {
      const response = await fetch(`${SMS_ENDPOINT}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: number }),
      });
      if (!response.ok) {
        return response.status === 429
          ? { ok: false, reason: "muitos-envios" }
          : { ok: false, reason: "sem-rede" };
      }
    } catch {
      return { ok: false, reason: "sem-rede" };
    }
    savePending({
      phone: number,
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      sentAt: now,
      history,
    });
    return { ok: true, resendInSeconds: RESEND_COOLDOWN_MS / 1000 };
  }

  // Test mode: the code is made here and shown on screen, because there is
  // nothing to send it with.
  const code = newCode();
  savePending({
    phone: number,
    code,
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    sentAt: now,
    history,
  });
  return { ok: true, resendInSeconds: RESEND_COOLDOWN_MS / 1000, testCode: code };
}

/** Checks the code the person typed. */
export async function confirmCode(phone: string, typed: string): Promise<ConfirmResult> {
  const number = e164(phone);
  const pending = loadPending();
  if (!pending || pending.phone !== number) return { ok: false, reason: "expirado" };
  if (Date.now() > pending.expiresAt) {
    savePending(null);
    return { ok: false, reason: "expirado" };
  }
  if (pending.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "muitas-tentativas" };

  const code = onlyDigits(typed);

  if (hasSmsServer()) {
    try {
      const response = await fetch(`${SMS_ENDPOINT}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: number, code }),
      });
      if (response.ok) {
        savePending(null);
        return { ok: true, level: "servidor" };
      }
      if (response.status === 429) return { ok: false, reason: "muitas-tentativas" };
      savePending({ ...pending, attempts: pending.attempts + 1 });
      return {
        ok: false,
        reason: "codigo-errado",
        attemptsLeft: MAX_ATTEMPTS - pending.attempts - 1,
      };
    } catch {
      return { ok: false, reason: "sem-rede" };
    }
  }

  if (code && code === pending.code) {
    savePending(null);
    return { ok: true, level: "teste" };
  }
  savePending({ ...pending, attempts: pending.attempts + 1 });
  return {
    ok: false,
    reason: "codigo-errado",
    attemptsLeft: MAX_ATTEMPTS - pending.attempts - 1,
  };
}

/** Drops any pending code, e.g. when the person goes back to change the number. */
export function cancelPending() {
  savePending(null);
}
