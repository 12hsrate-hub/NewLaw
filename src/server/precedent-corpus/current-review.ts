import { prisma } from "@/db/prisma";
import { getPrecedentByIdForReview, updatePrecedentValidityStatus } from "@/db/repositories/precedent.repository";
import { getPrecedentVersionByIdForReview } from "@/db/repositories/precedent-version.repository";
import {
  confirmCurrentPrecedentVersionInputSchema,
  rollbackPrecedentCurrentVersionInputSchema,
  updatePrecedentValidityStatusInputSchema,
} from "@/schemas/precedent-corpus";
import { z } from "zod";

type CurrentPrecedentReviewDependencies = {
  getPrecedentVersionByIdForReview: typeof getPrecedentVersionByIdForReview;
  getPrecedentByIdForReview: typeof getPrecedentByIdForReview;
  updatePrecedentValidityStatus: typeof updatePrecedentValidityStatus;
  now: () => Date;
};

const defaultDependencies: CurrentPrecedentReviewDependencies = {
  getPrecedentVersionByIdForReview,
  getPrecedentByIdForReview,
  updatePrecedentValidityStatus,
  now: () => new Date(),
};

export class PrecedentVersionReviewTargetMissingError extends Error {
  constructor() {
    super("Версия прецедента для review не найдена.");
    this.name = "PrecedentVersionReviewTargetMissingError";
  }
}

export class PrecedentVersionReviewInvalidStatusError extends Error {
  constructor() {
    super("Подтвердить как current можно только imported_draft версию прецедента.");
    this.name = "PrecedentVersionReviewInvalidStatusError";
  }
}

export class PrecedentValidityRequiresCurrentVersionError extends Error {
  constructor() {
    super("Обновлять validity_status можно только после выбора current версии прецедента.");
    this.name = "PrecedentValidityRequiresCurrentVersionError";
  }
}

export class PrecedentRollbackTargetMissingError extends Error {
  constructor() {
    super("Версия прецедента для rollback не найдена.");
    this.name = "PrecedentRollbackTargetMissingError";
  }
}

export class PrecedentRollbackInvalidStatusError extends Error {
  constructor() {
    super("Rollback можно выполнить только на superseded версии прецедента.");
    this.name = "PrecedentRollbackInvalidStatusError";
  }
}

export function isStructurallyWeakPrecedentVersion(input: {
  status: "imported_draft" | "current" | "superseded";
  blocks: Array<{ blockType: "facts" | "issue" | "holding" | "reasoning" | "resolution" | "unstructured" }>;
}) {
  if (input.status !== "imported_draft") {
    return false;
  }

  if (input.blocks.length === 0) {
    return true;
  }

  return input.blocks.every((block) => block.blockType === "unstructured");
}

export async function confirmImportedDraftPrecedentVersionAsCurrent(
  input: {
    precedentVersionId: string;
    confirmedByAccountId: string;
  },
  dependencies: CurrentPrecedentReviewDependencies = defaultDependencies,
) {
  const parsed = confirmCurrentPrecedentVersionInputSchema
    .extend({
      confirmedByAccountId: z.string().uuid(),
    })
    .parse(input);
  const candidate = await dependencies.getPrecedentVersionByIdForReview(parsed.precedentVersionId);

  if (!candidate) {
    throw new PrecedentVersionReviewTargetMissingError();
  }

  if (candidate.status !== "imported_draft") {
    throw new PrecedentVersionReviewInvalidStatusError();
  }

  const confirmedAt = dependencies.now();

  return prisma.$transaction(async (tx) => {
    const targetVersion = await tx.precedentVersion.findUnique({
      where: {
        id: parsed.precedentVersionId,
      },
      include: {
        precedent: true,
        blocks: {
          select: {
            blockType: true,
          },
        },
        _count: {
          select: {
            sourcePosts: true,
            blocks: true,
          },
        },
      },
    });

    if (!targetVersion) {
      throw new PrecedentVersionReviewTargetMissingError();
    }

    if (targetVersion.status !== "imported_draft") {
      throw new PrecedentVersionReviewInvalidStatusError();
    }

    const previousCurrentVersionId = targetVersion.precedent.currentVersionId;

    if (previousCurrentVersionId && previousCurrentVersionId !== targetVersion.id) {
      await tx.precedentVersion.update({
        where: {
          id: previousCurrentVersionId,
        },
        data: {
          status: "superseded",
        },
      });
    }

    const confirmedVersion = await tx.precedentVersion.update({
      where: {
        id: targetVersion.id,
      },
      data: {
        status: "current",
        confirmedAt,
        confirmedByAccountId: parsed.confirmedByAccountId,
      },
    });

    await tx.precedent.update({
      where: {
        id: targetVersion.precedentId,
      },
      data: {
        currentVersionId: targetVersion.id,
      },
    });

    return {
      precedentId: targetVersion.precedentId,
      precedentKey: targetVersion.precedent.precedentKey,
      displayTitle: targetVersion.precedent.displayTitle,
      precedentVersionId: confirmedVersion.id,
      previousCurrentVersionId,
      confirmedAt,
      status: confirmedVersion.status,
      structurallyWeakWarning: isStructurallyWeakPrecedentVersion({
        status: targetVersion.status,
        blocks: targetVersion.blocks,
      }),
    };
  });
}

