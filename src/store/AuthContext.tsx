import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  canHashPasswords,
  hashPassword,
  newSalt,
  normalizeEmail,
  verifyPassword,
  type Account,
} from "../lib/auth";
import { hasDatabase } from "../lib/supabase";
import {
  onRemoteAuthChange,
  remoteResetPassword,
  remoteSession,
  remoteSetPhone,
  remoteSignIn,
  remoteSignOut,
  remoteSignUp,
} from "../lib/authRemote";
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
  | "sem-suporte"
  // Só acontecem com banco: e-mail ou senha que não conferem (sem dizer qual,
  // para a tela não virar uma lista de quem tem conta), e-mail ainda não
  // confirmado, e o servidor fora de alcance.
  | "credenciais"
  | "confirme-email"
  | "rede";

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
  /** True quando a conta vive no servidor: vale em qualquer aparelho. */
  onServer: boolean;
  /** True enquanto a sessão guardada ainda está sendo lida do servidor. */
  loadingSession: boolean;
  /**
   * A conta foi criada e falta confirmar o e-mail. Existe separado do erro
   * porque não é falha: é o próximo passo, e a tela precisa dizer isso.
   */
  awaitingEmail: boolean;
  /** Sai da tela de confirmação — para quem errou o endereço e quer refazer. */
  clearAwaitingEmail: () => void;
  /**
   * Manda o e-mail de redefinição. Só existe com servidor — sem ele, ninguém
   * pode mandar e-mail nenhum, e prometer isso seria mentira.
   */
  requestPasswordReset: ((email: string) => Promise<boolean>) | null;
  /** Erases the account and all data on this device. There is no undo. */
  resetDevice: () => void;
  /** True while the account still owes a confirmed phone number. */
  needsPhone: boolean;
  /** Records a number the person just confirmed. */
  setVerifiedPhone: (phone: string, level: "servidor" | "teste") => void;
  /**
   * Puts the question off until the next visit. Deliberately not stored: it
   * comes back, which is the pressure to confirm, without ever locking someone
   * out of an account they already made.
   */
  postponePhone: () => void;
  /** Brings the phone screen back, for someone who put it off. */
  askForPhone: () => void;
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

  const onServer = hasDatabase();
  // Com servidor, a hora de criar a conta é do Supabase, e o navegador não
  // precisa saber derivar chave nenhuma.
  const accountsPossible = onServer || canHashPasswords();

  const [loadingSession, setLoadingSession] = useState(onServer);
  const [awaitingEmail, setAwaitingEmail] = useState(false);
  const clearAwaitingEmail = useCallback(() => setAwaitingEmail(false), []);

  /**
   * Retoma a sessão guardada e acompanha as trocas.
   *
   * Sem isto, fechar a aba e voltar jogaria a pessoa na porta de entrada mesmo
   * com a sessão válida — e o token, que se renova sozinho de tempos em
   * tempos, passaria despercebido.
   */
  useEffect(() => {
    if (!onServer) return;
    let vivo = true;

    remoteSession().then((conta) => {
      if (!vivo) return;
      if (conta) {
        setAccount(conta);
        setSession("conta");
      }
      setLoadingSession(false);
    });

    const cancelar = onRemoteAuthChange((conta) => {
      if (!vivo) return;
      setAccount(conta);
      // Só derruba a sessão de quem estava com conta: quem entrou como
      // visitante não tem sessão no servidor e não pode ser expulso por isso.
      setSession((atual) => (conta ? "conta" : atual === "conta" ? null : atual));
    });

    return () => {
      vivo = false;
      cancelar();
    };
  }, [onServer]);

  const signUp = useCallback<AuthValue["signUp"]>(
    async ({ name, email, password }) => {
      if (onServer) {
        const { error, account: criada, needsEmail } = await remoteSignUp({
          name,
          email,
          password,
        });
        if (error) return error === "senha-fraca" ? "sem-suporte" : error;
        setAwaitingEmail(needsEmail);
        // Com confirmação por e-mail ligada, a conta existe mas ainda não
        // entra. Abrir o app aqui seria deixar passar quem não provou o
        // endereço.
        if (needsEmail) return null;
        if (criada) {
          setAccount(criada);
          setSession("conta");
        }
        return null;
      }

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
    [onServer]
  );

  const signIn = useCallback<AuthValue["signIn"]>(async ({ email, password }) => {
    if (onServer) {
      const { error, account: entrou } = await remoteSignIn({ email, password });
      // "senha-fraca" só faz sentido ao criar conta; ao entrar, uma senha que
      // não serve é simplesmente uma senha que não confere.
      if (error) return error === "senha-fraca" ? "credenciais" : error;
      if (entrou) {
        setAccount(entrou);
        setSession("conta");
        setAwaitingEmail(false);
      }
      return null;
    }

    const stored = loadAccount();
    if (!stored) return "sem-conta";
    if (stored.email !== normalizeEmail(email)) return "email-diferente";
    if (!canHashPasswords()) return "sem-suporte";
    if (!(await verifyPassword(password, stored))) return "senha-errada";

    writeStored(SESSION_KEY, "conta");
    setAccount(stored);
    setSession("conta");
    return null;
  }, [onServer]);

  const signOut = useCallback(() => {
    // Only the session ends. The account and the person's memories stay on the
    // device, so signing out is never a way to lose them by accident.
    removeStored(SESSION_KEY);
    setSession(null);
    if (onServer) void remoteSignOut();
  }, [onServer]);

  // Sem servidor não existe e-mail de redefinição, e a tela precisa saber
  // disso para não oferecer um botão que não faz nada.
  const requestPasswordReset = useMemo(
    () => (onServer ? (email: string) => remoteResetPassword(email) : null),
    [onServer]
  );

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

  const [phonePostponed, setPhonePostponed] = useState(false);

  const setVerifiedPhone = useCallback<AuthValue["setVerifiedPhone"]>((phone, level) => {
    // Com servidor o número acompanha a conta, não o aparelho: quem confirmou
    // no celular não é perguntado de novo ao entrar pelo computador.
    if (onServer) void remoteSetPhone(phone, level);
    setAccount((current) => {
      if (!current) return current;
      const updated: Account = {
        ...current,
        phone,
        phoneVerifiedBy: level,
        phoneVerifiedAt: new Date().toISOString(),
      };
      writeStored(ACCOUNT_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [onServer]);

  const postponePhone = useCallback(() => setPhonePostponed(true), []);
  const askForPhone = useCallback(() => setPhonePostponed(false), []);

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
      onServer,
      loadingSession,
      awaitingEmail,
      clearAwaitingEmail,
      requestPasswordReset,
      resetDevice,
      needsPhone:
        session === "conta" && account !== null && !account.phoneVerifiedAt && !phonePostponed,
      setVerifiedPhone,
      postponePhone,
      askForPhone,
    }),
    [
      account,
      session,
      signUp,
      signIn,
      signOut,
      continueAsGuest,
      accountsPossible,
      onServer,
      loadingSession,
      awaitingEmail,
      clearAwaitingEmail,
      requestPasswordReset,
      resetDevice,
      phonePostponed,
      setVerifiedPhone,
      postponePhone,
      askForPhone,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return value;
}
