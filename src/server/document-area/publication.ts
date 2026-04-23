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
  updateGta5RpForumPostFromBbcode,
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
    "Сначала сгенерируйте BBCode. Публикация на форуме доступна только после генерации. Код: OGP_PUBLICATION_GENERATION_MISSING.",
  generated_bbcode_missing:
    "Сначала сгенерируйте BBCode. В сохранённом документе нет готового текста для публикации. Код: OGP_PUBLICATION_BBCODE_MISSING.",
  modified_after_generation:
    "Документ изменился после последней генерации. Сначала пересоберите BBCode, затем публикуйте. Код: OGP_PUBLICATION_STALE_BBCODE.",
  forum_connection_invalid:
    "Для публикации нужно рабочее подключение форума в настройках аккаунта. Код: OGP_FORUM_CONNECTION_INVALID.",
  manual_untracked:
    "У документа уже указана ссылка на публикацию вручную. Автопубликация заблокирована, чтобы не создать дубль на форуме. Код: OGP_FORUM_MANUAL_PUBLICATION_EXISTS.",
  already_published:
    "Документ уже опубликован через приложение. Для изменений используйте обновление публикации. Код: OGP_FORUM_ALREADY_PUBLISHED.",
  create_required:
    "Документ ещё не опубликован через приложение. Сначала выполните публикацию или укажите ссылку вручную. Код: OGP_FORUM_PUBLICATION_REQUIRED.",
  already_current:
    "Публикация на форуме уже актуальна и не требует обновления. Код: OGP_FORUM_PUBLICATION_CURRENT.",
  automation_unavailable:
    "Публикация на форуме временно недоступна из-за настройки сервера. Код: OGP_FORUM_AUTOMATION_UNAVAILABLE.",
} as const;

export type OgpPublicationBlockingReason = keyof typeof publicationBlockingReasonLabels;

type PublicationDependencies = {
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  getValidatedAccountForumSessionForAutomation: typeof getValidatedAccountForumSessionForAutomation;
  createGta5RpForumThreadFromBbcode: typeof createGta5RpForumThreadFromBbcode;
  updateGta5RpForumPostFromBbcode: typeof updateGta5RpForumPostFromBbcode;
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
  updateGta5RpForumPostFromBbcode,
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

async function createFailedPublicationAttempt(
  input: {
    documentId: string;
    accountId: string;
    operation: "publish_create" | "publish_update";
    reasons: OgpPublicationBlockingReason[];
  },
  dependencies: PublicationDependencies,
) {
  await dependencies.createOgpForumPublicationAttemptRecord({
    documentId: input.documentId,
    accountId: input.accountId,
    operation: input.operation,
    status: "failed",
    errorCode: input.reasons[0],
    errorSummary: mapPublicationBlockingReasonsToMessages(input.reasons).join(" "),
  });
}

async function createStartedPublicationAttempt(
  input: {
    documentId: string;
    accountId: string;
    operation: "publish_create" | "publish_update";
  },
  dependencies: PublicationDependencies,
) {
  return dependencies.createOgpForumPublicationAttemptRecord({
    documentId: input.documentId,
    accountId: input.accountId,
    operation: input.operation,
    status: "started",
  });
}

async function createAutomationUnavailableAttempt(
  input: {
    documentId: string;
    accountId: string;
    operation: "publish_create" | "publish_update";
  },
  dependencies: PublicationDependencies,
) {
  await dependencies.createOgpForumPublicationAttemptRecord({
    documentId: input.documentId,
    accountId: input.accountId,
    operation: input.operation,
    status: "failed",
    errorCode: "automation_unavailable",
    errorSummary: publicationBlockingReasonLabels.automation_unavailable,
  });
}

async function createForumConnectionInvalidAttempt(
  input: {
    documentId: string;
    accountId: string;
    operation: "publish_create" | "publish_update";
  },
  dependencies: PublicationDependencies,
) {
  await dependencies.createOgpForumPublicationAttemptRecord({
    documentId: input.documentId,
    accountId: input.accountId,
    operation: input.operation,
    status: "failed",
    errorCode: "forum_connection_invalid",
    errorSummary: publicationBlockingReasonLabels.forum_connection_invalid,
  });
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
    await createFailedPublicationAttempt(
      {
        documentId: document.id,
        accountId: input.accountId,
        operation: "publish_create",
        reasons: blockingReasons,
      },
      dependencies,
    );
    throw new OgpPublicationBlockedError(blockingReasons);
  }

  try {
    const env = assertOgpForumAutomationConfigured();
    const forumSession = await dependencies.getValidatedAccountForumSessionForAutomation({
      accountId: input.accountId,
    });

    const startedAttempt = await createStartedPublicationAttempt(
      {
        documentId: document.id,
        accountId: input.accountId,
        operation: "publish_create",
      },
      dependencies,
    );

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
          : "Форум не подтвердил публикацию жалобы в ОГП. Код: OGP_FORUM_PUBLISH_CREATE_UNCONFIRMED.";

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
        await createAutomationUnavailableAttempt(
          {
            documentId: document.id,
            accountId: input.accountId,
            operation: "publish_create",
          },
          dependencies,
        );
      }

      throw error;
    }

    if (
      error instanceof ForumIntegrationUnavailableError ||
      error instanceof ForumConnectionNotFoundError ||
      error instanceof ForumConnectionStateError
    ) {
      await createForumConnectionInvalidAttempt(
        {
          documentId: document.id,
          accountId: input.accountId,
          operation: "publish_create",
        },
        dependencies,
      );

      throw new OgpPublicationBlockedError(["forum_connection_invalid"]);
    }

    if (error instanceof Error && error.message.includes("OGP_FORUM_THREAD_FORM_URL")) {
      await createAutomationUnavailableAttempt(
        {
          documentId: document.id,
          accountId: input.accountId,
          operation: "publish_create",
        },
        dependencies,
      );
      throw new OgpPublicationBlockedError(["automation_unavailable"]);
    }

    throw error;
  }
}

