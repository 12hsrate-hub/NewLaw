import { getDocumentByIdForAccount } from "@/db/repositories/document.repository";
import type {
  ClaimDocumentType,
  ClaimsDraftPayload,
  ClaimsRenderedOutput,
  ClaimsRenderedSection,
  DocumentAuthorSnapshot,
  LawsuitClaimDraftPayload,
  OgpComplaintEvidenceGroup,
  RehabilitationClaimDraftPayload,
} from "@/schemas/document";
import { claimsRenderedOutputSchema } from "@/schemas/document";
import {
  DocumentAccessDeniedError,
  isClaimsDocumentType,
  readClaimsDraftPayload,
  readDocumentAuthorSnapshot,
} from "@/server/document-area/persistence";

export const CLAIMS_STRUCTURED_PREVIEW_FORMAT = "claims_structured_preview_v1";
export const CLAIMS_STRUCTURED_RENDERER_VERSION = "claims_structured_renderer_v1";

const claimsOutputBlockingReasonLabels = {
  profile_incomplete:
    "Профиль персонажа неполный. Для structured preview нужно заполнить обязательные поля профиля.",
  respondent_name_missing: "Для structured preview укажите respondent name.",
  claim_subject_missing: "Для structured preview укажите claim subject.",
  factual_background_missing: "Для structured preview заполните factual background.",
  legal_basis_summary_missing: "Для structured preview заполните legal basis summary.",
  requested_relief_missing: "Для structured preview заполните requested relief.",
  trustor_full_name_missing: "Для representative filing укажите ФИО доверителя.",
  trustor_passport_missing: "Для representative filing укажите паспорт доверителя.",
  case_reference_missing: "Для rehabilitation output укажите case reference.",
  rehabilitation_basis_missing: "Для rehabilitation output заполните rehabilitation basis.",
  harm_summary_missing: "Для rehabilitation output заполните harm summary.",
  court_name_missing: "Для lawsuit output укажите court name.",
  defendant_name_missing: "Для lawsuit output укажите defendant name.",
  pretrial_summary_missing: "Для lawsuit output заполните pretrial summary.",
} as const;

export type ClaimsOutputBlockingReason = keyof typeof claimsOutputBlockingReasonLabels;

type ClaimsRenderingDependencies = {
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
};

const defaultDependencies: ClaimsRenderingDependencies = {
  getDocumentByIdForAccount,
};

export class ClaimsOutputBlockedError extends Error {
  constructor(readonly reasons: ClaimsOutputBlockingReason[]) {
    super("Claims structured preview пока нельзя построить.");
    this.name = "ClaimsOutputBlockedError";
  }
}

function toDisplayValue(value: string) {
  return value.trim().length > 0 ? value.trim() : "Не указано";
}

function normalizeTextBlock(value: string) {
  const normalized = value.trim().replace(/\r\n/g, "\n");

  return normalized.length > 0 ? normalized : "Не указано";
}

function formatClaimDocumentType(documentType: ClaimDocumentType) {
  return documentType === "rehabilitation" ? "Rehabilitation" : "Lawsuit";
}

function formatFilingMode(value: ClaimsDraftPayload["filingMode"]) {
  return value === "representative" ? "Через представителя" : "Лично";
}

function renderEvidenceSection(evidenceGroups: OgpComplaintEvidenceGroup[]) {
  if (evidenceGroups.length === 0) {
    return "Отдельные evidence links пока не добавлены.";
  }

  const lines: string[] = [];

  evidenceGroups.forEach((group, groupIndex) => {
    lines.push(`${groupIndex + 1}. ${toDisplayValue(group.title || `Группа ${groupIndex + 1}`)}`);

    if (group.rows.length === 0) {
      lines.push("   - Внутри этой группы ссылки пока не добавлены.");
      return;
    }

    group.rows.forEach((row) => {
      const rowLabel = toDisplayValue(row.label || "Ссылка");
      const rowUrl = row.url.trim().length > 0 ? row.url.trim() : "Ссылка не указана";
      const rowNote = row.note.trim().length > 0 ? ` (${row.note.trim()})` : "";

      lines.push(`   - ${rowLabel}: ${rowUrl}${rowNote}`);
    });
  });

  return lines.join("\n");
}

function buildCopyText(sections: ClaimsRenderedSection[]) {
  return sections.map((section) => `${section.title}\n${section.body}`).join("\n\n");
}