export async function updateReviewedPrecedentValidityStatus(
  input: {
    precedentId: string;
    validityStatus: "applicable" | "limited" | "obsolete";
  },
  dependencies: CurrentPrecedentReviewDependencies = defaultDependencies,
) {
  const parsed = updatePrecedentValidityStatusInputSchema.parse(input);
  const precedent = await dependencies.getPrecedentByIdForReview(parsed.precedentId);

  if (!precedent?.currentVersionId) {
    throw new PrecedentValidityRequiresCurrentVersionError();
  }

  return dependencies.updatePrecedentValidityStatus(parsed);
}

export async function rollbackPrecedentCurrentVersion(
  input: {
    precedentVersionId: string;
    confirmedByAccountId: string;
  },
  dependencies: CurrentPrecedentReviewDependencies = defaultDependencies,
) {
  const parsed = rollbackPrecedentCurrentVersionInputSchema
    .extend({
      confirmedByAccountId: z.string().uuid(),
    })
    .parse(input);
  const candidate = await dependencies.getPrecedentVersionByIdForReview(parsed.precedentVersionId);

  if (!candidate) {
    throw new PrecedentRollbackTargetMissingError();
  }

  if (candidate.status !== "superseded") {
    throw new PrecedentRollbackInvalidStatusError();
  }

  const confirmedAt = dependencies.now();

  return prisma.$transaction(async (tx) => {
    const targetVersion = await tx.precedentVersion.findUnique({
      where: {
        id: parsed.precedentVersionId,
      },
      include: {
        precedent: true,
      },
    });

    if (!targetVersion) {
      throw new PrecedentRollbackTargetMissingError();
    }

    if (targetVersion.status !== "superseded") {
      throw new PrecedentRollbackInvalidStatusError();
    }

    const previousCurrentVersionId = targetVersion.precedent.currentVersionId;

    if (previousCurrentVersionId && previousCurrentVersionId !== targetVersion.id) {
      await tx.precedentVersion.update({
        where: {
          id: previousCurrentVersionId,
        },
        data: {
          status: "superseded",
        },
      });
    }

    const restoredVersion = await tx.precedentVersion.update({
      where: {
        id: targetVersion.id,
      },
      data: {
        status: "current",
        confirmedAt,
        confirmedByAccountId: parsed.confirmedByAccountId,
      },
    });

    await tx.precedent.update({
      where: {
        id: targetVersion.precedentId,
      },
      data: {
        currentVersionId: targetVersion.id,
      },
    });

    return {
      precedentId: targetVersion.precedentId,
      precedentKey: targetVersion.precedent.precedentKey,
      displayTitle: targetVersion.precedent.displayTitle,
      precedentVersionId: restoredVersion.id,
      previousCurrentVersionId,
      confirmedAt,
      status: restoredVersion.status,
    };
  });
}
