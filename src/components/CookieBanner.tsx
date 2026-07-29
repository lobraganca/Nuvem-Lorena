import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "../i18n";

/**
 * Consent is stored per device (not per account), since it governs what runs
 * in this browser — a different person on the same device gets asked again
 * only if they clear storage, which matches how consent is usually handled.
 */
const STORAGE_KEY = "avena-cookie-consent";

/** Bumping this re-asks everyone, e.g. when a new tracking category is added. */
const CONSENT_VERSION = "1.0";

export interface CookieConsent {
  version: string;
  analytics: boolean;
  acceptedAt: string;
}

export function readCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    return parsed.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function saveCookieConsent(analytics: boolean) {
  const consent: CookieConsent = {
    version: CONSENT_VERSION,
    analytics,
    acceptedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  window.dispatchEvent(new Event("avena-cookie-consent-changed"));
}

/** Lets other parts of the app (and the footer link) reopen the choice. */
export function openCookiePreferences() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("avena-cookie-consent-changed"));
}

export function CookieBanner() {
  const t = useT();
  const [consent, setConsent] = useState<CookieConsent | null>(() =>
    readCookieConsent()
  );

  useEffect(() => {
    const sync = () => setConsent(readCookieConsent());
    window.addEventListener("avena-cookie-consent-changed", sync);
    return () => window.removeEventListener("avena-cookie-consent-changed", sync);
  }, []);

  if (consent) return null;

  function choose(analytics: boolean) {
    saveCookieConsent(analytics);
    setConsent(readCookieConsent());
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label={t("footer.cookies")}>
      <div className="cookie-banner-text">
        <strong>{t("cookies.title")}</strong>
        <p className="muted">
          Usamos cookies essenciais para manter você conectado e o app
          funcionando. Com sua autorização, usamos também cookies de análise
          para entender como o Avena é usado e melhorá-lo. Saiba mais na{" "}
          <Link to="/privacidade">{t("footer.privacy")}</Link>.
        </p>
      </div>
      <div className="cookie-banner-actions">
        {/* Refusing must be as easy as accepting. */}
        <button type="button" className="btn-outline" onClick={() => choose(false)}>
          Apenas essenciais
        </button>
        <button type="button" className="btn-primary" onClick={() => choose(true)}>
          Aceitar todos
        </button>
      </div>
    </div>
  );
}
