import { createHash } from "node:crypto";

import {
  getDocumentByIdForAccount,
  markDocumentGeneratedRecord,
  updateDocumentPublicationMetadataRecord,
} from "@/db/repositories/document.repository";
import { listCurrentPrimaryLawVersionIdsByServer } from "@/db/repositories/law.repository";
import {
  buildOgpGenerationValidationResult,
  type OgpGenerationValidationResult,
} from "@/lib/ogp/generation-contract";
import {
  documentPublicationUrlSchema,
  type DocumentAuthorSnapshot,
  type OgpComplaintDraftPayload,
} from "@/schemas/document";
import {
  DocumentAccessDeniedError,
  readDocumentAuthorSnapshot,
  readOgpComplaintDraftPayload,
} from "@/server/document-area/persistence";

export const OGP_COMPLAINT_BBCODE_TEMPLATE_VERSION = "ogp_complaint_bbcode_template_v2";
export const OGP_COMPLAINT_GENERATION_LAW_SNAPSHOT_VERSION = "current_primary_snapshot_v1";

type OgpTemplateBranch = "ogp_self" | "ogp_representative";

type OgpEvidenceRenderItem = {
  id: string;
  mode: string;
  templateKey: string;
  labelSnapshot: string;
  url: string;
  sortOrder: number;
};

export type OgpRenderContext = {
  filingMode: OgpTemplateBranch;
  appealNumber: string;
  organizationName: string;
  subjectLabel: string;
  incidentAtFormatted: string;
  situationDescription: string;
  violationSummary: string;
  evidenceBbcodeInline: string;
  generatedDateMsk: string;
  signatureShort: string;
  authorFullName: string;
  authorPosition: string;
  authorPassportNumber: string;
  authorAddress: string;
  authorPhone: string;
  authorIcEmail: string;
  authorPassportUrl: string;
  trustorFullName: string;
  trustorPassportNumber: string;
  trustorAddress: string;
  trustorPhone: string;
  trustorIcEmail: string;
  trustorPassportUrl: string;
};

type DocumentGenerationDependencies = {
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  listCurrentPrimaryLawVersionIdsByServer: typeof listCurrentPrimaryLawVersionIdsByServer;
  markDocumentGeneratedRecord: typeof markDocumentGeneratedRecord;
  updateDocumentPublicationMetadataRecord: typeof updateDocumentPublicationMetadataRecord;
  now: () => Date;
};

const defaultDependencies: DocumentGenerationDependencies = {
  getDocumentByIdForAccount,
  listCurrentPrimaryLawVersionIdsByServer,
  markDocumentGeneratedRecord,
  updateDocumentPublicationMetadataRecord,
  now: () => new Date(),
};

export class DocumentGenerationBlockedError extends Error {
  constructor(readonly validation: OgpGenerationValidationResult) {
    super("Документ пока нельзя сгенерировать в BBCode.");
    this.name = "DocumentGenerationBlockedError";
  }
}

export class DocumentPublicationMetadataStateError extends Error {
  constructor() {
    super("Publication metadata можно обновлять только после хотя бы одной успешной генерации.");
    this.name = "DocumentPublicationMetadataStateError";
  }
}

function formatIncidentAt(input: string) {
  if (!input) {
    return "Не указано";
  }

  const [datePart, timePart] = input.split("T");

  if (!datePart || !timePart) {
    return input;
  }

  const [year, month, day] = datePart.split("-");

  if (!year || !month || !day) {
    return input;
  }

  return `${day}.${month}.${year} ${timePart}`;
}

function formatMoscowDate(input: Date) {
  const moscowDate = new Date(input.getTime() + 3 * 60 * 60 * 1000);
  const day = String(moscowDate.getUTCDate()).padStart(2, "0");
  const month = String(moscowDate.getUTCMonth() + 1).padStart(2, "0");
  const year = moscowDate.getUTCFullYear();

  return `${day}.${month}.${year}`;
}

