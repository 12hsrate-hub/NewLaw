import { createHash } from "node:crypto";

import {
  getDocumentByIdForAccount,
  markDocumentGeneratedRecord,
  updateDocumentPublicationMetadataRecord,
} from "@/db/repositories/document.repository";
import { listCurrentPrimaryLawVersionIdsByServer } from "@/db/repositories/law.repository";
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

const generationBlockingReasonLabels = {
  profile_incomplete: "Профиль персонажа неполный. Для генерации нужно заполнить обязательные поля профиля.",
  appeal_number_missing: "Для генерации укажите appeal number.",
  object_organization_missing: "Для генерации укажите object organization.",
  object_full_name_missing: "Для генерации укажите object full name.",
  incident_at_missing: "Для генерации укажите дату и время инцидента.",
  situation_description_missing: "Для генерации заполните situation description.",
  violation_summary_missing: "Для генерации заполните violation summary.",
  trustor_full_name_missing: "Для representative filing укажите ФИО доверителя.",
  trustor_passport_missing: "Для representative filing укажите паспорт доверителя.",
} as const;

export type OgpComplaintGenerationBlockingReason = keyof typeof generationBlockingReasonLabels;

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
  constructor(readonly reasons: OgpComplaintGenerationBlockingReason[]) {
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
    `[b]Паспорт заявителя:[/b] ${input.authorSnapshot.passportNumber}`,
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

function getOgpComplaintGenerationBlockingReasons(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: OgpComplaintDraftPayload;
}) {
  const reasons: OgpComplaintGenerationBlockingReason[] = [];
  const payload = input.payload;

  if (!input.authorSnapshot.isProfileComplete) {
    reasons.push("profile_incomplete");
  }

  if (payload.appealNumber.trim().length === 0) {
    reasons.push("appeal_number_missing");
  }

  if (payload.objectOrganization.trim().length === 0) {
    reasons.push("object_organization_missing");
  }

  if (payload.objectFullName.trim().length === 0) {
    reasons.push("object_full_name_missing");
  }

  if (payload.incidentAt.trim().length === 0) {
    reasons.push("incident_at_missing");
  }

  if (payload.situationDescription.trim().length === 0) {
    reasons.push("situation_description_missing");
  }

  if (payload.violationSummary.trim().length === 0) {
    reasons.push("violation_summary_missing");
  }

  if (payload.filingMode === "representative") {
    if (!payload.trustorSnapshot || payload.trustorSnapshot.fullName.trim().length === 0) {
      reasons.push("trustor_full_name_missing");
    }

    if (!payload.trustorSnapshot || payload.trustorSnapshot.passportNumber.trim().length === 0) {
      reasons.push("trustor_passport_missing");
    }
  }

  return reasons;
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

export function mapGenerationBlockingReasonsToMessages(
  reasons: OgpComplaintGenerationBlockingReason[],
) {
  return reasons.map((reason) => generationBlockingReasonLabels[reason]);
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
  const blockingReasons = getOgpComplaintGenerationBlockingReasons({
    authorSnapshot,
    payload,
  });

  if (blockingReasons.length > 0) {
    throw new DocumentGenerationBlockedError(blockingReasons);
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
