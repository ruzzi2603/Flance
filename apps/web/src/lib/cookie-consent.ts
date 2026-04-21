"use client";

export type CookieConsent = {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  updatedAt: string;
};

const CONSENT_COOKIE_KEY = "flance_cookie_consent";
const ONE_YEAR_IN_DAYS = 365;

function parseCookieString(cookieString: string): Record<string, string> {
  return cookieString
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, current) => {
      const [rawKey, ...rawValue] = current.split("=");
      if (!rawKey) return acc;
      acc[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.join("="));
      return acc;
    }, {});
}

export function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parsed = parseCookieString(document.cookie ?? "");
  return parsed[name] ?? null;
}

export function setCookieValue(name: string, value: string, days = ONE_YEAR_IN_DAYS) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function getCookieConsent(): CookieConsent | null {
  const raw = getCookieValue(CONSENT_COOKIE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed && typeof parsed.preferences === "boolean" && typeof parsed.analytics === "boolean") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCookieConsent(consent: CookieConsent) {
  setCookieValue(CONSENT_COOKIE_KEY, JSON.stringify(consent));
}

export function canPersistPreferences(): boolean {
  const consent = getCookieConsent();
  return Boolean(consent?.preferences);
}

export function readStoredPreference(name: string): string | null {
  const cookieValue = getCookieValue(name);
  if (cookieValue) return cookieValue;
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(name);
}

export function writeStoredPreference(name: string, value: string) {
  if (!canPersistPreferences()) return;
  setCookieValue(name, value);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(name, value);
  }
}

