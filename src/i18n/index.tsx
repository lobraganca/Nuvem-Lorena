import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { pt } from "./pt";
import { en } from "./en";
import { es } from "./es";

export type Lang = "pt" | "en" | "es";

export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: "pt", label: "Português", short: "PT" },
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "ES" },
];

/** Portuguese is the source of truth; the others are keyed against it. */
export type TranslationKey = keyof typeof pt;
export type Dictionary = Record<TranslationKey, string>;

import { readStored, writeStored } from "../lib/safeStorage";

const dictionaries: Record<Lang, Partial<Dictionary>> = { pt, en, es };

const STORAGE_KEY = "avena-lang";

function detectLanguage(): Lang {
  const stored = readStored(STORAGE_KEY);
  if (stored === "pt" || stored === "en" || stored === "es") return stored;

  // A Spanish-speaking visitor should not land on a Portuguese page by default.
  for (const candidate of navigator.languages ?? [navigator.language]) {
    const base = candidate.slice(0, 2).toLowerCase();
    if (base === "en") return "en";
    if (base === "es") return "es";
    if (base === "pt") return "pt";
  }
  return "pt";
}

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /**
   * Translates a key, replacing {placeholders} with the given values.
   * Falls back to Portuguese when a translation is missing, so a new string
   * shows real text instead of its key.
   */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLanguage);

  useEffect(() => {
    writeStored(STORAGE_KEY, lang);
    document.documentElement.lang = lang === "pt" ? "pt-BR" : lang;
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const template = dictionaries[lang][key] ?? pt[key] ?? String(key);
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name) =>
        name in vars ? String(vars[name]) : match
      );
    },
    [lang]
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang: setLangState, t }),
    [lang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Shorthand for components that only need the translate function. */
export function useT() {
  return useI18n().t;
}

/** Locale tag for Intl formatting, so dates and numbers follow the language. */
export function localeFor(lang: Lang): string {
  return lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
}
