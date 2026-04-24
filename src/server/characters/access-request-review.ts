import { AuditActionKey, Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { createAuditLog } from "@/db/repositories/audit-log.repository";
import { getAccountById } from "@/db/repositories/account.repository";
import {
  getCharacterAccessRequestById,
  reviewCharacterAccessRequestRecord,
} from "@/db/repositories/character-access-request.repository";
import { grantCharacterAssignments } from "@/db/repositories/character.repository";
import {
  reviewCharacterAccessRequestInputSchema,
  type ReviewCharacterAccessRequestInput,
} from "@/schemas/character";

type AccessRequestReviewDependencies = {
  getAccountById: typeof getAccountById;
  getCharacterAccessRequestById: typeof getCharacterAccessRequestById;
  reviewCharacterAccessRequestRecord: typeof reviewCharacterAccessRequestRecord;
  grantCharacterAssignments: typeof grantCharacterAssignments;
  createAuditLog: typeof createAuditLog;
  now: () => Date;
  runTransaction: <T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => Promise<T>;
};

const defaultDependencies: AccessRequestReviewDependencies = {
  getAccountById,
  getCharacterAccessRequestById,
  reviewCharacterAccessRequestRecord,
  grantCharacterAssignments,
  createAuditLog,
  now: () => new Date(),
  runTransaction: async (callback) => prisma.$transaction(async (tx) => callback(tx)),
};

type ReviewFailureResult =
  | {
      status: "forbidden";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export type CharacterAccessRequestReviewResult =
  | {
      status: "success";
      requestId: string;
    }
  | ReviewFailureResult;

async function writeFailureAuditLog(
  dependencies: AccessRequestReviewDependencies,
  input: {
    actorAccountId?: string | null;
    targetAccountId?: string | null;
    actionKey:
      | typeof AuditActionKey.character_access_request_approved
      | typeof AuditActionKey.character_access_request_rejected;
    reviewComment: string;
    metadataJson: Record<string, unknown>;
  },
) {
  await dependencies.createAuditLog({
    actionKey: input.actionKey,
    status: "failure",
    actorAccountId: input.actorAccountId ?? null,
    targetAccountId: input.targetAccountId ?? null,
    comment: input.reviewComment,
    metadataJson: input.metadataJson,
  });
}

export class CharacterAccessRequestAlreadyReviewedError extends Error {
  constructor() {
    super("Character access request is not pending");
    this.name = "CharacterAccessRequestAlreadyReviewedError";
  }
}

type ReviewActionKey =
  | typeof AuditActionKey.character_access_request_approved
  | typeof AuditActionKey.character_access_request_rejected;

async function resolvePendingRequestOrFailure(
  actionKey: ReviewActionKey,
  parsed: ReviewCharacterAccessRequestInput,
  dependencies: AccessRequestReviewDependencies,
) {
  const actor = await dependencies.getAccountById(parsed.actorAccountId);

  if (!actor?.isSuperAdmin) {
    await writeFailureAuditLog(dependencies, {
      actorAccountId: actor?.id ?? parsed.actorAccountId,
      actionKey,
      reviewComment: parsed.reviewComment,
      metadataJson: {
        flow: "character_access_request_review",
        reason: "access_denied",
        requestId: parsed.requestId,
      },
    });

    return {
      ok: false as const,
      result: {
        status: "forbidden" as const,
        message: "Только super_admin может рассматривать заявки на доступ.",
      },
    };
  }

  const request = await dependencies.getCharacterAccessRequestById(parsed.requestId);

  if (!request || request.character.deletedAt) {
    await writeFailureAuditLog(dependencies, {
      actorAccountId: actor.id,
      actionKey,
      reviewComment: parsed.reviewComment,
      metadataJson: {
        flow: "character_access_request_review",
        reason: "request_not_found",
        requestId: parsed.requestId,
      },
    });

    return {
      ok: false as const,
      result: {
        status: "error" as const,
        message: "Не удалось найти заявку на доступ или связанного персонажа.",
      },
    };
  }

  if (request.status !== "pending") {
    await writeFailureAuditLog(dependencies, {
      actorAccountId: actor.id,
      targetAccountId: request.accountId,
      actionKey,
      reviewComment: parsed.reviewComment,
      metadataJson: {
        flow: "character_access_request_review",
        reason: "request_not_pending",
        requestId: request.id,
        currentStatus: request.status,
      },
    });

    return {
      ok: false as const,
      result: {
        status: "error" as const,
        message: "Заявка уже обработана и больше не находится в pending-статусе.",
      },
    };
  }

  if (request.accountId === actor.id) {
    await writeFailureAuditLog(dependencies, {
      actorAccountId: actor.id,
      targetAccountId: request.accountId,
      actionKey,
      reviewComment: parsed.reviewComment,
      metadataJson: {
        flow: "character_access_request_review",
        reason: "self_review_forbidden",
        requestId: request.id,
      },
    });

    return {
      ok: false as const,
      result: {
        status: "forbidden" as const,
        message: "Владелец персонажа не может сам одобрить или отклонить свою заявку.",
      },
    };
  }

  return {
    ok: true as const,
    actor,
    request,
  };
}

export async function approveCharacterAccessRequestAsAdmin(
  input: ReviewCharacterAccessRequestInput,
  dependencies: AccessRequestReviewDependencies = defaultDependencies,
): Promise<CharacterAccessRequestReviewResult> {
  const parsed = reviewCharacterAccessRequestInputSchema.parse(input);
  const resolved = await resolvePendingRequestOrFailure(
    AuditActionKey.character_access_request_approved,
    parsed,
    dependencies,
  );

  if (!resolved.ok) {
    return resolved.result;
  }

  const reviewedAt = dependencies.now();

  await dependencies.runTransaction(async (tx) => {
    await dependencies.grantCharacterAssignments(
      {
        characterId: resolved.request.characterId,
        roleKeys: ["lawyer"],
        accessFlags: ["advocate"],
      },
      tx,
    );

    await dependencies.reviewCharacterAccessRequestRecord(
      {
        requestId: resolved.request.id,
        status: "approved",
        reviewComment: parsed.reviewComment.length ? parsed.reviewComment : null,
        reviewedByAccountId: resolved.actor.id,
        reviewedAt,
      },
      tx,
    );
  });

  await dependencies.createAuditLog({
    actionKey: AuditActionKey.character_access_request_approved,
    status: "success",
    actorAccountId: resolved.actor.id,
    targetAccountId: resolved.request.accountId,
    comment: parsed.reviewComment.length ? parsed.reviewComment : null,
    metadataJson: {
      flow: "character_access_request_review",
      requestId: resolved.request.id,
      characterId: resolved.request.characterId,
      serverId: resolved.request.serverId,
      requestType: resolved.request.requestType,
      grantedRoleKeys: ["lawyer"],
      grantedAccessFlags: ["advocate"],
    },
  });

  return {
    status: "success",
    requestId: resolved.request.id,
  };
}

export async function rejectCharacterAccessRequestAsAdmin(
  input: ReviewCharacterAccessRequestInput,
  dependencies: AccessRequestReviewDependencies = defaultDependencies,
): Promise<CharacterAccessRequestReviewResult> {
  const parsed = reviewCharacterAccessRequestInputSchema.parse(input);
  const resolved = await resolvePendingRequestOrFailure(
    AuditActionKey.character_access_request_rejected,
    parsed,
    dependencies,
  );

  if (!resolved.ok) {
    return resolved.result;
  }

  const reviewedAt = dependencies.now();

  await dependencies.runTransaction(async (tx) => {
    await dependencies.reviewCharacterAccessRequestRecord(
      {
        requestId: resolved.request.id,
        status: "rejected",
        reviewComment: parsed.reviewComment.length ? parsed.reviewComment : null,
        reviewedByAccountId: resolved.actor.id,
        reviewedAt,
      },
      tx,
    );
  });

  await dependencies.createAuditLog({
    actionKey: AuditActionKey.character_access_request_rejected,
    status: "success",
    actorAccountId: resolved.actor.id,
    targetAccountId: resolved.request.accountId,
    comment: parsed.reviewComment.length ? parsed.reviewComment : null,
    metadataJson: {
      flow: "character_access_request_review",
      requestId: resolved.request.id,
      characterId: resolved.request.characterId,
      serverId: resolved.request.serverId,
      requestType: resolved.request.requestType,
    },
  });

  return {
    status: "success",
    requestId: resolved.request.id,
  };
}
