import { Link } from "react-router-dom";
import { StoreBadges } from "../components/StoreBadges";
import { anyStoreLive } from "../lib/appStores";
import { useT } from "../i18n";
import avenaLogo from "../assets/avena-logo-wordmark.png";

/**
 * The download page. While the app is not in the stores yet, it says so and
 * offers the thing that does work today: installing the site to the home
 * screen, which opens full screen and keeps working offline.
 */
export function GetApp() {
  const t = useT();
  const live = anyStoreLive();

  return (
    <div className="page page-wide get-app">
      <section className="get-app-hero">
        <img src={avenaLogo} alt="Avena" className="get-app-logo" />
        <h1>{t("app.title")}</h1>
        <p className="muted get-app-lead">
          {live ? t("app.subtitle") : t("app.subtitleSoon")}
        </p>

        <StoreBadges />

        {!live && <p className="muted get-app-note">{t("app.notPublishedNote")}</p>}
      </section>

      <section className="get-app-install">
        <h2>{t("app.installTitle")}</h2>
        <p className="muted">{t("app.installText")}</p>

        <div className="get-app-steps">
          <div className="get-app-step">
            <h3>{t("app.androidTitle")}</h3>
            <ol>
              <li>{t("app.androidStep1")}</li>
              <li>{t("app.androidStep2")}</li>
              <li>{t("app.androidStep3")}</li>
            </ol>
          </div>
          <div className="get-app-step">
            <h3>{t("app.iosTitle")}</h3>
            <ol>
              <li>{t("app.iosStep1")}</li>
              <li>{t("app.iosStep2")}</li>
              <li>{t("app.iosStep3")}</li>
            </ol>
          </div>
        </div>
      </section>

      <p className="muted">
        <Link to="/">{t("common.backToMap")}</Link>
      </p>
    </div>
  );
}
