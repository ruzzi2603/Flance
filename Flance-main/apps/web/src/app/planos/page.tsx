"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../i18n/useI18n";
import { PlanCards, buildPlanOptions } from "../../components/plans/PlanCards";

export default function PlansPage() {
  const { user, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const plans = useMemo(() => buildPlanOptions(t), [t]);

  return (
    <main className="page-shell">
      <section className="section-shell">
        <div className="plans-header">
          <h1 className="heading-xl" id="ttplans">{t("plans.title")}</h1>
          <p className="mt-2 text-muted" id="ttplanssub">{t("plans.subtitle")}</p>
        </div>
        <PlanCards
          plans={plans}
          renderAction={(plan) => {
            if (isAuthenticated && plan.isPaid && user?.planTier === plan.id) {
              return (
                <Link href="/assinatura" className={`plan-cta-btn ${plan.id === "PROFESSIONAL_PLUS" ? "plan-cta-gold" : "plan-cta-primary"}`}>
                  {t("plans.manage")}
                </Link>
              );
            }
            return (
              <Link
                href={isAuthenticated ? `/profile?plan=${plan.id}` : `/register?plan=${plan.id}`}
                className={`plan-cta-btn ${plan.id === "PROFESSIONAL" ? "plan-cta-primary" : plan.id === "PROFESSIONAL_PLUS" ? "plan-cta-gold" : "plan-cta-outline"}`}
              >
                {isAuthenticated ? t("plans.select") : t("plans.createAndSelect")}
              </Link>
            );
          }}
        />
      </section>
    </main>
  );
}
