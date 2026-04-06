"use client";

import { useI18n } from "../../i18n/useI18n";

export function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="footer-top">
          <div>
            <p className="footer-title">Flance</p>
            <p className="footer-text">{t("footer.description")}</p>
          </div>
          <div className="footer-links">
            <a href="/termos" className="footer-link">
              {t("footer.terms")}
            </a>
            <a href="mailto:gestaoFlance@gmail.com" className="footer-link">
              {t("footer.contact")}
            </a>
            <a href="https://github.com/ruzzi2603/Flance" target="_blank" rel="noreferrer" className="footer-link">
              {t("footer.repo")}
            </a>
          </div>
          <div className="footer-social">
            <a
              href="https://instagram.com/FlanceOfc"
              target="_blank"
              rel="noreferrer"
              className="footer-social-link"
              aria-label="Instagram da Flance"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="footer-icon">
                <path d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9A4.5 4.5 0 0 1 16.5 21h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zm0 1.5A3 3 0 0 0 4.5 7.5v9A3 3 0 0 0 7.5 19.5h9a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3h-9z" />
                <path d="M12 7.2A4.8 4.8 0 1 1 7.2 12 4.8 4.8 0 0 1 12 7.2zm0 1.5A3.3 3.3 0 1 0 15.3 12 3.3 3.3 0 0 0 12 8.7z" />
                <circle cx="17.3" cy="6.7" r="1.1" />
              </svg>
              {t("footer.instagram")}
            </a>
          </div>
        </div>
        <div className="footer-divider"></div>
        <div className="footer-bottom">
          <span>{t("footer.rights", { year })}</span>
          <a href="https://github.com/ruzzi2603" target="_blank" rel="noreferrer" className="footer-link">
            {t("footer.by")}
          </a>
        </div>
      </div>
    </footer>
  );
}
