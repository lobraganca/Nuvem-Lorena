import { useNavigate } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import avenaLogo from "../assets/avena-logo-wordmark.png";
import { TrendingSection } from "../components/TrendingSection";
import { PromotedTours } from "../components/PromotedTours";
import { StoreBadges } from "../components/StoreBadges";
import { anyStoreLive } from "../lib/appStores";
import { useT } from "../i18n";
import type { TranslationKey } from "../i18n";

const FEATURES: { title: TranslationKey; text: TranslationKey }[] = [
  { title: "welcome.feature1Title", text: "welcome.feature1Text" },
  { title: "welcome.feature2Title", text: "welcome.feature2Text" },
  { title: "welcome.feature3Title", text: "welcome.feature3Text" },
  { title: "welcome.feature4Title", text: "welcome.feature4Text" },
];

export function Welcome() {
  const { updateUser } = useAvena();
  const navigate = useNavigate();
  const t = useT();

  function chooseTurista() {
    updateUser({ accountType: "turista" });
    navigate("/");
  }

  function chooseProfissional() {
    updateUser({ accountType: "profissional" });
    navigate("/business/new?onboarding=1");
  }

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <img src={avenaLogo} alt="Avena" className="landing-logo" />
        <div className="landing-hero-badge">{t("welcome.badge")}</div>
        <p className="landing-tagline">{t("welcome.tagline")}</p>
      </section>

      <section className="landing-features">
        {FEATURES.map((f) => (
          <div key={f.title} className="landing-feature-card">
            <h3>{t(f.title)}</h3>
            <p className="muted">{t(f.text)}</p>
          </div>
        ))}
      </section>

      <section className="landing-stores">
        <p className="muted">
          {anyStoreLive() ? t("app.subtitle") : t("app.subtitleSoon")}
        </p>
        <StoreBadges />
      </section>

      <section className="page page-wide">
        <PromotedTours />
        <TrendingSection />
      </section>

      <section className="page page-wide welcome-page">
        <h2>{t("welcome.howToUse")}</h2>
        <p className="muted">{t("welcome.chooseAccount")}</p>

        <div className="account-type-grid">
          <button type="button" className="account-type-card" onClick={chooseTurista}>
            <h2>{t("welcome.imTraveler")}</h2>
            <p className="muted">{t("welcome.travelerText")}</p>
            <ul>
              <li>{t("welcome.travelerItem1")}</li>
              <li>{t("welcome.travelerItem2")}</li>
              <li>{t("welcome.travelerItem3")}</li>
            </ul>
          </button>

          <button type="button" className="account-type-card" onClick={chooseProfissional}>
            <h2>{t("welcome.imProfessional")}</h2>
            <p className="muted">{t("welcome.professionalText")}</p>
            <ul>
              <li>{t("welcome.professionalItem1")}</li>
              <li>{t("welcome.professionalItem2")}</li>
              <li>{t("welcome.professionalItem3")}</li>
            </ul>
          </button>
        </div>
      </section>
    </div>
  );
}