function buildClaimsSections(input: {
  document: {
    title: string;
    documentType: ClaimDocumentType;
    server: {
      code: string;
      name: string;
    };
  };
  authorSnapshot: DocumentAuthorSnapshot;
  payload: ClaimsDraftPayload;
}) {
  const sections: ClaimsRenderedSection[] = [
    {
      key: "header",
      title: "Документ",
      body: [
        `Название: ${toDisplayValue(input.document.title)}`,
        `Family: Claims`,
        `Subtype: ${formatClaimDocumentType(input.document.documentType)}`,
        `Сервер: ${input.document.server.name} (${input.document.server.code})`,
      ].join("\n"),
    },
    {
      key: "filing_mode",
      title: "Режим подачи",
      body: formatFilingMode(input.payload.filingMode),
    },
    {
      key: "claimant",
      title: input.payload.filingMode === "representative" ? "Представитель" : "Заявитель",
      body: [
        `ФИО: ${input.authorSnapshot.fullName}`,
        `Паспорт: ${input.authorSnapshot.passportNumber}`,
        `Nickname snapshot: ${input.authorSnapshot.nickname}`,
      ].join("\n"),
    },
  ];

  if (input.payload.filingMode === "representative" && input.payload.trustorSnapshot) {
    sections.push({
      key: "trustor",
      title: "Доверитель",
      body: [
        `ФИО: ${toDisplayValue(input.payload.trustorSnapshot.fullName)}`,
        `Паспорт: ${toDisplayValue(input.payload.trustorSnapshot.passportNumber)}`,
        `Примечание: ${toDisplayValue(input.payload.trustorSnapshot.note)}`,
      ].join("\n"),
    });
  }

  sections.push(
    {
      key: "respondent",
      title: "Ответчик / орган",
      body: toDisplayValue(input.payload.respondentName),
    },
    {
      key: "claim_subject",
      title: "Предмет требования",
      body: toDisplayValue(input.payload.claimSubject),
    },
  );

  if (input.document.documentType === "rehabilitation") {
    const rehabilitationPayload = input.payload as RehabilitationClaimDraftPayload;

    sections.push({
      key: "rehabilitation_specific",
      title: "Rehabilitation-specific section",
      body: [
        `Case reference: ${toDisplayValue(rehabilitationPayload.caseReference)}`,
        `Rehabilitation basis: ${normalizeTextBlock(rehabilitationPayload.rehabilitationBasis)}`,
        `Harm summary: ${normalizeTextBlock(rehabilitationPayload.harmSummary)}`,
      ].join("\n"),
    });
  } else {
    const lawsuitPayload = input.payload as LawsuitClaimDraftPayload;
    const lawsuitLines = [
      `Court name: ${toDisplayValue(lawsuitPayload.courtName)}`,
      `Defendant name: ${toDisplayValue(lawsuitPayload.defendantName)}`,
    ];

    if (lawsuitPayload.claimAmount.trim().length > 0) {
      lawsuitLines.push(`Claim amount: ${lawsuitPayload.claimAmount.trim()}`);
    }

    lawsuitLines.push(`Pretrial summary: ${normalizeTextBlock(lawsuitPayload.pretrialSummary)}`);

    sections.push({
      key: "lawsuit_specific",
      title: "Lawsuit-specific section",
      body: lawsuitLines.join("\n"),
    });
  }

  sections.push(
    {
      key: "factual_background",
      title: "Фактические обстоятельства",
      body: normalizeTextBlock(input.payload.factualBackground),
    },
    {
      key: "legal_basis_summary",
      title: "Правовые основания",
      body: normalizeTextBlock(input.payload.legalBasisSummary),
    },
    {
      key: "requested_relief",
      title: "Просительная часть",
      body: normalizeTextBlock(input.payload.requestedRelief),
    },
    {
      key: "evidence",
      title: "Доказательства",
      body: renderEvidenceSection(input.payload.evidenceGroups),
    },
  );

  if (input.payload.workingNotes.trim().length > 0) {
    sections.push({
      key: "working_notes",
      title: "Рабочие заметки",
      body: normalizeTextBlock(input.payload.workingNotes),
    });
  }

  return sections;
}

