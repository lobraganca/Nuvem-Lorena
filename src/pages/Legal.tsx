import { Link } from "react-router-dom";
import {
  LEGAL_UPDATED_AT,
  LEGAL_VERSION,
  privacyPolicy,
  termsOfUse,
  type LegalSection,
} from "../content/legal";
import { localeFor, useI18n } from "../i18n";

function LegalDocument({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  const { t, lang } = useI18n();

  return (
    <div className="page legal-page">
      <Link to="/" className="back-link">
        ← {t("common.back")}
      </Link>
      <h1>{title}</h1>
      <p className="muted">
        {t("legal.version", {
          version: LEGAL_VERSION,
          date: new Date(LEGAL_UPDATED_AT).toLocaleDateString(localeFor(lang)),
        })}
      </p>
      {lang !== "pt" && (
        <p className="sandbox-warning" role="note">
          {t("legal.ptNotice")}
        </p>
      )}
      <p className="legal-intro">{intro}</p>

      {sections.map((section) => (
        <section key={section.title} className="legal-section">
          <h2>{section.title}</h2>
          {section.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}

      <div className="legal-footer-links">
        <Link to="/termos">Termos de Uso</Link>
        <Link to="/privacidade">Política de Privacidade</Link>
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <LegalDocument
      title="Termos de Uso"
      intro="Estes Termos regem o uso do Avena por viajantes e por parceiros. Leia com atenção antes de reservar um passeio ou cadastrar seu estabelecimento."
      sections={termsOfUse}
    />
  );
}

export function Privacy() {
  return (
    <LegalDocument
      title="Política de Privacidade"
      intro="Esta Política explica como o Avena coleta, usa, compartilha e protege seus dados pessoais, conforme a Lei Geral de Proteção de Dados (LGPD)."
      sections={privacyPolicy}
    />
  );
}
