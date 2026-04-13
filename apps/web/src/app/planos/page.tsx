"use client";

import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../i18n/useI18n";

export default function PlansPage() {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();

  const plans = [
    {
      id: "FREE",
      name: t("plans.free.title"),
      price: t("plans.free.price"),
      description: t("plans.free.desc"),
      features: [t("plans.free.feature1"), t("plans.free.feature2"), t("plans.free.feature3")],
    },
    {
      id: "BASIC",
      name: t("plans.essential.title"),
      price: t("plans.essential.price"),
      description: t("plans.essential.desc"),
      features: [t("plans.essential.feature1"), t("plans.essential.feature2"), t("plans.essential.feature3")],
    },
    {
      id: "PRO",
      name: t("plans.professional.title"),
      price: t("plans.professional.price"),
      description: t("plans.professional.desc"),
      features: [t("plans.professional.feature1"), t("plans.professional.feature2"), t("plans.professional.feature3")],
    },
  
  ];

  return (
    <main className="page-shell">
      <section className="section-shell">
        <header className="mb-10">
          <h1 className="heading-xl">{t("plans.title")}</h1>
          <p className="mt-2 text-muted" id="p">
            {t("plans.subtitle")}
          </p>
        </header>

        <div className="plans-grid">
          {plans.map((plan) => (
            <div key={plan.id} className="card-container">
              <div className="title-card">
                <p>{plan.name}</p>
                <span>{plan.price}</span>
              </div>
              <div className="card-content">
                <div className="title">{plan.description}</div>
                <div className="plain">
                  <p>{plan.price}</p>
                  <p>{t("plans.period")}</p>
                </div>
                <div className="card-separate">
                  <span>{t("plans.details")}</span>
                  <span className="separate" />
                </div>
                <div className="card-list-features">
                  {plan.features.map((item) => (
                    <div key={item} className="option">
                      <span>-</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                {isAuthenticated ? (
                  <Link href={`/profile?plan=${plan.id}`} className="card-btn">
                    {t("plans.select")}
                  </Link>
                ) : (
                  <Link href={`/register?plan=${plan.id}`} className="card-btn">
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
