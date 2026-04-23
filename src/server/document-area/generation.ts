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

export const OGP_COMPLAINT_BBCODE_TEMPLATE_VERSION = "ogp_complaint_bbcode_template_v3";
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

function renderPassportUrl(value: string) {
  const url = value.trim();

  return `[URL='${escapeBbcodeAttribute(url)}']паспорт[/URL]`;
}

export function buildOgpRenderContext(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: OgpComplaintDraftPayload;
  generatedAt: Date;
}) {
  const trustorSnapshot = input.payload.trustorSnapshot;
  const filingMode: OgpTemplateBranch =
    input.payload.filingMode === "representative" ? "ogp_representative" : "ogp_self";

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
    signatureShort: buildSignatureShort(input.authorSnapshot.fullName),
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

function renderComplaintList(context: OgpRenderContext) {
  return [
    "[B]Суть обращения:[/B]",
    "[LIST=1]",
    `[*]Организация, в которой состоит объект заявления: ${context.organizationName}`,
    `[*]Объект заявления (имя и фамилия, удостоверение, бейджик, нашивка, жетон): ${context.subjectLabel}`,
    `[*]Подробное описание ситуации: ${context.situationDescription}`,
    `[*]Формулировка сути нарушения: ${context.violationSummary}`,
    `[*]Дата и время описываемых событий: ${context.incidentAtFormatted}`,
    `[*]Доказательства: ${context.evidenceBbcodeInline}`,
    "[/LIST]",
  ].join("\n");
}

function renderApplicantInfoBlock(context: OgpRenderContext) {
  return [
    "[B]Информация о заявителе:[/B]",
    "[LIST=1]",
    `[*]Имя, фамилия: ${context.authorFullName}`,
    `[*]Номер паспорта: ${context.authorPassportNumber}`,
    `[*]Адрес проживания: ${context.authorAddress}`,
    `[*]Номер телефона: ${context.authorPhone}`,
    `[*]Адрес электронной почты: ${context.authorIcEmail}`,
    `[*]Ксерокопия паспорта: ${renderPassportUrl(context.authorPassportUrl)}`,
    "[/LIST]",
  ].join("\n");
}

function renderRepresentativeInfoBlock(context: OgpRenderContext) {
  return [
    "[B]Информация о представителе:[/B]",
    "[LIST=1]",
    `[*]Имя, фамилия: ${context.authorFullName}`,
    `[*]Номер паспорта: ${context.authorPassportNumber}`,
    `[*]Адрес проживания: ${context.authorAddress}`,
    `[*]Номер телефона: ${context.authorPhone}`,
    `[*]Адрес электронной почты: ${context.authorIcEmail}`,
    `[*]Ксерокопия паспорта: ${renderPassportUrl(context.authorPassportUrl)}`,
    "[/LIST]",
  ].join("\n");
}

function renderTrustorInfoBlock(context: OgpRenderContext) {
  return [
    "[B]Информация о подзащитном:[/B]",
    "[LIST=1]",
    `[*]Имя, фамилия: ${context.trustorFullName}`,
    `[*]Номер паспорта: ${context.trustorPassportNumber}`,
    `[*]Адрес проживания: ${context.trustorAddress}`,
    `[*]Номер телефона: ${context.trustorPhone}`,
    `[*]Адрес электронной почты: ${context.trustorIcEmail}`,
    `[*]Ксерокопия паспорта: ${renderPassportUrl(context.trustorPassportUrl)}`,
    "[/LIST]",
  ].join("\n");
}

function renderSignatureBlock(context: OgpRenderContext) {
  return [
    "[RIGHT][/RIGHT]",
    `[B][FONT=trebuchet ms]Дата: [/FONT][/B][FONT=trebuchet ms][U]${context.generatedDateMsk}[/U] г.[/FONT]`,
    `[B][FONT=trebuchet ms]Подпись: [/FONT][/B][FONT=trebuchet ms][U]${context.signatureShort}[/U][/FONT]`,
  ].join("\n");
}

export function renderOgpSelfBbcode(context: OgpRenderContext) {
  return [
    "[RIGHT][I]To: Attorney General's office,",
    "San-Andreas, Burton, Eastbourne Way,",
    "Dear Attorney General Konstantin Belonozhkin,[/I][/RIGHT]",
    "[CENTER]",
    `[SIZE=5]Обращение №${context.appealNumber}[/SIZE]`,
    `Я, гражданин штата Сан-Андреас ${context.authorFullName}, обращаюсь к Вам с просьбой рассмотреть следующую ситуацию и принять необходимые меры в соответствии с законом :`,
    "[/CENTER]",
    renderComplaintList(context),
    renderApplicantInfoBlock(context),
    renderSignatureBlock(context),
  ].join("\n");
}

export function renderOgpRepresentativeBbcode(context: OgpRenderContext) {
  return [
    "[RIGHT][I]To: Attorney General's office,",
    "San-Andreas, Burton, Eastbourne Way,",
    "Dear Attorney General Konstantin Belonozhkin,[/I][/RIGHT]",
    "[CENTER]",
    `[SIZE=5]Обращение №${context.appealNumber}[/SIZE]`,
    `Я, гражданин штата Сан-Андреас ${context.authorFullName}, являясь законным представителем гражданина ${context.trustorFullName} и в его интересах, обращаюсь к Вам с просьбой рассмотреть следующую ситуацию и принять необходимые меры в соответствии с законом :`,
    "[/CENTER]",
    renderComplaintList(context),
    renderRepresentativeInfoBlock(context),
    renderTrustorInfoBlock(context),
    renderSignatureBlock(context),
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
