import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  createDocumentDraftInputSchema,
  documentIdSchema,
  type DocumentType,
  updateDocumentDraftInputSchema,
} from "@/schemas/document";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function createDocumentRecord(
  input: {
    accountId: string;
    serverId: string;
    characterId: string;
    documentType: DocumentType;
    title: string;
    formSchemaVersion: string;
    snapshotCapturedAt: Date;
    authorSnapshotJson: Record<string, unknown>;
    formPayloadJson?: Record<string, unknown>;
  },
  db: PrismaLike = prisma,
) {
  const parsed = createDocumentDraftInputSchema.parse(input);

  return db.document.create({
    data: {
      accountId: parsed.accountId,
      serverId: parsed.serverId,
      characterId: parsed.characterId,
      documentType: parsed.documentType,
      title: parsed.title,
      status: "draft",
      formSchemaVersion: parsed.formSchemaVersion,
      snapshotCapturedAt: parsed.snapshotCapturedAt,
      authorSnapshotJson: parsed.authorSnapshotJson as Prisma.InputJsonValue,
      formPayloadJson: (parsed.formPayloadJson ?? {}) as Prisma.InputJsonValue,
    },
    include: {
      server: true,
      character: {
        include: {
          roles: true,
          accessFlags: true,
        },
      },
    },
  });
}

export async function getDocumentByIdForAccount(
  input: {
    accountId: string;
    documentId: string;
  },
  db: PrismaLike = prisma,
) {
  return db.document.findFirst({
    where: {
      id: documentIdSchema.parse(input.documentId),
      accountId: input.accountId,
      deletedAt: null,
    },
    include: {
      server: true,
      character: {
        include: {
          roles: true,
          accessFlags: true,
        },
      },
    },
  });
}

export async function listDocumentsByAccount(accountId: string, db: PrismaLike = prisma) {
  return db.document.findMany({
    where: {
      accountId,
      deletedAt: null,
    },
    include: {
      server: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function listDocumentsByAccountAndServerAndType(
  input: {
    accountId: string;
    serverId: string;
    documentType: DocumentType;
  },
  db: PrismaLike = prisma,
) {
  return db.document.findMany({
    where: {
      accountId: input.accountId,
      serverId: input.serverId,
      documentType: input.documentType,
      deletedAt: null,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function countDocumentsByAccountAndServerAndType(
  input: {
    accountId: string;
    serverId: string;
    documentType: DocumentType;
  },
  db: PrismaLike = prisma,
) {
  return db.document.count({
    where: {
      accountId: input.accountId,
      serverId: input.serverId,
      documentType: input.documentType,
      deletedAt: null,
    },
  });
}

export async function updateDocumentDraftRecord(
  input: {
    documentId: string;
    title: string;
    formPayloadJson: Record<string, unknown>;
  },
  db: PrismaLike = prisma,
) {
  const parsed = updateDocumentDraftInputSchema.parse(input);
  const existingDocument = await db.document.findUnique({
    where: {
      id: parsed.documentId,
    },
  });

  if (!existingDocument) {
    return null;
  }

  const payloadChanged =
    JSON.stringify(existingDocument.formPayloadJson ?? {}) !== JSON.stringify(parsed.formPayloadJson);
  const titleChanged = existingDocument.title !== parsed.title;
  const touchedGeneratedDocument =
    (existingDocument.status === "generated" || existingDocument.status === "published") &&
    (payloadChanged || titleChanged);

  return db.document.update({
    where: {
      id: parsed.documentId,
    },
    data: {
      title: parsed.title,
      formPayloadJson: parsed.formPayloadJson as Prisma.InputJsonValue,
      isModifiedAfterGeneration: touchedGeneratedDocument
        ? true
        : existingDocument.isModifiedAfterGeneration,
      isSiteForumSynced: touchedGeneratedDocument ? false : existingDocument.isSiteForumSynced,
    },
    include: {
      server: true,
    },
  });
}
