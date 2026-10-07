export type Locale = "pt-BR" | "en-US";

export const defaultLocale: Locale = "pt-BR";

export function normalizeLocale(input?: string | null): Locale {
  if (!input) return defaultLocale;
  const lower = input.toLowerCase();
  if (lower.startsWith("pt")) return "pt-BR";
  return "en-US";
}

export function detectLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  const primary = acceptLanguage.split(",")[0]?.trim();
  return normalizeLocale(primary);
}
