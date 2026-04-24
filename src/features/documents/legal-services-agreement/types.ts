export const LEGAL_SERVICES_AGREEMENT_FORM_SCHEMA_VERSION =
  "legal_services_agreement_contract_v1";
export const LEGAL_SERVICES_AGREEMENT_TEMPLATE_VERSION =
  "legal_services_agreement_reference_pdf_v1";
export const LEGAL_SERVICES_AGREEMENT_RENDERER_VERSION =
  "legal_services_agreement_print_template_page1_v8";
export const LEGAL_SERVICES_AGREEMENT_OUTPUT_FORMAT =
  "legal_services_agreement_png_pages_v1";

export type LegalServicesAgreementTrustorSnapshot = {
  trustorId: string;
  fullName: string;
  passportNumber: string;
  phone: string | null;
  icEmail: string | null;
  note: string | null;
};

export type LegalServicesAgreementManualFields = {
  agreementNumber: string;
  registerNumber: string;
  agreementDate: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  priceAmount: string;
};

export type LegalServicesAgreementResolvedFields =
  LegalServicesAgreementManualFields & {
    executorFullName: string;
    executorPassportNumber: string;
    executorPosition: string;
    executorPhone: string;
    executorIcEmail: string;
    trustorFullName: string;
    trustorPassportNumber: string;
    trustorPhone: string;
    trustorIcEmail: string;
  };
