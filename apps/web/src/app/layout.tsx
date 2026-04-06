import type { ReactNode } from "react";
import { headers } from "next/headers";
import { QueryProvider } from "../providers/query-provider";
import { Navbar } from "../components/shared/Navbar";
import { Footer } from "../components/shared/Footer";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { detectLocaleFromHeader } from "../i18n/locales";
import "./globals.css";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers(); // agora é await
  const acceptLanguage = requestHeaders.get("accept-language") ?? "pt-BR";
  const initialLocale = detectLocaleFromHeader(acceptLanguage);

  return (
    <html lang={initialLocale}>
      <body className="app-body">
        <LocaleProvider initialLocale={initialLocale}>
          <QueryProvider>
            <Navbar />
            {children}
          </QueryProvider>
          <Footer />
        </LocaleProvider>
      </body>
    </html>
  );
}