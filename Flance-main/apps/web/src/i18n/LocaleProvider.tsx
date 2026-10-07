"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { messages } from "./messages";
import type { Locale } from "./locales";
import { defaultLocale, normalizeLocale } from "./locales";
import {
  canPersistPreferences,
  readStoredPreference,
  writeStoredPreference,
} from "../lib/cookie-consent";

type I18nContextValue = {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatCurrency: (value: number, currencyOverride?: "BRL" | "USD" | "EUR") => string;
  currency: "BRL" | "USD" | "EUR";
  setCurrency: (value: "BRL" | "USD" | "EUR") => void;
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
  const [currency, setCurrencyState] = useState<"BRL" | "USD" | "EUR">(
    initialLocale === "en-US" ? "USD" : "BRL"
  );
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const browserLocale = normalizeLocale(navigator.language);
    if (browserLocale !== locale) {
      setLocale(browserLocale);
    }
  }, [locale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = readStoredPreference("flance_currency");
    const cachedAt = readStoredPreference("flance_currency_at");
    const isFresh = cachedAt ? Date.now() - Number(cachedAt) < 1000 * 60 * 60 * 24 : false;
    const isOverride = readStoredPreference("flance_currency_override") === "true";
    if (cached === "USD" || cached === "BRL" || cached === "EUR") {
      if (isFresh) {
        setCurrencyState(cached);
        if (isOverride) {
          return;
        }
      }
    }

    fetch("/api/geo")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { countryCode?: string | null; currency?: string | null } | null) => {
        const countryCode = data?.countryCode ?? "";
        const currencyCode = data?.currency ?? "";
        const countryFallback: Record<string, "USD" | "EUR" | "BRL"> = {
          US: "USD",
          PT: "EUR",
          FR: "EUR",
          ES: "EUR",
          IT: "EUR",
          DE: "EUR",
          NL: "EUR",
          BE: "EUR",
          IE: "EUR",
          AT: "EUR",
          LU: "EUR",
        };
        const nextCurrency =
          currencyCode === "USD" || countryCode === "US"
            ? "USD"
            : currencyCode === "EUR" || countryFallback[countryCode] === "EUR"
              ? "EUR"
              : locale === "en-US"
                ? "USD"
                : "BRL";
        setCurrencyState(nextCurrency);
        writeStoredPreference("flance_currency", nextCurrency);
        writeStoredPreference("flance_currency_override", "false");
        writeStoredPreference("flance_currency_at", String(Date.now()));
      })
      .catch(() => {
        const fallback = locale === "en-US" ? "USD" : "BRL";
        setCurrencyState(fallback);
      });
  }, [locale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cachedRates = readStoredPreference("flance_fx_rates");
    const cachedRatesAt = readStoredPreference("flance_fx_rates_at");
    const isFresh = cachedRatesAt ? Date.now() - Number(cachedRatesAt) < 1000 * 60 * 60 * 6 : false;
    if (cachedRates && isFresh) {
      try {
        const parsed = JSON.parse(cachedRates) as Record<string, number>;
        setRates(parsed);
      } catch {
        // ignore
      }
    }

    fetch("https://api.frankfurter.dev/v2/rates?base=BRL&quotes=USD,EUR")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rates?: Record<string, number> } | null) => {
        if (!data?.rates) return;
        setRates(data.rates);
        if (canPersistPreferences()) {
          writeStoredPreference("flance_fx_rates", JSON.stringify(data.rates));
          writeStoredPreference("flance_fx_rates_at", String(Date.now()));
        }
      })
      .catch(() => null);
  }, []);

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
    (value: number, currencyOverride?: "BRL" | "USD" | "EUR") => {
      const chosenCurrency = currencyOverride ?? currency;
      let convertedValue = value;
      if (chosenCurrency !== "BRL") {
        const rate = rates[chosenCurrency];
        if (rate && Number.isFinite(rate)) {
          convertedValue = value * rate;
        }
      }
      return new Intl.NumberFormat(locale, { style: "currency", currency: chosenCurrency }).format(
        convertedValue
      );
    },
    [locale, currency, rates]
  );

  const setCurrency = useCallback((value: "BRL" | "USD" | "EUR") => {
    setCurrencyState(value);
    writeStoredPreference("flance_currency", value);
    writeStoredPreference("flance_currency_override", "true");
    writeStoredPreference("flance_currency_at", String(Date.now()));
  }, []);

  useEffect(() => {
    function handleConsentUpdated() {
      if (!canPersistPreferences()) return;
      writeStoredPreference("flance_currency", currency);
      writeStoredPreference("flance_currency_override", "true");
      writeStoredPreference("flance_currency_at", String(Date.now()));
    }
    window.addEventListener("flance:cookie-consent-updated", handleConsentUpdated as EventListener);
    return () =>
      window.removeEventListener("flance:cookie-consent-updated", handleConsentUpdated as EventListener);
  }, [currency]);

  const contextValue = useMemo(
    () => ({ locale, t, formatCurrency, currency, setCurrency }),
    [locale, t, formatCurrency, currency]
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return context;
}
