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

export const OGP_COMPLAINT_BBCODE_TEMPLATE_VERSION = "ogp_complaint_bbcode_template_v1";
export const OGP_COMPLAINT_GENERATION_LAW_SNAPSHOT_VERSION = "current_primary_snapshot_v1";

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

function normalizeTextBlock(value: string) {
  return value.trim().replace(/\r\n/g, "\n");
}

function toBulletLine(value: string) {
  return value.trim().length > 0 ? value.trim() : "Не указано";
}

function renderSection(title: string, body: string) {
  return `[b]${title}[/b]\n${body}`;
}

function renderTrustorBlock(payload: OgpComplaintDraftPayload) {
  if (payload.filingMode !== "representative" || !payload.trustorSnapshot) {
    return "";
  }

  return [
    `[b]Доверитель:[/b] ${toBulletLine(payload.trustorSnapshot.fullName)}`,
    `[b]Паспорт доверителя:[/b] ${toBulletLine(payload.trustorSnapshot.passportNumber)}`,
    `[b]Телефон доверителя:[/b] ${toBulletLine(payload.trustorSnapshot.phone)}`,
    `[b]IC email доверителя:[/b] ${toBulletLine(payload.trustorSnapshot.icEmail)}`,
    `[b]Скрин паспорта доверителя:[/b] ${toBulletLine(payload.trustorSnapshot.passportImageUrl)}`,
    payload.trustorSnapshot.note.trim().length > 0
      ? `[b]Примечание по доверителю:[/b] ${payload.trustorSnapshot.note.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderEvidenceSection(payload: OgpComplaintDraftPayload) {
  if (payload.evidenceGroups.length === 0) {
    return "[list]\n[*]Отдельные ссылки на доказательства не приложены.\n[/list]";
  }

  const lines: string[] = ["[list]"];

  for (const group of payload.evidenceGroups) {
    lines.push(`[*][b]${toBulletLine(group.title || "Без названия группы")}[/b]`);
    lines.push("[list]");

    if (group.rows.length === 0) {
      lines.push("[*]Внутри этой группы ссылки пока не добавлены.");
    } else {
      for (const row of group.rows) {
        const label = toBulletLine(row.label || "Ссылка");
        const linkPart = row.url.trim().length > 0 ? `[url=${row.url.trim()}]${row.url.trim()}[/url]` : "Ссылка не указана";
        const notePart = row.note.trim().length > 0 ? ` — ${row.note.trim()}` : "";

        lines.push(`[*]${label}: ${linkPart}${notePart}`);
      }
    }

    lines.push("[/list]");
  }

  lines.push("[/list]");

  return lines.join("\n");
}

function buildOgpComplaintBbcode(input: {
  server: {
    name: string;
    code: string;
  };
  authorSnapshot: DocumentAuthorSnapshot;
  payload: OgpComplaintDraftPayload;
}) {
  const trustorBlock = renderTrustorBlock(input.payload);
  const descriptiveSections = [
    "[center][b]ЖАЛОБА В ОГП[/b][/center]",
    "",
    `[b]Сервер:[/b] ${input.server.name} (${input.server.code})`,
    `[b]Номер обращения:[/b] ${toBulletLine(input.payload.appealNumber)}`,
    `[b]Режим подачи:[/b] ${input.payload.filingMode === "representative" ? "Через представителя" : "Лично"}`,
    `[b]Заявитель:[/b] ${input.authorSnapshot.fullName}`,
    `[b]Должность заявителя:[/b] ${toBulletLine(input.authorSnapshot.position)}`,
    `[b]Паспорт заявителя:[/b] ${input.authorSnapshot.passportNumber}`,
    `[b]Телефон заявителя:[/b] ${toBulletLine(input.authorSnapshot.phone)}`,
    `[b]IC email заявителя:[/b] ${toBulletLine(input.authorSnapshot.icEmail)}`,
    `[b]Скрин паспорта заявителя:[/b] ${toBulletLine(input.authorSnapshot.passportImageUrl)}`,
    trustorBlock,
    `[b]Орган / подразделение:[/b] ${toBulletLine(input.payload.objectOrganization)}`,
    `[b]Объект жалобы:[/b] ${toBulletLine(input.payload.objectFullName)}`,
    `[b]Дата и время инцидента:[/b] ${formatIncidentAt(input.payload.incidentAt)}`,
    "",
    renderSection("Описание ситуации", normalizeTextBlock(input.payload.situationDescription)),
    "",
    renderSection("Суть нарушения", normalizeTextBlock(input.payload.violationSummary)),
    "",
    renderSection("Доказательства", renderEvidenceSection(input.payload)),
  ];

  return descriptiveSections.filter(Boolean).join("\n");
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
      phone: input.authorSnapshot.phone,
      icEmail: input.authorSnapshot.icEmail,
      passportImageUrl: input.authorSnapshot.passportImageUrl,
    },
    trustorProfile:
      input.payload.filingMode === "representative" && input.payload.trustorSnapshot
        ? {
            fullName: input.payload.trustorSnapshot.fullName,
            passportNumber: input.payload.trustorSnapshot.passportNumber,
            phone: input.payload.trustorSnapshot.phone,
            icEmail: input.payload.trustorSnapshot.icEmail,
            passportImageUrl: input.payload.trustorSnapshot.passportImageUrl,
          }
        : null,
    documentPayload: {
      appealNumber: input.payload.appealNumber,
      objectOrganization: input.payload.objectOrganization,
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
  const bbcode = buildOgpComplaintBbcode({
    server: {
      code: document.server.code,
      name: document.server.name,
    },
    authorSnapshot,
    payload,
  });
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
