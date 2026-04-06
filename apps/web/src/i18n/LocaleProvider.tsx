"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { messages } from "./messages";
import type { Locale } from "./locales";
import { defaultLocale, normalizeLocale } from "./locales";

type I18nContextValue = {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatCurrency: (value: number, currencyOverride?: "BRL" | "USD") => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function LocaleProvider({
  initialLocale = defaultLocale,
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const browserLocale = normalizeLocale(navigator.language);
    if (browserLocale !== locale) {
      setLocale(browserLocale);
    }
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dictionary = messages[locale] || messages[defaultLocale];
      let value = dictionary[key] || key;
      if (vars) {
        Object.entries(vars).forEach(([varKey, varValue]) => {
          value = value.replace(new RegExp(`\\{${varKey}\\}`, "g"), String(varValue));
        });
      }
      return value;
    },
    [locale]
  );

  const formatCurrency = useCallback(
    (value: number, currencyOverride?: "BRL" | "USD") => {
      const currency = currencyOverride ?? (locale === "en-US" ? "USD" : "BRL");
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
    },
    [locale]
  );

  const contextValue = useMemo(() => ({ locale, t, formatCurrency }), [locale, t, formatCurrency]);

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return context;
}
