"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/useI18n";
import { getCookieConsent, setCookieConsent, type CookieConsent } from "../../lib/cookie-consent";

const defaultConsent: CookieConsent = {
  necessary: true,
  preferences: true,
  analytics: false,
  updatedAt: "",
};

export function CookieConsentBanner() {
  const { locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [preferences, setPreferences] = useState(defaultConsent.preferences);
  const [analytics, setAnalytics] = useState(defaultConsent.analytics);

  useEffect(() => {
    const existingConsent = getCookieConsent();
    if (!existingConsent) {
      setIsOpen(true);
      return;
    }
    setPreferences(existingConsent.preferences);
    setAnalytics(existingConsent.analytics);
    setIsOpen(false);
  }, []);

  useEffect(() => {
    function handleOpenSettings() {
      const existingConsent = getCookieConsent();
      if (existingConsent) {
        setPreferences(existingConsent.preferences);
        setAnalytics(existingConsent.analytics);
      }
      setIsOpen(true);
    }
    window.addEventListener("flance:open-cookie-settings", handleOpenSettings as EventListener);
    return () => window.removeEventListener("flance:open-cookie-settings", handleOpenSettings as EventListener);
  }, []);

  const content = useMemo(() => {
    if (locale === "en-US") {
      return {
        title: "Cookie Settings",
        text: "We use necessary cookies to keep the platform secure and stable. With your permission, we also use preference cookies (theme/language/currency) and analytics cookies to improve your experience.",
        necessaryLabel: "Necessary cookies (always active)",
        preferencesLabel: "Preference cookies (theme, language, currency)",
        analyticsLabel: "Analytics cookies (usage metrics)",
        acceptAll: "Accept all",
        saveSelection: "Save selection",
        rejectOptional: "Reject optional",
        termsLabel: "Read Terms of Use",
      };
    }
    return {
      title: "Configuracao de Cookies",
      text: "Usamos cookies necessarios para manter a plataforma segura e funcional. Com sua permissao, usamos tambem cookies de preferencias (tema/idioma/moeda) e cookies de analise para melhorar sua experiencia.",
      necessaryLabel: "Cookies necessarios (sempre ativos)",
      preferencesLabel: "Cookies de preferencias (tema, idioma, moeda)",
      analyticsLabel: "Cookies de analise (metricas de uso)",
      acceptAll: "Aceitar todos",
      saveSelection: "Salvar selecao",
      rejectOptional: "Recusar opcionais",
      termsLabel: "Ler Termos de Uso",
    };
  }, [locale]);

  function closeAndSave(nextConsent: CookieConsent) {
    setCookieConsent(nextConsent);
    setIsOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("flance:cookie-consent-updated", { detail: nextConsent }));
    }
  }

  function handleAcceptAll() {
    closeAndSave({
      necessary: true,
      preferences: true,
      analytics: true,
      updatedAt: new Date().toISOString(),
    });
  }

  function handleRejectOptional() {
    closeAndSave({
      necessary: true,
      preferences: false,
      analytics: false,
      updatedAt: new Date().toISOString(),
    });
  }

  function handleSaveSelection() {
    closeAndSave({
      necessary: true,
      preferences,
      analytics,
      updatedAt: new Date().toISOString(),
    });
  }

  if (!isOpen) return null;

  return (
    <aside className="cookie-consent" aria-live="polite" role="dialog" aria-modal="false">
      <div className="cookie-consent-card">
        <h2 className="cookie-consent-title">{content.title}</h2>
        <p className="cookie-consent-text">{content.text}</p>

        <div className="cookie-consent-list">
          <label className="cookie-consent-item cookie-consent-item-locked">
            <input type="checkbox" checked readOnly />
            <span>{content.necessaryLabel}</span>
          </label>

          <label className="cookie-consent-item">
            <input
              type="checkbox"
              checked={preferences}
              onChange={(event) => setPreferences(event.target.checked)}
            />
            <span>{content.preferencesLabel}</span>
          </label>

          <label className="cookie-consent-item">
            <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
            <span>{content.analyticsLabel}</span>
          </label>
        </div>

        <div className="cookie-consent-actions">
          <button type="button" className="btn-primary" onClick={handleAcceptAll}>
            {content.acceptAll}
          </button>
          <button type="button" className="btn-outline" onClick={handleSaveSelection}>
            {content.saveSelection}
          </button>
          <button type="button" className="btn-outline" onClick={handleRejectOptional}>
            {content.rejectOptional}
          </button>
          <Link href="/termos" className="cookie-consent-link">
            {content.termsLabel}
          </Link>
        </div>
      </div>
    </aside>
  );
}
