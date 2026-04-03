"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { logout } from "../../services/auth";
import { useAuthStore } from "../../store/useAuthStore";
import { useQueryClient } from "@tanstack/react-query";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();
  const navLinksRef = useRef<HTMLDivElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ width: number; left: number }>({ width: 0, left: 0 });
  const [isHidden, setIsHidden] = useState(false);
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
      { key: "companies", href: "/empresas", label: "Empresas" },
      { key: "plans", href: "/planos", label: "Planos" },
    ];
    if (!isLoading && user) {
      links.push({ key: "chat", href: "/chat", label: "Chat" });
    } else if (!isLoading) {
      links.push({ key: "login", href: "/login", label: "Login" });
    }
    return links;
  }, [isLoading, user]);

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
      <nav className="nav-shell">
        <Link href="/" className="nav-logo" aria-label="Flance">
          <img className="nav-logo-image" src="/logoDef.png" alt="Flance" />
        </Link>
        <div className="nav-links" ref={navLinksRef}>
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

          {isLoading ? null : user ? (
            <>
              <Link href="/profile" className="nav-profile">
                {avatarIsImage ? (
                  <img className="nav-avatar-image" src={avatarValue} alt="Foto de perfil" />
                ) : (
                  <span className={`nav-avatar ${avatarValue}`}>{initials}</span>
                )}
                Perfil
              </Link>
              <button type="button" onClick={handleLogout} className="nav-logout">
                Sair
              </button>
            </>
          ) : (
            <Link href="/register" className="nav-cta">
              Comecar
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
