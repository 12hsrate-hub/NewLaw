import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function createOgpForumPublicationAttemptRecord(
  input: {
    documentId: string;
    accountId: string;
    operation: "publish_create" | "publish_update";
    status: "started" | "succeeded" | "failed";
    forumThreadId?: string | null;
    forumPostId?: string | null;
    errorCode?: string | null;
    errorSummary?: string | null;
  },
  db: PrismaLike = prisma,
) {
  return db.ogpForumPublicationAttempt.create({
    data: {
      documentId: input.documentId,
      accountId: input.accountId,
      operation: input.operation,
      status: input.status,
      forumThreadId: input.forumThreadId ?? null,
      forumPostId: input.forumPostId ?? null,
      errorCode: input.errorCode ?? null,
      errorSummary: input.errorSummary ?? null,
    },
  });
}

export async function updateOgpForumPublicationAttemptRecord(
  input: {
    attemptId: string;
    status: "started" | "succeeded" | "failed";
    forumThreadId?: string | null;
    forumPostId?: string | null;
    errorCode?: string | null;
    errorSummary?: string | null;
  },
  db: PrismaLike = prisma,
) {
  return db.ogpForumPublicationAttempt.update({
    where: {
      id: input.attemptId,
    },
    data: {
      status: input.status,
      forumThreadId: input.forumThreadId ?? null,
      forumPostId: input.forumPostId ?? null,
      errorCode: input.errorCode ?? null,
      errorSummary: input.errorSummary ?? null,
    },
  });
}
