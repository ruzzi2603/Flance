"use client";

import { LegalDocument } from "../../components/legal/LegalDocument";
import {
  buildPrivacySections,
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_UPDATED_AT,
  PRIVACY_POLICY_VERSION,
} from "../../lib/legal/privacy-policy";

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Política de Privacidade"
      version={PRIVACY_POLICY_VERSION}
      updatedAt={PRIVACY_POLICY_UPDATED_AT}
      intro={PRIVACY_POLICY_INTRO}
      companyHeading="Controlador dos dados"
      buildSections={(contract) => buildPrivacySections(contract?.company.privacyEmail ?? "o e-mail de contato da Flance")}
    />
  );
}
