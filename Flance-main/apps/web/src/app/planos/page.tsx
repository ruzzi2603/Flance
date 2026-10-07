"use client";

import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../i18n/useI18n";

export default function PlansPage() {
  const { user, isAuthenticated } = useAuth();
  const { t, formatCurrency } = useI18n();

  const plans = [
    {
      id: "FREE",
      name: t("plans.free.title"),
      price: 0,
      description: t("plans.free.desc"),
      badge: null,
      isPaid: false,
      features: [
        t("plans.free.feature1"),
        t("plans.free.feature2"),
        t("plans.free.feature3"),
        t("plans.free.feature4"),
        t("plans.free.feature5"),
      ],
      lockedFeatures: [
        t("plans.professional.feature3"),
        t("plans.professional.feature4"),
        t("plans.professional.feature6"),
      ],
    },
    {
      id: "PROFESSIONAL",
      name: t("plans.professional.title"),
      price: 29.99,
      description: t("plans.professional.desc"),
      badge: t("plans.badge.popular"),
      isPaid: true,
      features: [
        t("plans.professional.feature1"),
        t("plans.professional.feature2"),
        t("plans.professional.feature3"),
        t("plans.professional.feature4"),
        t("plans.professional.feature5"),
        t("plans.professional.feature6"),
      ],
      lockedFeatures: [
        t("plans.professionalPlus.feature3"),
        t("plans.professionalPlus.feature4"),
        t("plans.professionalPlus.feature7"),
      ],
    },
    {
      id: "PROFESSIONAL_PLUS",
      name: t("plans.professionalPlus.title"),
      price: 39.99,
      description: t("plans.professionalPlus.desc"),
      badge: t("plans.badge.best"),
      isPaid: true,
      features: [
        t("plans.professionalPlus.feature1"),
        t("plans.professionalPlus.feature2"),
        t("plans.professionalPlus.feature3"),
        t("plans.professionalPlus.feature4"),
        t("plans.professionalPlus.feature5"),
        t("plans.professionalPlus.feature6"),
        t("plans.professionalPlus.feature7"),
      ],
      lockedFeatures: [],
    },
  ];

  return (
    <main className="page-shell">
      <section className="section-shell">
        <div className="plans-header">
          <h1 className="heading-xl" id="ttplans">
            {t("plans.title")}
          </h1>
          <p className="mt-2 text-muted" id="ttplanssub">
            {t("plans.subtitle")}
          </p>
        </div>

        <div className="plans-grid-full">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`plan-card-full ${plan.id === "PROFESSIONAL" ? "plan-card-highlighted" : ""}`}
            >
              {plan.badge ? (
                <div className={`plan-badge ${plan.id === "PROFESSIONAL_PLUS" ? "plan-badge-gold" : "plan-badge-primary"}`}>
                  {plan.badge}
                </div>
              ) : null}

              <div className="plan-card-header">
                <p className="plan-name">{plan.name}</p>
                <div className="plan-price-block">
                  <span className="plan-price">{formatCurrency(plan.price)}</span>
                  {plan.isPaid ? (
                    <span className="plan-period">/{t("plans.period")}</span>
                  ) : (
                    <span className="plan-period plan-period-free">grátis</span>
                  )}
                </div>
                <p className="plan-desc">{plan.description}</p>
              </div>

              <div className="plan-divider" />

              <ul className="plan-features-list">
                {plan.features.map((feature) => (
                  <li key={feature} className="plan-feature-item">
                    <span className="plan-feature-check">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
                {plan.lockedFeatures.map((feature) => (
                  <li key={feature} className="plan-feature-item plan-feature-locked">
                    <span className="plan-feature-lock">✕</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="plan-card-footer">
                {isAuthenticated && plan.isPaid && user?.planTier === plan.id ? (
                  // Já assina este plano: gerenciar/pagar renovação (destino dos e-mails de cobrança)
                  <Link
                    href="/assinatura"
                    className={`plan-cta-btn ${plan.id === "PROFESSIONAL_PLUS" ? "plan-cta-gold" : "plan-cta-primary"}`}
                  >
                    {t("plans.manage")}
                  </Link>
                ) : isAuthenticated ? (
                  <Link
                    href={`/profile?plan=${plan.id}`}
                    className={`plan-cta-btn ${plan.id === "PROFESSIONAL" ? "plan-cta-primary" : plan.id === "PROFESSIONAL_PLUS" ? "plan-cta-gold" : "plan-cta-outline"}`}
                  >
                    {t("plans.select")}
                  </Link>
                ) : (
                  <Link
                    href={`/register?plan=${plan.id}`}
                    className={`plan-cta-btn ${plan.id === "PROFESSIONAL" ? "plan-cta-primary" : plan.id === "PROFESSIONAL_PLUS" ? "plan-cta-gold" : "plan-cta-outline"}`}
                  >
                    {t("plans.createAndSelect")}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
