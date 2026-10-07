"use client";

import { LegalDocument } from "../../components/legal/LegalDocument";
import {
  buildPaymentSections,
  PAYMENT_POLICY_INTRO,
  PAYMENT_POLICY_UPDATED_AT,
  PAYMENT_POLICY_VERSION,
} from "../../lib/legal/payment-policy";

export default function PaymentPolicyPage() {
  return (
    <LegalDocument
      title="Política de Pagamentos, Cobrança e Direitos do Cliente"
      version={PAYMENT_POLICY_VERSION}
      updatedAt={PAYMENT_POLICY_UPDATED_AT}
      intro={PAYMENT_POLICY_INTRO}
      companyHeading="Responsável pela cobrança"
      buildSections={(contract) =>
        buildPaymentSections(contract?.plans ?? null, contract?.company.supportEmail ?? "o e-mail de suporte da Flance")
      }
    />
  );
}
