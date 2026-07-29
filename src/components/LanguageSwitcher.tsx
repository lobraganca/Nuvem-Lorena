import { LANGUAGES, useI18n } from "../i18n";
import type { Lang } from "../i18n";

/** Language picker in the top bar. Visible before anything else is chosen. */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  return (
    <label className="language-switcher">
      <span className="sr-only">{t("language.change")}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label={t("language.change")}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.short}
          </option>
        ))}
      </select>
    </label>
  );
}
