import { z } from "zod";

export type OgpChecklistIssue = {
  fieldKey:
    | "fullName"
    | "position"
    | "passportNumber"
    | "address"
    | "phone"
    | "icEmail"
    | "passportImageUrl"
    | "appealNumber"
    | "organizationName"
    | "subjectLabel"
    | "incidentAt"
    | "situationDescription"
    | "violationSummary"
    | "evidenceList";
  label: string;
  message: string;
};

export type OgpGenerationReadyState =
  | "generation_ready"
  | "blocked_by_character_profile"
  | "blocked_by_trustor_snapshot"
  | "blocked_by_document_payload"
  | "blocked_by_multiple_sections";

export type OgpCharacterGenerationProfile = {
  fullName: string;
  position: string;
  passportNumber: string;
  address: string;
  phone: string;
  icEmail: string;
  passportImageUrl: string;
};

export type OgpTrustorGenerationProfile = {
  fullName: string;
  passportNumber: string;
  address: string;
  phone: string;
  icEmail: string;
  passportImageUrl: string;
};

export type OgpEvidenceLike = {
  rows: Array<unknown>;
};

export type OgpDocumentGenerationPayload = {
  appealNumber: string;
  organizationName: string;
  subjectLabel: string;
  incidentAt: string;
  situationDescription: string;
  violationSummary: string;
  evidenceGroups: OgpEvidenceLike[];
};

export type OgpGenerationValidationResult = {
  characterIssues: OgpChecklistIssue[];
  trustorIssues: OgpChecklistIssue[];
  documentIssues: OgpChecklistIssue[];
  readyState: OgpGenerationReadyState;
  isReady: boolean;
};

type CharacterProfileDataRecord = {
  position: string;
  address: string;
  phone: string;
  icEmail: string;
  passportImageUrl: string;
  signature: string | null;
  note: string | null;
};

