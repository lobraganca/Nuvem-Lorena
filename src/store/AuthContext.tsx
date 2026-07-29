import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  canHashPasswords,
  hashPassword,
  newSalt,
  normalizeEmail,
  verifyPassword,
  type Account,
} from "../lib/auth";
import { readStored, removeStored, writeStored } from "../lib/safeStorage";

const ACCOUNT_KEY = "avena-account";
const SESSION_KEY = "avena-session";
/** Kept in step with AvenaContext: erasing the device has to erase the data. */
const DATA_KEY = "avena-data-v19";

/** Why a sign-in attempt failed, in terms the screen can explain. */
export type AuthError =
  | "sem-conta"
  | "senha-errada"
  | "email-diferente"
  | "ja-existe"
  | "sem-suporte";

interface AuthValue {
  account: Account | null;
  /** True once the person is through the door — as guest or with an account. */
  signedIn: boolean;
  /** Looking around without an account: nothing is kept between visits. */
  isGuest: boolean;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<AuthError | null>;
  signIn: (input: { email: string; password: string }) => Promise<AuthError | null>;
  signOut: () => void;
  continueAsGuest: () => void;
  /** False when the browser cannot hash a password, so accounts are impossible. */
  accountsPossible: boolean;
  /** Erases the account and all data on this device. There is no undo. */
  resetDevice: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function loadAccount(): Account | null {
  const raw = readStored(ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Account;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(loadAccount);
  const [session, setSession] = useState<"conta" | "visitante" | null>(() => {
    const stored = readStored(SESSION_KEY);
    return stored === "conta" || stored === "visitante" ? stored : null;
  });

  const accountsPossible = canHashPasswords();

  const signUp = useCallback<AuthValue["signUp"]>(
    async ({ name, email, password }) => {
      if (!canHashPasswords()) return "sem-suporte";
      const normalized = normalizeEmail(email);

      // Any existing account blocks a new one, including one with the same
      // e-mail. Allowing a same-e-mail sign-up was a password reset that
      // proved nothing: anyone holding the phone could read the address off
      // the sign-in field, type a new password and walk into the memories.
      if (loadAccount()) return "ja-existe";

      const salt = newSalt();
      const created: Account = {
        name: name.trim(),
        email: normalized,
        passwordHash: await hashPassword(password, salt),
        salt,
        createdAt: new Date().toISOString(),
      };
      writeStored(ACCOUNT_KEY, JSON.stringify(created));
      writeStored(SESSION_KEY, "conta");
      setAccount(created);
      setSession("conta");
      return null;
    },
    []
  );

  const signIn = useCallback<AuthValue["signIn"]>(async ({ email, password }) => {
    const stored = loadAccount();
    if (!stored) return "sem-conta";
    if (stored.email !== normalizeEmail(email)) return "email-diferente";
    if (!canHashPasswords()) return "sem-suporte";
    if (!(await verifyPassword(password, stored))) return "senha-errada";

    writeStored(SESSION_KEY, "conta");
    setAccount(stored);
    setSession("conta");
    return null;
  }, []);

  const signOut = useCallback(() => {
    // Only the session ends. The account and the person's memories stay on the
    // device, so signing out is never a way to lose them by accident.
    removeStored(SESSION_KEY);
    setSession(null);
  }, []);

  /**
   * The only honest way out of a forgotten password with no server: erase the
   * account and everything on this device, and start over. It cannot recover
   * the memories — nothing can — but it must never hand them to whoever asks.
   */
  const resetDevice = useCallback(() => {
    removeStored(ACCOUNT_KEY);
    removeStored(SESSION_KEY);
    removeStored(DATA_KEY);
    setAccount(null);
    setSession(null);
    // The store keeps the erased data in memory, so the app has to start clean.
    window.location.reload();
  }, []);

  const continueAsGuest = useCallback(() => {
    writeStored(SESSION_KEY, "visitante");
    setSession("visitante");
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      account,
      signedIn: session !== null,
      isGuest: session === "visitante",
      signUp,
      signIn,
      signOut,
      continueAsGuest,
      accountsPossible,
      resetDevice,
    }),
    [account, session, signUp, signIn, signOut, continueAsGuest, accountsPossible, resetDevice]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return value;
}