function normalizeTextBlock(value: string) {
  return value.trim().replace(/\r\n/g, "\n");
}

function normalizeInlineText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function escapeBbcodeAttribute(value: string) {
  return value.trim().replace(/'/g, "%27");
}

function buildSignatureShort(fullName: string) {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const firstWord = words[0] ?? "";
  const lastWord = words[words.length - 1] ?? firstWord;

  if (!firstWord || !lastWord) {
    return "";
  }

  return `${firstWord.charAt(0)}.${lastWord}`;
}

function flattenEvidenceItems(payload: OgpComplaintDraftPayload) {
  const evidenceItems: OgpEvidenceRenderItem[] = [];
  let fallbackSortOrder = 0;

  for (const group of payload.evidenceGroups) {
    for (const row of group.rows) {
      const labelSnapshot =
        normalizeInlineText(row.labelSnapshot) ||
        normalizeInlineText(row.label) ||
        normalizeInlineText(group.title) ||
        "Доказательство";

      evidenceItems.push({
        id: row.id,
        mode: normalizeInlineText(row.mode) || "link",
        templateKey: normalizeInlineText(row.templateKey) || "custom",
        labelSnapshot,
        url: row.url.trim(),
        sortOrder: row.sortOrder ?? fallbackSortOrder,
      });
      fallbackSortOrder += 1;
    }
  }

  return evidenceItems.sort((left, right) =>
    left.sortOrder === right.sortOrder
      ? left.id.localeCompare(right.id)
      : left.sortOrder - right.sortOrder,
  );
}

function renderEvidenceInline(payload: OgpComplaintDraftPayload) {
  return flattenEvidenceItems(payload)
    .map((item) => `[URL='${escapeBbcodeAttribute(item.url)}']${item.labelSnapshot}[/URL]`)
    .join(", ");
}

export function buildOgpRenderContext(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: OgpComplaintDraftPayload;
  generatedAt: Date;
}) {
  const trustorSnapshot = input.payload.trustorSnapshot;
  const filingMode: OgpTemplateBranch =
    input.payload.filingMode === "representative" ? "ogp_representative" : "ogp_self";
  const signatureSource =
    filingMode === "ogp_representative" && trustorSnapshot
      ? trustorSnapshot.fullName
      : input.authorSnapshot.fullName;

  return {
    filingMode,
    appealNumber: normalizeInlineText(input.payload.appealNumber),
    organizationName: normalizeInlineText(input.payload.objectOrganization),
    subjectLabel: normalizeInlineText(input.payload.objectFullName),
    incidentAtFormatted: formatIncidentAt(input.payload.incidentAt),
    situationDescription: normalizeTextBlock(input.payload.situationDescription),
    violationSummary: normalizeTextBlock(input.payload.violationSummary),
    evidenceBbcodeInline: renderEvidenceInline(input.payload),
    generatedDateMsk: formatMoscowDate(input.generatedAt),
    signatureShort: buildSignatureShort(signatureSource),
    authorFullName: normalizeInlineText(input.authorSnapshot.fullName),
    authorPosition: normalizeInlineText(input.authorSnapshot.position),
    authorPassportNumber: normalizeInlineText(input.authorSnapshot.passportNumber),
    authorAddress: normalizeInlineText(input.authorSnapshot.address),
    authorPhone: normalizeInlineText(input.authorSnapshot.phone),
    authorIcEmail: normalizeInlineText(input.authorSnapshot.icEmail),
    authorPassportUrl: input.authorSnapshot.passportImageUrl.trim(),
    trustorFullName: normalizeInlineText(trustorSnapshot?.fullName ?? ""),
    trustorPassportNumber: normalizeInlineText(trustorSnapshot?.passportNumber ?? ""),
    trustorAddress: normalizeInlineText(trustorSnapshot?.address ?? ""),
    trustorPhone: normalizeInlineText(trustorSnapshot?.phone ?? ""),
    trustorIcEmail: normalizeInlineText(trustorSnapshot?.icEmail ?? ""),
    trustorPassportUrl: trustorSnapshot?.passportImageUrl.trim() ?? "",
  };
}