const phonePattern = /^\d{3}-\d{2}-\d{2}$/;
const passportPattern = /^\d{1,6}$/;
const digitsOnlyPattern = /^\d+$/;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizePassportNumber(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`;
  }

  return normalizeText(value);
}

export function normalizeIcEmail(value: string) {
  return normalizeText(value);
}

export function normalizeSafeUrl(value: string) {
  return value.trim();
}

export function normalizeOptionalText(value: string) {
  const normalized = normalizeText(value);

  return normalized.length > 0 ? normalized : null;
}

function isSafeUrl(value: string) {
  const parsed = z.string().url().safeParse(value);

  if (!parsed.success) {
    return false;
  }

  return value.startsWith("http://") || value.startsWith("https://");
}

function issue(
  fieldKey: OgpChecklistIssue["fieldKey"],
  label: string,
  message: string,
): OgpChecklistIssue {
  return {
    fieldKey,
    label,
    message,
  };
}

function validateIdentityFields(input: {
  fullName: string;
  passportNumber: string;
  phone: string;
  icEmail: string;
  passportImageUrl: string;
  address?: string;
  includeAddress?: boolean;
  includePosition?: boolean;
  position?: string;
}) {
  const issues: OgpChecklistIssue[] = [];
  const normalizedPassportNumber = normalizePassportNumber(input.passportNumber);
  const normalizedPhone = normalizePhone(input.phone);
  const normalizedIcEmail = normalizeIcEmail(input.icEmail);
  const normalizedPassportImageUrl = normalizeSafeUrl(input.passportImageUrl);

  if (normalizeText(input.fullName).length === 0) {
    issues.push(issue("fullName", "ФИО", "Укажите ФИО."));
  }

  if (input.includePosition) {
    if (normalizeText(input.position ?? "").length === 0) {
      issues.push(issue("position", "Должность", "Укажите должность."));
    }
  }

  if (input.includeAddress !== false && normalizeText(input.address ?? "").length === 0) {
    issues.push(issue("address", "Адрес", "Укажите адрес."));
  }

  if (normalizedPassportNumber.length === 0) {
    issues.push(issue("passportNumber", "Паспорт", "Укажите номер паспорта."));
  } else if (!passportPattern.test(normalizedPassportNumber)) {
    issues.push(issue("passportNumber", "Паспорт", "Паспорт должен содержать от 1 до 6 цифр."));
  }

  if (normalizedPhone.length === 0) {
    issues.push(issue("phone", "Телефон", "Укажите телефон."));
  } else if (!phonePattern.test(normalizedPhone)) {
    issues.push(issue("phone", "Телефон", "Телефон должен быть в формате 123-45-67."));
  }

  if (normalizedIcEmail.length === 0) {
    issues.push(issue("icEmail", "Игровая почта", "Укажите игровую почту."));
  }

  if (normalizedPassportImageUrl.length === 0) {
    issues.push(issue("passportImageUrl", "Ссылка на скрин паспорта", "Укажите ссылку на скрин паспорта."));
  } else if (!isSafeUrl(normalizedPassportImageUrl)) {
    issues.push(
      issue(
        "passportImageUrl",
        "Ссылка на скрин паспорта",
        "Ссылка на скрин паспорта должна быть корректным URL.",
      ),
    );
  }

  return issues;
}

export function validateOgpCharacterProfile(input: OgpCharacterGenerationProfile) {
  return validateIdentityFields({
    ...input,
    includePosition: true,
    position: input.position,
  });
}

export function validateOgpTrustorProfile(input: OgpTrustorGenerationProfile) {
  return validateIdentityFields({
    ...input,
    includePosition: false,
  });
}

function readEvidenceText(row: unknown, key: string) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return "";
  }

  const value = (row as Record<string, unknown>)[key];

  return typeof value === "string" ? normalizeText(value) : "";
}

function countUsableEvidenceRows(groups: OgpEvidenceLike[]) {
  return groups.reduce(
    (count, group) =>
      count +
      group.rows.filter((row) => {
        const url = readEvidenceText(row, "url");
        const labelSnapshot = readEvidenceText(row, "labelSnapshot") || readEvidenceText(row, "label");

        return url.length > 0 && labelSnapshot.length > 0;
      }).length,
    0,
  );
}

export function validateOgpDocumentPayload(input: OgpDocumentGenerationPayload) {
  const issues: OgpChecklistIssue[] = [];
  const appealNumber = normalizeText(input.appealNumber);

  if (appealNumber.length === 0) {
    issues.push(issue("appealNumber", "Номер обращения", "Укажите номер обращения."));
  } else if (!digitsOnlyPattern.test(appealNumber)) {
    issues.push(issue("appealNumber", "Номер обращения", "Укажите номер обращения только цифрами."));
  }

  if (normalizeText(input.organizationName).length === 0) {
    issues.push(issue("organizationName", "Организация", "Укажите организацию."));
  }

  if (normalizeText(input.subjectLabel).length === 0) {
    issues.push(issue("subjectLabel", "Субъект жалобы", "Укажите субъект жалобы."));
  }

  if (normalizeText(input.incidentAt).length === 0) {
    issues.push(issue("incidentAt", "Дата и время инцидента", "Укажите дату и время инцидента."));
  }

  if (input.situationDescription.trim().length === 0) {
    issues.push(issue("situationDescription", "Описание ситуации", "Заполните описание ситуации."));
  }

  if (input.violationSummary.trim().length === 0) {
    issues.push(issue("violationSummary", "Суть нарушения", "Заполните краткую суть нарушения."));
  }

  if (countUsableEvidenceRows(input.evidenceGroups) === 0) {
    issues.push(issue("evidenceList", "Доказательства", "Добавьте хотя бы один элемент в список доказательств."));
  }

  return issues;
}

export function getOgpGenerationReadyState(input: {
  characterIssues: OgpChecklistIssue[];
  trustorIssues: OgpChecklistIssue[];
  documentIssues: OgpChecklistIssue[];
}): OgpGenerationReadyState {
  const blockedSections = [
    input.characterIssues.length > 0,
    input.trustorIssues.length > 0,
    input.documentIssues.length > 0,
  ].filter(Boolean).length;

  if (blockedSections === 0) {
    return "generation_ready";
  }

  if (blockedSections > 1) {
    return "blocked_by_multiple_sections";
  }

  if (input.characterIssues.length > 0) {
    return "blocked_by_character_profile";
  }

  if (input.trustorIssues.length > 0) {
    return "blocked_by_trustor_snapshot";
  }

  return "blocked_by_document_payload";
}

export function buildOgpGenerationValidationResult(input: {
  characterProfile: OgpCharacterGenerationProfile;
  trustorProfile?: OgpTrustorGenerationProfile | null;
  documentPayload: OgpDocumentGenerationPayload;
}) {
  const characterIssues = validateOgpCharacterProfile(input.characterProfile);
  const trustorIssues = input.trustorProfile ? validateOgpTrustorProfile(input.trustorProfile) : [];
  const documentIssues = validateOgpDocumentPayload(input.documentPayload);
  const readyState = getOgpGenerationReadyState({
    characterIssues,
    trustorIssues,
    documentIssues,
  });

  return {
    characterIssues,
    trustorIssues,
    documentIssues,
    readyState,
    isReady: readyState === "generation_ready",
  } satisfies OgpGenerationValidationResult;
}

export function readCharacterProfileData(
  profileDataJson: unknown,
): CharacterProfileDataRecord {
  const profileRecord =
    profileDataJson && typeof profileDataJson === "object" && !Array.isArray(profileDataJson)
      ? (profileDataJson as Record<string, unknown>)
      : null;

  const readString = (key: string) => {
    const value = profileRecord?.[key];

    return typeof value === "string" ? value : "";
  };

  return {
    position: normalizeText(readString("position")),
    address: normalizeText(readString("address")),
    phone: normalizePhone(readString("phone")),
    icEmail: normalizeIcEmail(readString("icEmail")),
    passportImageUrl: normalizeSafeUrl(readString("passportImageUrl")),
    signature: normalizeOptionalText(readString("signature")),
    note: normalizeOptionalText(readString("note")),
  };
}

export function buildCharacterProfileDataJson(input: {
  position: string;
  address: string;
  phone: string;
  icEmail: string;
  passportImageUrl: string;
  signature: string;
  note: string;
}) {
  const normalized = {
    position: normalizeText(input.position),
    address: normalizeText(input.address),
    phone: normalizePhone(input.phone),
    icEmail: normalizeIcEmail(input.icEmail),
    passportImageUrl: normalizeSafeUrl(input.passportImageUrl),
    signature: normalizeText(input.signature),
    note: normalizeText(input.note),
  };

  return Object.values(normalized).some((value) => value.length > 0) ? normalized : null;
}

export function isOgpCharacterProfileComplete(input: {
  fullName: string;
  passportNumber: string;
  profileDataJson: unknown;
}) {
  const profileData = readCharacterProfileData(input.profileDataJson);

  return validateOgpCharacterProfile({
    fullName: input.fullName,
    position: profileData.position,
    address: profileData.address,
    passportNumber: input.passportNumber,
    phone: profileData.phone,
    icEmail: profileData.icEmail,
    passportImageUrl: profileData.passportImageUrl,
  }).length === 0;
}

export function isOgpTrustorRepresentativeReady(input: {
  fullName: string;
  passportNumber: string;
  phone: string | null;
  icEmail: string | null;
  passportImageUrl: string | null;
}) {
  return (
    validateIdentityFields({
      fullName: input.fullName,
      passportNumber: input.passportNumber,
      includeAddress: false,
      phone: input.phone ?? "",
      icEmail: input.icEmail ?? "",
      passportImageUrl: input.passportImageUrl ?? "",
    }).length === 0
  );
}
