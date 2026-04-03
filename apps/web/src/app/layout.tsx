import type { ReactNode } from "react";
import { QueryProvider } from "../providers/query-provider";
import { Navbar } from "../components/shared/Navbar";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="app-body">
        <QueryProvider>
          <Navbar />
          {children}
        </QueryProvider>

        <footer className="app-footer">
          <div className="app-footer-inner">Flance (c) {new Date().getFullYear()} - Desenvolvido por RuzziDev</div>
        </footer>
      </body>
    </html>
  );
}
