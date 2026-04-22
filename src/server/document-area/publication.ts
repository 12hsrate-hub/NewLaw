import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  getDocumentByIdForAccount,
  markOgpDocumentPublishedViaAutomationRecord,
  markOgpDocumentPublishFailedRecord,
} from "@/db/repositories/document.repository";
import {
  createOgpForumPublicationAttemptRecord,
  updateOgpForumPublicationAttemptRecord,
} from "@/db/repositories/ogp-forum-publication-attempt.repository";
import {
  getOgpForumAutomationRuntimeEnv,
  hasLiveOgpForumAutomationRuntimeEnv,
} from "@/schemas/env";
import {
  createGta5RpForumThreadFromBbcode,
} from "@/server/forum-integration/gta5rp-client";
import {
  ForumConnectionNotFoundError,
  ForumConnectionStateError,
  ForumIntegrationUnavailableError,
  getValidatedAccountForumSessionForAutomation,
} from "@/server/forum-integration/service";
import { DocumentAccessDeniedError } from "@/server/document-area/persistence";

const publicationBlockingReasonLabels = {
  generated_at_missing:
    "Сначала выполните generation. Publish create доступен только после успешной генерации BBCode.",
  generated_bbcode_missing:
    "Сначала выполните generation. Latest generated BBCode отсутствует в persisted документе.",
  modified_after_generation:
    "Документ изменён после последней генерации. Сначала пересоберите BBCode, потом публикуйте.",
  forum_connection_invalid:
    "Для publish create нужна валидная account-scoped forum session в /account/security.",
  manual_untracked:
    "У документа уже есть manual publication URL без automation-owned forum identity. Create-step заблокирован, чтобы не создать дубликат публикации.",
  already_published:
    "У документа уже есть automation-owned forum thread/post. Повторный create-step недоступен: нужен отдельный resync/update flow.",
  automation_unavailable:
    "OGP forum automation не настроена на сервере: проверьте OGP_FORUM_THREAD_FORM_URL и forum integration env.",
} as const;

export type OgpPublicationBlockingReason = keyof typeof publicationBlockingReasonLabels;

type PublicationDependencies = {
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  getValidatedAccountForumSessionForAutomation: typeof getValidatedAccountForumSessionForAutomation;
  createGta5RpForumThreadFromBbcode: typeof createGta5RpForumThreadFromBbcode;
  createOgpForumPublicationAttemptRecord: typeof createOgpForumPublicationAttemptRecord;
  updateOgpForumPublicationAttemptRecord: typeof updateOgpForumPublicationAttemptRecord;
  markOgpDocumentPublishedViaAutomationRecord: typeof markOgpDocumentPublishedViaAutomationRecord;
  markOgpDocumentPublishFailedRecord: typeof markOgpDocumentPublishFailedRecord;
  now: () => Date;
  runTransaction: <T>(
    callback: (db: Prisma.TransactionClient) => Promise<T>,
  ) => Promise<T>;
};

const defaultDependencies: PublicationDependencies = {
  getDocumentByIdForAccount,
  getValidatedAccountForumSessionForAutomation,
  createGta5RpForumThreadFromBbcode,
  createOgpForumPublicationAttemptRecord,
  updateOgpForumPublicationAttemptRecord,
  markOgpDocumentPublishedViaAutomationRecord,
  markOgpDocumentPublishFailedRecord,
  now: () => new Date(),
  runTransaction: (callback) => prisma.$transaction(callback),
};

export class OgpPublicationBlockedError extends Error {
  constructor(readonly reasons: OgpPublicationBlockingReason[]) {
    super("Документ пока нельзя автоматически опубликовать на форуме.");
    this.name = "OgpPublicationBlockedError";
  }
}

export function mapPublicationBlockingReasonsToMessages(
  reasons: OgpPublicationBlockingReason[],
) {
  return reasons.map((reason) => publicationBlockingReasonLabels[reason]);
}

function getOgpForumAutomationEnvSnapshot() {
  return {
    OGP_FORUM_THREAD_FORM_URL: process.env.OGP_FORUM_THREAD_FORM_URL,
  };
}

function assertOgpForumAutomationConfigured() {
  if (!hasLiveOgpForumAutomationRuntimeEnv(getOgpForumAutomationEnvSnapshot())) {
    throw new OgpPublicationBlockedError(["automation_unavailable"]);
  }

  return getOgpForumAutomationRuntimeEnv();
}

function buildBbcodeHash(bbcode: string) {
  return createHash("sha256").update(bbcode).digest("hex");
}

