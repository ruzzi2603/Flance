"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { logout } from "../../services/auth";
import { useAuthStore } from "../../store/useAuthStore";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../i18n/useI18n";
import { canPersistPreferences, readStoredPreference, writeStoredPreference } from "../../lib/cookie-consent";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const { t, currency, setCurrency } = useI18n();
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();
  const navLinksRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ width: number; left: number }>({ width: 0, left: 0 });
  const [isHidden, setIsHidden] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
      router.push("/login");
    }
  }

  const avatarValue = user?.avatarUrl || "avatar-sky";
  const avatarIsImage = avatarValue.startsWith("data:") || avatarValue.startsWith("http");
  const initials = user?.name ? user.name.split(" ").map((part) => part[0]).slice(0, 2).join("") : "FL";

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  const visibleLinks = useMemo(() => {
    const links = [
      { key: "companies", href: "/empresas", label: t("nav.companies") },
      { key: "plans", href: "/planos", label: t("nav.plans") },
    ];
    if (!isLoading && user) {
      links.push({ key: "chat", href: "/chat", label: t("nav.chat") });
    } else if (!isLoading) {
      links.push({ key: "login", href: "/login", label: t("nav.login") });
    }
    return links;
  }, [isLoading, user, t]);

  useEffect(() => {
    const activeLink = visibleLinks.find((link) => isActive(link.href)) ?? visibleLinks[0];
    if (!activeLink) return;
    const el = linkRefs.current[activeLink.key];
    const container = navLinksRef.current;
    if (!el || !container) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setIndicatorStyle({ width: elRect.width, left: elRect.left - containerRect.left });
  }, [pathname, visibleLinks]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!isMenuOpen) return;
      if (menuRef.current?.contains(target)) return;
      if (toggleRef.current?.contains(target)) return;
      setIsMenuOpen(false);
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isMenuOpen]);

  useEffect(() => {
    function handleResize() {
      const activeLink = visibleLinks.find((link) => isActive(link.href)) ?? visibleLinks[0];
      if (!activeLink) return;
      const el = linkRefs.current[activeLink.key];
      const container = navLinksRef.current;
      if (!el || !container) return;
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicatorStyle({ width: elRect.width, left: elRect.left - containerRect.left });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [visibleLinks, pathname]);

  useEffect(() => {
    const savedTheme = readStoredPreference("flance_theme");
    const initialTheme: "dark" | "light" = savedTheme === "light" ? "light" : "dark";
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    writeStoredPreference("flance_theme", theme);
  }, [theme]);

  useEffect(() => {
    function handleConsentUpdated() {
      if (canPersistPreferences()) {
        writeStoredPreference("flance_theme", theme);
      }
    }
    window.addEventListener("flance:cookie-consent-updated", handleConsentUpdated as EventListener);
    return () =>
      window.removeEventListener("flance:cookie-consent-updated", handleConsentUpdated as EventListener);
  }, [theme]);

  useEffect(() => {
    function updateVisibility() {
      const currentY = window.scrollY || 0;
      if (currentY <= 0) {
        setIsHidden(false);
      } else if (currentY > lastScrollY.current + 1) {
        setIsHidden(true);
      } else if (currentY < lastScrollY.current) {
        setIsHidden(false);
      }
      lastScrollY.current = currentY;
      ticking.current = false;
    }

    function handleScroll() {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(updateVisibility);
    }

    lastScrollY.current = window.scrollY || 0;
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`nav-root ${isHidden ? "nav-root-hidden" : ""}`}>
      <div className={`nav-overlay ${isMenuOpen ? "nav-overlay-open" : ""}`} />
      <nav className="nav-shell">
        <Link href="/" className="nav-logo" aria-label="Flance">
          <img className="nav-logo-image" src="/logoDef.png" alt="Flance" />
        </Link>
        <button
          type="button"
          className={`switch nav-toggle ${isMenuOpen ? "is-open" : ""}`}
          aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={isMenuOpen}
          aria-controls="nav-links-menu"
          aria-haspopup="menu"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          ref={toggleRef}
        >
          <span className="wrapper">
            <span className="row">
              <span className="dot"></span>
              <span className="dot"></span>
            </span>
            <span className="row row-bottom">
              <span className="dot"></span>
              <span className="dot"></span>
            </span>
            <span className="row-vertical">
              <span className="dot"></span>
              <span className="dot middle-dot"></span>
              <span className="dot"></span>
            </span>
            <span className="row-horizontal">
              <span className="dot"></span>
              <span className="dot middle-dot-horizontal"></span>
              <span className="dot"></span>
            </span>
          </span>
        </button>
        <div
          id="nav-links-menu"
          className={`nav-links ${isMenuOpen ? "nav-links-open" : ""}`}
          ref={(el) => {
            navLinksRef.current = el;
            menuRef.current = el;
          }}
        >
          {visibleLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={`nav-link ${isActive(link.href) ? "nav-link-active" : ""}`}
              ref={(el) => {
                linkRefs.current[link.key] = el;
              }}
            >
              {link.label}
            </Link>
          ))}
          <span
            className="nav-indicator"
            style={{ width: indicatorStyle.width, transform: `translateX(${indicatorStyle.left}px)` }}
          />

          <div className="currency-switch">
            <button
              type="button"
              className="currency-button"
              aria-haspopup="listbox"
              aria-label="Selecionar moeda"
            >
              <span className="currency-flag" aria-hidden>
                {currency === "USD" ? "🇺🇸" : currency === "EUR" ? "🇪🇺" : "🇧🇷"}
              </span>
              <span className="currency-code">{currency}</span>
            </button>
            <div className="currency-menu" role="listbox">
              <button
                type="button"
                className={`currency-option ${currency === "BRL" ? "is-active" : ""}`}
                onClick={() => setCurrency("BRL")}
              >
                <span className="currency-flag" aria-hidden>
                  🇧🇷
                </span>
                BRL
              </button>
              <button
                type="button"
                className={`currency-option ${currency === "USD" ? "is-active" : ""}`}
                onClick={() => setCurrency("USD")}
              >
                <span className="currency-flag" aria-hidden>
                  🇺🇸
                </span>
                USD
              </button>
              <button
                type="button"
                className={`currency-option ${currency === "EUR" ? "is-active" : ""}`}
                onClick={() => setCurrency("EUR")}
              >
                <span className="currency-flag" aria-hidden>
                  🇪🇺
                </span>
                EUR
              </button>
            </div>
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            <span aria-hidden>{theme === "dark" ? "☀️" : "🌙"}</span>
            <span className="theme-toggle-label">{theme === "dark" ? "White" : "Dark"}</span>
          </button>

          {isLoading ? null : user ? (
            <>
              <Link href="/profile" className="nav-profile">
                {avatarIsImage ? (
                  <img className="nav-avatar-image" src={avatarValue} alt="Foto de perfil" />
                ) : (
                  <span className={`nav-avatar ${avatarValue}`}>{initials}</span>
                )}
                {t("nav.profile")}
              </Link>
              <button type="button" onClick={handleLogout} className="nav-logout">
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <Link href="/register" className="nav-cta">
              {t("nav.start")}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