export async function publishOwnedOgpComplaintUpdate(
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

  if (!document.forumThreadId || !document.forumPostId) {
    if (document.publicationUrl) {
      blockingReasons.push("manual_untracked");
    } else {
      blockingReasons.push("create_required");
    }
  }

  if (!document.isModifiedAfterGeneration && document.forumSyncState === "current") {
    blockingReasons.push("already_current");
  }

  if (blockingReasons.length > 0) {
    await createFailedPublicationAttempt(
      {
        documentId: document.id,
        accountId: input.accountId,
        operation: "publish_update",
        reasons: blockingReasons,
      },
      dependencies,
    );
    throw new OgpPublicationBlockedError(blockingReasons);
  }

  try {
    const env = assertOgpForumAutomationConfigured();
    const forumSession = await dependencies.getValidatedAccountForumSessionForAutomation({
      accountId: input.accountId,
    });

    const startedAttempt = await createStartedPublicationAttempt(
      {
        documentId: document.id,
        accountId: input.accountId,
        operation: "publish_update",
      },
      dependencies,
    );

    try {
      const publishedAt = dependencies.now();
      const publishResult = await dependencies.updateGta5RpForumPostFromBbcode({
        sessionPayload: forumSession.payload,
        publicationUrl: document.publicationUrl ?? env.OGP_FORUM_THREAD_FORM_URL,
        forumThreadId: document.forumThreadId!,
        forumPostId: document.forumPostId!,
        title: document.title,
        bbcode: document.lastGeneratedBbcode!,
      });
      const forumPublishedBbcodeHash = buildBbcodeHash(document.lastGeneratedBbcode!);

      const updatedDocument = await dependencies.runTransaction(async (db) => {
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

      return updatedDocument;
    } catch (error) {
      const errorSummary =
        error instanceof Error
          ? error.message
          : "Форум не подтвердил обновление жалобы в ОГП. Код: OGP_FORUM_PUBLISH_UPDATE_UNCONFIRMED.";

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
            forumThreadId: document.forumThreadId!,
            forumPostId: document.forumPostId!,
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
        await createAutomationUnavailableAttempt(
          {
            documentId: document.id,
            accountId: input.accountId,
            operation: "publish_update",
          },
          dependencies,
        );
      }

      throw error;
    }

    if (
      error instanceof ForumIntegrationUnavailableError ||
      error instanceof ForumConnectionNotFoundError ||
      error instanceof ForumConnectionStateError
    ) {
      await createForumConnectionInvalidAttempt(
        {
          documentId: document.id,
          accountId: input.accountId,
          operation: "publish_update",
        },
        dependencies,
      );

      throw new OgpPublicationBlockedError(["forum_connection_invalid"]);
    }

    if (error instanceof Error && error.message.includes("OGP_FORUM_THREAD_FORM_URL")) {
      await createAutomationUnavailableAttempt(
        {
          documentId: document.id,
          accountId: input.accountId,
          operation: "publish_update",
        },
        dependencies,
      );
      throw new OgpPublicationBlockedError(["automation_unavailable"]);
    }

    throw error;
  }
}
