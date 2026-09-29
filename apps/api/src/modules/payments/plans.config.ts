import { BadRequestException } from "@nestjs/common";
import { PlanTier } from "@prisma/client";

export enum PlanKey {
  FREE = "FREE",
  PROFESSIONAL = "PROFESSIONAL",
  PROFESSIONAL_PLUS = "PROFESSIONAL_PLUS",
}

export interface PlanConfig {
  key: PlanKey;
  name: string;
  price: number;
  durationDays: number;
  maxAds: number;
  maxPhotos: number;
  analytics: "BASIC" | "FULL" | "ADVANCED";
  featuredAds: number;
  prioritySearch: boolean;
  description: string;
  isPaid: boolean;
}

export const PLANS: Record<PlanKey, PlanConfig> = {
  [PlanKey.FREE]: {
    key: PlanKey.FREE,
    name: "Gratuito",
    price: 0,
    durationDays: 30,
    maxAds: 1,
    maxPhotos: 3,
    analytics: "BASIC",
    featuredAds: 0,
    prioritySearch: false,
    description: "Ideal para começar a divulgar sua empresa",
    isPaid: false,
  },
  [PlanKey.PROFESSIONAL]: {
    key: PlanKey.PROFESSIONAL,
    name: "Profissional",
    price: 29.99,
    durationDays: 30,
    maxAds: 5,
    maxPhotos: 10,
    analytics: "FULL",
    featuredAds: 1,
    prioritySearch: false,
    description: "Mais visibilidade, destaque e recursos completos",
    isPaid: true,
  },
  [PlanKey.PROFESSIONAL_PLUS]: {
    key: PlanKey.PROFESSIONAL_PLUS,
    name: "Profissional Plus",
    price: 39.99,
    durationDays: 30,
    maxAds: 15,
    maxPhotos: 20,
    analytics: "ADVANCED",
    featuredAds: 3,
    prioritySearch: true,
    description: "Máximo alcance, prioridade de busca e relatórios avançados",
    isPaid: true,
  },
};

/**
 * Normaliza e resolve o plano a partir de strings (suporta legados BASIC / PRO para compatibilidade)
 */
export function normalizePlanKey(input: string): PlanKey {
  const upper = input?.trim().toUpperCase();
  if (upper === "FREE") return PlanKey.FREE;
  if (upper === "PROFESSIONAL" || upper === "BASIC") return PlanKey.PROFESSIONAL;
  if (upper === "PROFESSIONAL_PLUS" || upper === "PRO" || upper === "PREMIUM") return PlanKey.PROFESSIONAL_PLUS;
  throw new BadRequestException(`Plano inválido: "${input}". Planos disponíveis: FREE, PROFESSIONAL, PROFESSIONAL_PLUS.`);
}

export function getPlanConfig(planKey: PlanKey | string): PlanConfig {
  const key = typeof planKey === "string" ? normalizePlanKey(planKey) : planKey;
  const config = PLANS[key];
  if (!config) {
    throw new BadRequestException(`Configuração do plano "${key}" não encontrada.`);
  }
  return config;
}

export function toPrismaPlanTier(planKey: PlanKey): PlanTier {
  switch (planKey) {
    case PlanKey.FREE:
      return PlanTier.FREE;
    case PlanKey.PROFESSIONAL:
      return PlanTier.PROFESSIONAL;
    case PlanKey.PROFESSIONAL_PLUS:
      return PlanTier.PROFESSIONAL_PLUS;
  }
}