export async function publishOwnedOgpComplaintCreate(
  input: {
    accountId: string;
    documentId: string;
  },
  dependencies: PublicationDependencies = defaultDependencies,
) {
  const document = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!document || document.documentType !== "ogp_complaint") {
    throw new DocumentAccessDeniedError();
  }

  const blockingReasons: OgpPublicationBlockingReason[] = [];

  if (!document.generatedAt) {
    blockingReasons.push("generated_at_missing");
  }

  if (!document.lastGeneratedBbcode || document.lastGeneratedBbcode.trim().length === 0) {
    blockingReasons.push("generated_bbcode_missing");
  }

  if (document.isModifiedAfterGeneration) {
    blockingReasons.push("modified_after_generation");
  }

  if (document.forumThreadId || document.forumPostId) {
    blockingReasons.push("already_published");
  }

  if (document.publicationUrl && !document.forumThreadId && !document.forumPostId) {
    blockingReasons.push("manual_untracked");
  }

  if (blockingReasons.length > 0) {
    await dependencies.createOgpForumPublicationAttemptRecord({
      documentId: document.id,
      accountId: input.accountId,
      operation: "publish_create",
      status: "failed",
      errorCode: blockingReasons[0],
      errorSummary: mapPublicationBlockingReasonsToMessages(blockingReasons).join(" "),
    });
    throw new OgpPublicationBlockedError(blockingReasons);
  }

  try {
    const env = assertOgpForumAutomationConfigured();
    const forumSession = await dependencies.getValidatedAccountForumSessionForAutomation({
      accountId: input.accountId,
    });

    const startedAttempt = await dependencies.createOgpForumPublicationAttemptRecord({
      documentId: document.id,
      accountId: input.accountId,
      operation: "publish_create",
      status: "started",
    });

    try {
      const publishedAt = dependencies.now();
      const publishResult = await dependencies.createGta5RpForumThreadFromBbcode({
        sessionPayload: forumSession.payload,
        threadFormUrl: env.OGP_FORUM_THREAD_FORM_URL,
        title: document.title,
        bbcode: document.lastGeneratedBbcode!,
      });
      const forumPublishedBbcodeHash = buildBbcodeHash(document.lastGeneratedBbcode!);

      const publishedDocument = await dependencies.runTransaction(async (db) => {
        const nextDocument = await dependencies.markOgpDocumentPublishedViaAutomationRecord(
          {
            documentId: document.id,
            publicationUrl: publishResult.publicationUrl,
            forumThreadId: publishResult.forumThreadId,
            forumPostId: publishResult.forumPostId,
            forumPublishedBbcodeHash,
            forumLastPublishedAt: publishedAt,
          },
          db,
        );

        await dependencies.updateOgpForumPublicationAttemptRecord(
          {
            attemptId: startedAttempt.id,
            status: "succeeded",
            forumThreadId: publishResult.forumThreadId,
            forumPostId: publishResult.forumPostId,
          },
          db,
        );

        return nextDocument;
      });

      return publishedDocument;
    } catch (error) {
      const errorSummary =
        error instanceof Error
          ? error.message
          : "Форум не подтвердил publish create для OGP complaint.";

      await dependencies.runTransaction(async (db) => {
        await dependencies.markOgpDocumentPublishFailedRecord(
          {
            documentId: document.id,
            errorSummary,
          },
          db,
        );
        await dependencies.updateOgpForumPublicationAttemptRecord(
          {
            attemptId: startedAttempt.id,
            status: "failed",
            errorCode: "publish_failed",
            errorSummary,
          },
          db,
        );
      });

      throw error;
    }
  } catch (error) {
    if (error instanceof DocumentAccessDeniedError) {
      throw error;
    }

    if (error instanceof OgpPublicationBlockedError) {
      if (error.reasons.includes("automation_unavailable")) {
        await dependencies.createOgpForumPublicationAttemptRecord({
          documentId: document.id,
          accountId: input.accountId,
          operation: "publish_create",
          status: "failed",
          errorCode: "automation_unavailable",
          errorSummary: publicationBlockingReasonLabels.automation_unavailable,
        });
      }

      throw error;
    }

    if (
      error instanceof ForumIntegrationUnavailableError ||
      error instanceof ForumConnectionNotFoundError ||
      error instanceof ForumConnectionStateError
    ) {
      await dependencies.createOgpForumPublicationAttemptRecord({
        documentId: document.id,
        accountId: input.accountId,
        operation: "publish_create",
        status: "failed",
        errorCode: "forum_connection_invalid",
        errorSummary: publicationBlockingReasonLabels.forum_connection_invalid,
      });

      throw new OgpPublicationBlockedError(["forum_connection_invalid"]);
    }

    if (error instanceof Error && error.message.includes("OGP_FORUM_THREAD_FORM_URL")) {
      await dependencies.createOgpForumPublicationAttemptRecord({
        documentId: document.id,
        accountId: input.accountId,
        operation: "publish_create",
        status: "failed",
        errorCode: "automation_unavailable",
        errorSummary: publicationBlockingReasonLabels.automation_unavailable,
      });
      throw new OgpPublicationBlockedError(["automation_unavailable"]);
    }

    throw error;
  }
}