function renderCommonComplaintBlock(context: OgpRenderContext) {
  return [
    `[b]Номер обращения:[/b] ${context.appealNumber}`,
    `[b]Организация:[/b] ${context.organizationName}`,
    `[b]Субъект жалобы:[/b] ${context.subjectLabel}`,
    `[b]Дата и время инцидента:[/b] ${context.incidentAtFormatted}`,
    "",
    "[b]Описание ситуации:[/b]",
    context.situationDescription,
    "",
    "[b]Суть нарушения:[/b]",
    context.violationSummary,
    "",
    `[b]Доказательства:[/b] ${context.evidenceBbcodeInline}`,
  ].join("\n");
}

export function renderOgpSelfBbcode(context: OgpRenderContext) {
  return [
    "[center][b]Жалоба в ОГП[/b][/center]",
    "",
    "[b]Информация о заявителе[/b]",
    `[b]ФИО:[/b] ${context.authorFullName}`,
    `[b]Должность:[/b] ${context.authorPosition}`,
    `[b]Паспорт:[/b] ${context.authorPassportNumber}`,
    `[b]Адрес:[/b] ${context.authorAddress}`,
    `[b]Телефон:[/b] ${context.authorPhone}`,
    `[b]IC email:[/b] ${context.authorIcEmail}`,
    `[b]Скрин паспорта:[/b] ${context.authorPassportUrl}`,
    "",
    renderCommonComplaintBlock(context),
    "",
    `[right]${context.signatureShort}`,
    `${context.generatedDateMsk}[/right]`,
  ].join("\n");
}

export function renderOgpRepresentativeBbcode(context: OgpRenderContext) {
  return [
    "[center][b]Жалоба в ОГП от представителя[/b][/center]",
    "",
    "[b]Информация о представителе[/b]",
    `[b]ФИО:[/b] ${context.authorFullName}`,
    `[b]Должность:[/b] ${context.authorPosition}`,
    `[b]Паспорт:[/b] ${context.authorPassportNumber}`,
    `[b]Адрес:[/b] ${context.authorAddress}`,
    `[b]Телефон:[/b] ${context.authorPhone}`,
    `[b]IC email:[/b] ${context.authorIcEmail}`,
    `[b]Скрин паспорта:[/b] ${context.authorPassportUrl}`,
    "",
    "[b]Информация о подзащитном[/b]",
    `[b]ФИО:[/b] ${context.trustorFullName}`,
    `[b]Паспорт:[/b] ${context.trustorPassportNumber}`,
    `[b]Адрес:[/b] ${context.trustorAddress}`,
    `[b]Телефон:[/b] ${context.trustorPhone}`,
    `[b]IC email:[/b] ${context.trustorIcEmail}`,
    `[b]Скрин паспорта:[/b] ${context.trustorPassportUrl}`,
    "",
    renderCommonComplaintBlock(context),
    "",
    `[right]${context.signatureShort}`,
    `${context.generatedDateMsk}[/right]`,
  ].join("\n");
}

function renderOgpBbcode(context: OgpRenderContext) {
  return context.filingMode === "ogp_representative"
    ? renderOgpRepresentativeBbcode(context)
    : renderOgpSelfBbcode(context);
}

