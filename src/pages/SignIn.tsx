import { useState } from "react";
import { useAuth, type AuthError } from "../store/AuthContext";
import { isValidEmail, passwordProblem } from "../lib/auth";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useT } from "../i18n";
import type { TranslationKey } from "../i18n";
import avenaLogo from "../assets/avena-logo-wordmark.png";

const ERROR_KEY: Record<AuthError, TranslationKey> = {
  "sem-conta": "auth.errorNoAccount",
  "senha-errada": "auth.errorWrongPassword",
  "email-diferente": "auth.errorOtherEmail",
  "ja-existe": "auth.errorAlreadyExists",
  "sem-suporte": "auth.errorNoCrypto",
};

/**
 * The door. Nobody reaches the app without passing through here.
 *
 * It defaults to signing in when the device already has an account, and to
 * creating one when it does not — the common case should need no thought.
 */
export function SignIn() {
  const { account, signIn, signUp, continueAsGuest, accountsPossible } = useAuth();
  const t = useT();

  const [mode, setMode] = useState<"entrar" | "criar">(account ? "entrar" : "criar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(account?.email ?? "");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<AuthError | "email-invalido" | "senha-fraca" | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const creating = mode === "criar";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("email-invalido");
      return;
    }
    if (creating && passwordProblem(password)) {
      setError("senha-fraca");
      return;
    }

    // Deriving the key takes a moment on a phone, so the button says so
    // instead of appearing to have ignored the tap.
    setBusy(true);
    const failure = creating
      ? await signUp({ name, email, password })
      : await signIn({ email, password });
    setBusy(false);
    if (failure) setError(failure);
  }

  const errorText =
    error === "email-invalido"
      ? t("auth.errorEmail")
      : error === "senha-fraca"
        ? t(passwordProblem(password) === "curta" ? "auth.errorShort" : "auth.errorNoDigit")
        : error
          ? t(ERROR_KEY[error])
          : null;

  return (
    <div className="signin-page">
      <div className="signin-lang">
        <LanguageSwitcher />
      </div>

      <div className="signin-card">
        <img src={avenaLogo} alt="Avena" className="signin-logo" />
        <p className="signin-tagline">{t("auth.tagline")}</p>

        <div className="signin-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!creating}
            className={`signin-tab ${!creating ? "signin-tab-active" : ""}`}
            onClick={() => {
              setMode("entrar");
              setError(null);
            }}
          >
            {t("auth.signIn")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={creating}
            className={`signin-tab ${creating ? "signin-tab-active" : ""}`}
            onClick={() => {
              setMode("criar");
              setError(null);
            }}
          >
            {t("auth.createAccount")}
          </button>
        </div>

        <form className="signin-form" onSubmit={submit}>
          {creating && (
            <label>
              {t("auth.nameField")}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            {t("auth.emailField")}
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={creating ? "email" : "username"}
              required
            />
          </label>

          <label>
            {t("auth.passwordField")}
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={creating ? "new-password" : "current-password"}
              required
            />
          </label>

          <button
            type="button"
            className="signin-show"
            onClick={() => setShow((v) => !v)}
          >
            {t(show ? "auth.hidePassword" : "auth.showPassword")}
          </button>

          {creating && <p className="muted signin-hint">{t("auth.passwordHint")}</p>}

          {errorText && (
            <p className="signin-error" role="alert">
              {errorText}
            </p>
          )}

          <button type="submit" className="btn-primary signin-submit" disabled={busy}>
            {busy
              ? t("auth.working")
              : t(creating ? "auth.createAndEnter" : "auth.enter")}
          </button>
        </form>

        {!creating && account && (
          <p className="muted signin-hint">
            {t("auth.noRecovery")}
          </p>
        )}

        <div className="signin-guest">
          <button type="button" className="btn-outline" onClick={continueAsGuest}>
            {t("auth.guest")}
          </button>
          <p className="muted signin-hint">{t("auth.guestExplain")}</p>
        </div>

        {/* Saying what this account is — and is not — is the whole point of
            being trusted with someone's memories. */}
        <p className="signin-truth">
          {accountsPossible ? t("auth.localOnly") : t("auth.errorNoCrypto")}
        </p>
      </div>
    </div>
  );
}
