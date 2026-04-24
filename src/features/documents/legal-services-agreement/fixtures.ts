import {
  LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION,
} from "@/features/documents/legal-services-agreement/types";
import type { LegalServicesAgreementDraftPayload } from "@/features/documents/legal-services-agreement/schemas";
import type { DocumentAuthorSnapshot } from "@/schemas/document";

export const legalServicesAgreementFixtureAuthorSnapshot: DocumentAuthorSnapshot = {
  characterId: "fixture-character-legal-services-agreement",
  serverId: "fixture-server-blackberry",
  serverCode: "blackberry",
  serverName: "Blackberry",
  fullName: "Dom Perignon",
  nickname: "Dom",
  passportNumber: "240434",
  position: "Заместитель Главы Коллегии Адвокатов",
  address: "San Andreas",
  phone: "605879",
  icEmail: "12hsrate@sa.gov",
  passportImageUrl: "",
  isProfileComplete: true,
  roleKeys: ["lawyer"],
  accessFlags: ["advocate"],
  capturedAt: "2026-04-24T09:00:00.000Z",
};

export const legalServicesAgreementFixturePayload: LegalServicesAgreementDraftPayload = {
  formSchemaVersion: LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION,
  trustorSnapshot: {
    trustorId: "fixture-trustor-legal-services-agreement",
    fullName: "Nick Name",
    passportNumber: "00000",
    phone: "1234567",
    icEmail: "test@sa.gov",
    note: null,
  },
  manualFields: {
    agreementNumber: "LS-0011",
    registerNumber: "LS-0011",
    agreementDate: "23 Апрель 2026",
    servicePeriodStart: "23.04.2026",
    servicePeriodEnd: "24.04.2026",
    priceAmount: "100.000",
  },
  workingNotes: "",
};
