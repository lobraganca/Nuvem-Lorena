import { useState } from "react";
import { useAuth, type AuthError } from "../store/AuthContext";
import { isValidEmail, passwordProblem } from "../lib/auth";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { StoreBadges } from "../components/StoreBadges";
import { anyStoreLive } from "../lib/appStores";
import { useT } from "../i18n";
import type { TranslationKey } from "../i18n";

const ERROR_KEY: Record<AuthError, TranslationKey> = {
  "sem-conta": "auth.errorNoAccount",
  "senha-errada": "auth.errorWrongPassword",
  "email-diferente": "auth.errorOtherEmail",
  "ja-existe": "auth.errorAlreadyExists",
  "sem-suporte": "auth.errorNoCrypto",
  credenciais: "auth.errorCredentials",
  "confirme-email": "auth.errorConfirmEmail",
  rede: "auth.errorNetwork",
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
  const {
    account,
    signIn,
    signUp,
    continueAsGuest,
    accountsPossible,
    resetDevice,
    onServer,
    awaitingEmail,
    requestPasswordReset,
  } = useAuth();
  const t = useT();
  const [resetSent, setResetSent] = useState(false);

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

  const choices = (
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
  );

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
            {/* The promise, set large and broken across three lines with the
                middle one carried in sand — the one line that says what this
                is for. */}
            <h2 className="door-hero-title">
              {t("door.heroLineA")}{" "}
              <span className="door-hero-accent">{t("door.heroLineB")}</span>{" "}
              {t("door.heroLineC")}
            </h2>
            <p className="signin-invite">{t("auth.invite")}</p>
            <p className="signin-experiences">{t("auth.experiences")}</p>

            <p className="door-hero-sub">
              {anyStoreLive() ? t("door.heroDownload") : t("door.heroDownloadSoon")}
            </p>
            <div className="door-hero-stores">
              <StoreBadges />
            </div>

            {choices}

            <button type="button" className="signin-quiet" onClick={continueAsGuest}>
              {t("auth.guest")}
            </button>

            {/* One line here; the full explanation waits until someone is
                actually about to create an account. */}
            <p className="signin-truth">
              {!accountsPossible
                ? t("auth.errorNoCrypto")
                : onServer
                  ? t("auth.serverAccount")
                  : t("auth.localOnlyShort")}
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

            {/* A conta foi criada e falta abrir o e-mail. Não é erro, é o
                próximo passo — e sem dizer isso a pessoa fica olhando uma tela
                que não mudou, achando que o cadastro não funcionou. */}
            {awaitingEmail && (
              <p className="signin-truth" role="status">
                {t("auth.checkEmail", { email })}
              </p>
            )}

            {/* Being trusted with someone's memories means saying what this
                account is, and is not, before they rely on it. */}
            <p className="signin-truth">
              {onServer
                ? t(creating ? "auth.serverAccountLong" : "auth.serverAccount")
                : creating
                  ? t("auth.localOnly")
                  : t("auth.noRecovery")}
            </p>

            {/* Com servidor, esquecer a senha deixa de ser porta trancada: o
                link chega por e-mail. A resposta é a mesma exista ou não a
                conta, para a tela não virar uma lista de quem se cadastrou. */}
            {!creating && requestPasswordReset && (
              <>
                <button
                  type="button"
                  className="signin-quiet"
                  onClick={async () => {
                    if (!isValidEmail(email)) {
                      setError("email-invalido");
                      return;
                    }
                    const ok = await requestPasswordReset(email);
                    // Só afirma que o link foi enviado quando o servidor
                    // confirmou. Sem isso, uma queda de conexão faria a tela
                    // mandar a pessoa esperar um e-mail que nunca sairá.
                    if (ok) setResetSent(true);
                    else setError("rede");
                  }}
                >
                  {t("auth.forgot")}
                </button>
                {resetSent && (
                  <p className="signin-truth" role="status">
                    {t("auth.resetSent")}
                  </p>
                )}
              </>
            )}

            {/* A forgotten password used to be a locked door with no handle.
                This is the only honest way out: erase and start over. It is
                destructive, so it asks first and says exactly what it loses.
                Sem servidor apenas — com ele, o caminho é o e-mail acima. */}
            {!creating && !onServer && account && (
              <button
                type="button"
                className="signin-quiet signin-danger"
                onClick={() => {
                  if (confirm(t("auth.resetConfirm"))) resetDevice();
                }}
              >
                {t("auth.reset")}
              </button>
            )}
          </>
        )}
      </div>

      {step === "porta" && (
        <div className="door-below">
          <section className="door-section">
            <h2>{t("door.experiencesTitle")}</h2>
            <p>{t("door.experiencesText")}</p>
            <ul className="door-list">
              <li>{t("door.experiencesA")}</li>
              <li>{t("door.experiencesB")}</li>
              <li>{t("door.experiencesC")}</li>
            </ul>
          </section>

          <section className="door-section">
            <h2>{t("door.peopleTitle")}</h2>
            <p>{t("door.peopleText")}</p>
          </section>

          <section className="door-section">
            <h2>{t("door.ecosystemTitle")}</h2>
            <div className="door-columns">
              <div className="door-column">
                <h3>{t("door.forTravelers")}</h3>
                <p>{t("door.forTravelersText")}</p>
              </div>
              <div className="door-column">
                <h3>{t("door.forBusiness")}</h3>
                <p>{t("door.forBusinessText")}</p>
              </div>
            </div>
          </section>

          <section className="door-section door-closing">
            <h2 className="door-serif">{t("door.togetherTitle")}</h2>
            <p>{t("door.togetherText")}</p>
          </section>

          {/* The buttons again at the end: someone who read this far should
              not have to scroll back up to act on it. */}
          <section className="door-section door-final">
            <h2 className="door-serif">{t("door.closingTitle")}</h2>
            {choices}
            <button type="button" className="signin-quiet" onClick={continueAsGuest}>
              {t("auth.guest")}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
