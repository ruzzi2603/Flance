"use client";

import type { ReactNode } from "react";
import { useI18n } from "../../i18n/useI18n";

export type PlanId = "FREE" | "PROFESSIONAL" | "PROFESSIONAL_PLUS";

export type PlanOption = {
  id: PlanId;
  name: string;
  price: number;
  description: string;
  badge: string | null;
  isPaid: boolean;
  features: string[];
  lockedFeatures: string[];
};

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function buildPlanOptions(t: Translate): PlanOption[] {
  return [
    {
      id: "FREE",
      name: t("plans.free.title"),
      price: 0,
      description: t("plans.free.desc"),
      badge: null,
      isPaid: false,
      features: [t("plans.free.feature1"), t("plans.free.feature2"), t("plans.free.feature3"), t("plans.free.feature4"), t("plans.free.feature5")],
      lockedFeatures: [t("plans.professional.feature3"), t("plans.professional.feature4"), t("plans.professional.feature6")],
    },
    {
      id: "PROFESSIONAL",
      name: t("plans.professional.title"),
      price: 29.99,
      description: t("plans.professional.desc"),
      badge: t("plans.badge.popular"),
      isPaid: true,
      features: [t("plans.professional.feature1"), t("plans.professional.feature2"), t("plans.professional.feature3"), t("plans.professional.feature4"), t("plans.professional.feature5"), t("plans.professional.feature6")],
      lockedFeatures: [t("plans.professionalPlus.feature3"), t("plans.professionalPlus.feature4"), t("plans.professionalPlus.feature7")],
    },
    {
      id: "PROFESSIONAL_PLUS",
      name: t("plans.professionalPlus.title"),
      price: 39.99,
      description: t("plans.professionalPlus.desc"),
      badge: t("plans.badge.best"),
      isPaid: true,
      features: [t("plans.professionalPlus.feature1"), t("plans.professionalPlus.feature2"), t("plans.professionalPlus.feature3"), t("plans.professionalPlus.feature4"), t("plans.professionalPlus.feature5"), t("plans.professionalPlus.feature6"), t("plans.professionalPlus.feature7")],
      lockedFeatures: [],
    },
  ];
}

type PlanCardsProps = {
  plans: PlanOption[];
  selectedPlan?: string | null;
  onSelect?: (plan: PlanOption) => void;
  renderAction?: (plan: PlanOption) => ReactNode;
};

export function PlanCards({ plans, selectedPlan, onSelect, renderAction }: PlanCardsProps) {
  const { t, formatCurrency } = useI18n();
  const selectable = Boolean(onSelect);

  return (
    <div className="plans-grid-full" role={selectable ? "radiogroup" : undefined} aria-label={selectable ? t("profile.company.planSelect") : undefined}>
      {plans.map((plan) => {
        const isSelected = selectedPlan === plan.id;
        const className = [
          "plan-card-full",
          plan.id === "PROFESSIONAL" ? "plan-card-highlighted" : "",
          selectable ? "plan-card-selectable" : "",
          isSelected ? "plan-card-selected" : "",
        ].filter(Boolean).join(" ");

        const content = (
          <>
            {plan.badge ? (
              <div className={`plan-badge ${plan.id === "PROFESSIONAL_PLUS" ? "plan-badge-gold" : "plan-badge-primary"}`}>
                {plan.badge}
              </div>
            ) : null}
            <div className="plan-card-header">
              <p className="plan-name">{plan.name}</p>
              <div className="plan-price-block">
                <span className="plan-price">{formatCurrency(plan.price)}</span>
                {plan.isPaid ? <span className="plan-period">/{t("plans.period")}</span> : <span className="plan-period plan-period-free">grátis</span>}
              </div>
              <p className="plan-desc">{plan.description}</p>
            </div>
            <div className="plan-divider" />
            <ul className="plan-features-list">
              {plan.features.map((feature) => (
                <li key={feature} className="plan-feature-item"><span className="plan-feature-check">✓</span><span>{feature}</span></li>
              ))}
              {plan.lockedFeatures.map((feature) => (
                <li key={feature} className="plan-feature-item plan-feature-locked"><span className="plan-feature-lock">✕</span><span>{feature}</span></li>
              ))}
            </ul>
            <div className="plan-card-footer">
              {selectable ? (
                <span className={`plan-cta-btn ${plan.id === "PROFESSIONAL_PLUS" ? "plan-cta-gold" : plan.id === "PROFESSIONAL" ? "plan-cta-primary" : "plan-cta-outline"}`}>
                  {isSelected ? `✓ ${t("profile.company.planChosen")}` : t("profile.company.planSelect")}
                </span>
              ) : renderAction?.(plan)}
            </div>
          </>
        );

        return selectable ? (
          <div
            key={plan.id}
            className={className}
            role="radio"
            tabIndex={0}
            aria-checked={isSelected}
            onClick={() => onSelect?.(plan)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.(plan);
              }
            }}
          >
            {content}
          </div>
        ) : (
          <article key={plan.id} className={className}>{content}</article>
        );
      })}
    </div>
  );
}
