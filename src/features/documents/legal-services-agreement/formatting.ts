const LEGAL_SERVICES_AGREEMENT_NUMBER_PREFIX = "LS";
const LEGAL_SERVICES_AGREEMENT_NUMBER_BODY_LENGTH = 4;

export function normalizeLegalServicesAgreementNumber(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? "";

  if (normalized.length === 0) {
    return "";
  }

  const digits = normalized.replace(/\D/g, "").slice(-LEGAL_SERVICES_AGREEMENT_NUMBER_BODY_LENGTH);

  if (digits.length === 0) {
    return `${LEGAL_SERVICES_AGREEMENT_NUMBER_PREFIX}-`;
  }

  return `${LEGAL_SERVICES_AGREEMENT_NUMBER_PREFIX}-${digits.padStart(
    LEGAL_SERVICES_AGREEMENT_NUMBER_BODY_LENGTH,
    "0",
  )}`;
}

export function isLegalServicesAgreementNumberNormalized(value: string | null | undefined) {
  return /^LS-\d{4}$/.test(value?.trim().toUpperCase() ?? "");
}