function getClaimsOutputBlockingReasons(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: ClaimsDraftPayload;
  documentType: ClaimDocumentType;
}) {
  const reasons: ClaimsOutputBlockingReason[] = [];

  if (!input.authorSnapshot.isProfileComplete) {
    reasons.push("profile_incomplete");
  }

  if (input.payload.respondentName.trim().length === 0) {
    reasons.push("respondent_name_missing");
  }

  if (input.payload.claimSubject.trim().length === 0) {
    reasons.push("claim_subject_missing");
  }

  if (input.payload.factualBackground.trim().length === 0) {
    reasons.push("factual_background_missing");
  }

  if (input.payload.legalBasisSummary.trim().length === 0) {
    reasons.push("legal_basis_summary_missing");
  }

  if (input.payload.requestedRelief.trim().length === 0) {
    reasons.push("requested_relief_missing");
  }

  if (input.payload.filingMode === "representative") {
    if (!input.payload.trustorSnapshot || input.payload.trustorSnapshot.fullName.trim().length === 0) {
      reasons.push("trustor_full_name_missing");
    }

    if (!input.payload.trustorSnapshot || input.payload.trustorSnapshot.passportNumber.trim().length === 0) {
      reasons.push("trustor_passport_missing");
    }
  }

  if (input.documentType === "rehabilitation") {
    const rehabilitationPayload = input.payload as RehabilitationClaimDraftPayload;

    if (rehabilitationPayload.caseReference.trim().length === 0) {
      reasons.push("case_reference_missing");
    }

    if (rehabilitationPayload.rehabilitationBasis.trim().length === 0) {
      reasons.push("rehabilitation_basis_missing");
    }

    if (rehabilitationPayload.harmSummary.trim().length === 0) {
      reasons.push("harm_summary_missing");
    }

    return reasons;
  }

  const lawsuitPayload = input.payload as LawsuitClaimDraftPayload;

  if (lawsuitPayload.courtName.trim().length === 0) {
    reasons.push("court_name_missing");
  }

  if (lawsuitPayload.defendantName.trim().length === 0) {
    reasons.push("defendant_name_missing");
  }

  if (lawsuitPayload.pretrialSummary.trim().length === 0) {
    reasons.push("pretrial_summary_missing");
  }

  return reasons;
}

export function mapClaimsOutputBlockingReasonsToMessages(reasons: ClaimsOutputBlockingReason[]) {
  return reasons.map((reason) => claimsOutputBlockingReasonLabels[reason]);
}

export function renderClaimsStructuredPreviewFromDocument(input: {
  document: {
    title: string;
    documentType: ClaimDocumentType;
    server: {
      code: string;
      name: string;
    };
    authorSnapshotJson: unknown;
    formPayloadJson: unknown;
  };
}) {
  const document = input.document;
  const authorSnapshot = readDocumentAuthorSnapshot(document.authorSnapshotJson);
  const payload = readClaimsDraftPayload(document.documentType, document.formPayloadJson);
  const blockingReasons = getClaimsOutputBlockingReasons({
    authorSnapshot,
    payload,
    documentType: document.documentType,
  });

  if (blockingReasons.length > 0) {
    throw new ClaimsOutputBlockedError(blockingReasons);
  }

  const sections = buildClaimsSections({
    document: {
      title: document.title,
      documentType: document.documentType,
      server: {
        code: document.server.code,
        name: document.server.name,
      },
    },
    authorSnapshot,
    payload,
  });

  return {
    family: "claims",
    documentType: document.documentType,
    format: CLAIMS_STRUCTURED_PREVIEW_FORMAT,
    rendererVersion: CLAIMS_STRUCTURED_RENDERER_VERSION,
    sections,
    copyText: buildCopyText(sections),
    blockingReasons: [],
  } satisfies ClaimsRenderedOutput;
}

export async function renderOwnedClaimsStructuredPreview(
  input: {
    accountId: string;
    documentId: string;
  },
  dependencies: ClaimsRenderingDependencies = defaultDependencies,
): Promise<ClaimsRenderedOutput> {
  const document = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!document || !isClaimsDocumentType(document.documentType)) {
    throw new DocumentAccessDeniedError();
  }

  return renderClaimsStructuredPreviewFromDocument({
    document: {
      title: document.title,
      documentType: document.documentType,
      server: {
        code: document.server.code,
        name: document.server.name,
      },
      authorSnapshotJson: document.authorSnapshotJson,
      formPayloadJson: document.formPayloadJson,
    },
  });
}

export function readClaimsGeneratedArtifact(input: unknown): ClaimsRenderedOutput | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const parsed = claimsRenderedOutputSchema.safeParse(input);

  return parsed.success ? parsed.data : null;
}