function getOgpComplaintGenerationValidation(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: OgpComplaintDraftPayload;
}) {
  return buildOgpGenerationValidationResult({
    characterProfile: {
      fullName: input.authorSnapshot.fullName,
      position: input.authorSnapshot.position,
      passportNumber: input.authorSnapshot.passportNumber,
      address: input.authorSnapshot.address,
      phone: input.authorSnapshot.phone,
      icEmail: input.authorSnapshot.icEmail,
      passportImageUrl: input.authorSnapshot.passportImageUrl,
    },
    trustorProfile:
      input.payload.filingMode === "representative" && input.payload.trustorSnapshot
        ? {
            fullName: input.payload.trustorSnapshot.fullName,
            passportNumber: input.payload.trustorSnapshot.passportNumber,
            address: input.payload.trustorSnapshot.address,
            phone: input.payload.trustorSnapshot.phone,
            icEmail: input.payload.trustorSnapshot.icEmail,
            passportImageUrl: input.payload.trustorSnapshot.passportImageUrl,
          }
        : null,
    documentPayload: {
      appealNumber: input.payload.appealNumber,
      organizationName: input.payload.objectOrganization,
      subjectLabel: input.payload.objectFullName,
      incidentAt: input.payload.incidentAt,
      situationDescription: input.payload.situationDescription,
      violationSummary: input.payload.violationSummary,
      evidenceGroups: input.payload.evidenceGroups,
    },
  });
}

function buildGeneratedLawVersion(serverId: string, currentVersionIds: string[]) {
  if (currentVersionIds.length === 0) {
    return `${OGP_COMPLAINT_GENERATION_LAW_SNAPSHOT_VERSION}:${serverId}:empty`;
  }

  const hash = createHash("sha256")
    .update(currentVersionIds.slice().sort().join("|"))
    .digest("hex")
    .slice(0, 20);

  return `${OGP_COMPLAINT_GENERATION_LAW_SNAPSHOT_VERSION}:${serverId}:${currentVersionIds.length}:${hash}`;
}

export async function generateOwnedOgpComplaintBbcode(
  input: {
    accountId: string;
    documentId: string;
  },
  dependencies: DocumentGenerationDependencies = defaultDependencies,
) {
  const document = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!document || document.documentType !== "ogp_complaint") {
    throw new DocumentAccessDeniedError();
  }

  const authorSnapshot = readDocumentAuthorSnapshot(document.authorSnapshotJson);
  const payload = readOgpComplaintDraftPayload(document.formPayloadJson);
  const validation = getOgpComplaintGenerationValidation({
    authorSnapshot,
    payload,
  });

  if (!validation.isReady) {
    throw new DocumentGenerationBlockedError(validation);
  }

  const generatedAt = dependencies.now();
  const currentLawVersionIds = await dependencies.listCurrentPrimaryLawVersionIdsByServer(
    document.serverId,
  );
  const renderContext = buildOgpRenderContext({
    authorSnapshot,
    payload,
    generatedAt,
  });
  const bbcode = renderOgpBbcode(renderContext);
  const generatedDocument = await dependencies.markDocumentGeneratedRecord({
    documentId: document.id,
    lastGeneratedBbcode: bbcode,
    generatedAt,
    generatedLawVersion: buildGeneratedLawVersion(document.serverId, currentLawVersionIds),
    generatedTemplateVersion: OGP_COMPLAINT_BBCODE_TEMPLATE_VERSION,
    generatedFormSchemaVersion: document.formSchemaVersion,
  });

  if (!generatedDocument) {
    throw new DocumentAccessDeniedError();
  }

  return generatedDocument;
}

export async function updateOwnedDocumentPublicationMetadata(
  input: {
    accountId: string;
    documentId: string;
    publicationUrl: string;
    isSiteForumSynced: boolean;
  },
  dependencies: DocumentGenerationDependencies = defaultDependencies,
) {
  const document = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!document || document.documentType !== "ogp_complaint") {
    throw new DocumentAccessDeniedError();
  }

  const publicationUrl = documentPublicationUrlSchema.parse(input.publicationUrl);

  if (publicationUrl.length > 0 && !document.generatedAt) {
    throw new DocumentPublicationMetadataStateError();
  }

  const updatedDocument = await dependencies.updateDocumentPublicationMetadataRecord({
    documentId: document.id,
    publicationUrl,
    isSiteForumSynced: input.isSiteForumSynced,
  });

  if (!updatedDocument) {
    throw new DocumentAccessDeniedError();
  }

  return updatedDocument;
}
