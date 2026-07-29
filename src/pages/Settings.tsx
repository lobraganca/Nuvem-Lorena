import { Link } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { useAuth } from "../store/AuthContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { openCookiePreferences } from "../components/CookieBanner";
import { useT } from "../i18n";

/**
 * Everything that is not the person's own travelling.
 *
 * The profile had thirteen links and six stacked sections, which made the one
 * thing it is for — looking at your own map and memories — the hardest thing
 * to find on it. Account, app and legal moved here.
 */
export function Settings() {
  const { user } = useAvena();
  const { account, signOut } = useAuth();
  const t = useT();

  return (
    <div className="page settings-page">
      <Link to="/profile" className="back-link">
        ← {t("nav.profile")}
      </Link>
      <h1>{t("settings.title")}</h1>

      <section className="settings-group">
        <h2 className="timeline-title">{t("settings.account")}</h2>
        {account && <p className="muted">{t("auth.signedInAs", { email: account.email })}</p>}
        <div className="settings-links">
          <Link to="/meus-dados">{t("profile.myData")}</Link>
          <Link to="/notifications">{t("nav.notifications")}</Link>
          <Link to="/ajuda">{t("footer.help")}</Link>
        </div>
        {account && (
          <button type="button" className="btn-outline" onClick={signOut}>
            {t("auth.signOut")}
          </button>
        )}
      </section>

      <section className="settings-group">
        <h2 className="timeline-title">{t("settings.app")}</h2>
        <div className="settings-row">
          <span>{t("language.title")}</span>
          <LanguageSwitcher />
        </div>
        <div className="settings-links">
          <Link to="/app">{t("app.navLink")}</Link>
          <button type="button" className="footer-link" onClick={openCookiePreferences}>
            {t("footer.cookies")}
          </button>
        </div>
      </section>

      {/* The professional side is a link, not a fork at the front door: it is
          a small minority of people, and they come looking for it. */}
      {user.accountType !== "profissional" && (
        <section className="settings-group">
          <h2 className="timeline-title">{t("settings.business")}</h2>
          <p className="muted">{t("settings.businessText")}</p>
          <Link to="/business" className="btn-outline">
            {t("nav.forBusiness")}
          </Link>
        </section>
      )}

      <section className="settings-group">
        <h2 className="timeline-title">{t("settings.legal")}</h2>
        <div className="settings-links">
          <Link to="/termos">{t("footer.terms")}</Link>
          <Link to="/privacidade">{t("footer.privacy")}</Link>
        </div>
      </section>
    </div>
  );
}
