import { useState } from "react";
import { useAuth, type AuthError } from "../store/AuthContext";
import { isValidEmail, passwordProblem } from "../lib/auth";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useT } from "../i18n";
import type { TranslationKey } from "../i18n";

const ERROR_KEY: Record<AuthError, TranslationKey> = {
  "sem-conta": "auth.errorNoAccount",
  "senha-errada": "auth.errorWrongPassword",
  "email-diferente": "auth.errorOtherEmail",
  "ja-existe": "auth.errorAlreadyExists",
  "sem-suporte": "auth.errorNoCrypto",
};

type Step = "porta" | "entrar" | "criar";

/**
 * The door, in two steps.
 *
 * The first screen is only the logo and the three ways in — a form is a wall
 * of fields, and asking someone to read one before they have decided anything
 * is the fastest way to lose them. The fields come after the choice.
 */
export function SignIn() {
  const { account, signIn, signUp, continueAsGuest, accountsPossible } = useAuth();
  const t = useT();

  const [step, setStep] = useState<Step>("porta");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(account?.email ?? "");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<AuthError | "email-invalido" | "senha-fraca" | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const creating = step === "criar";

  function go(next: Step) {
    setStep(next);
    setError(null);
    setPassword("");
  }

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
        {/* The name is typeset rather than the logo image: the wordmark carries
            its own dark box, which would sit as a rectangle on this green. */}
        <h1 className="signin-wordmark">avena</h1>
        <p className="signin-from">{t("auth.fromBrazil")}</p>

        {step === "porta" ? (
          <>
            <p className="signin-invite">{t("auth.invite")}</p>
            <p className="signin-experiences">{t("auth.experiences")}</p>

            <div className="signin-choices">
              <button
                type="button"
                className="btn-primary signin-submit"
                onClick={() => go("criar")}
              >
                {t("auth.createAccount")}
              </button>
              <button
                type="button"
                className="btn-outline signin-secondary"
                onClick={() => go("entrar")}
              >
                {t("auth.signIn")}
              </button>
            </div>

            <button type="button" className="signin-quiet" onClick={continueAsGuest}>
              {t("auth.guest")}
            </button>

            {/* One line here; the full explanation waits until someone is
                actually about to create an account. */}
            <p className="signin-truth">
              {accountsPossible ? t("auth.localOnlyShort") : t("auth.errorNoCrypto")}
            </p>
          </>
        ) : (
          <>
            <p className="signin-tagline">{t("auth.tagline")}</p>
            <button type="button" className="signin-back" onClick={() => go("porta")}>
              ← {t("common.back")}
            </button>

            <h1 className="signin-title">
              {t(creating ? "auth.createAccount" : "auth.signIn")}
            </h1>

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

            {/* Being trusted with someone's memories means saying what this
                account is, and is not, before they rely on it. */}
            <p className="signin-truth">
              {creating ? t("auth.localOnly") : t("auth.noRecovery")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
