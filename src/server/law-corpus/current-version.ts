import { prisma } from "@/db/prisma";
import { getLawVersionByIdForReview } from "@/db/repositories/law-version.repository";
import { confirmCurrentLawVersionInputSchema } from "@/schemas/law-corpus";
import { z } from "zod";

type CurrentVersionDependencies = {
  getLawVersionByIdForReview: typeof getLawVersionByIdForReview;
  now: () => Date;
};

const defaultDependencies: CurrentVersionDependencies = {
  getLawVersionByIdForReview,
  now: () => new Date(),
};

export class LawVersionReviewTargetMissingError extends Error {
  constructor() {
    super("Версия закона для подтверждения не найдена.");
    this.name = "LawVersionReviewTargetMissingError";
  }
}

export class LawVersionReviewInvalidStatusError extends Error {
  constructor() {
    super("Подтвердить как current можно только imported_draft версию.");
    this.name = "LawVersionReviewInvalidStatusError";
  }
}

export async function confirmImportedDraftLawVersionAsCurrent(
  input: {
    lawVersionId: string;
    confirmedByAccountId: string;
  },
  dependencies: CurrentVersionDependencies = defaultDependencies,
) {
  const parsed = confirmCurrentLawVersionInputSchema
    .extend({
      confirmedByAccountId: z.string().uuid(),
    })
    .parse(input);
  const candidate = await dependencies.getLawVersionByIdForReview(parsed.lawVersionId);

  if (!candidate) {
    throw new LawVersionReviewTargetMissingError();
  }

  if (candidate.status !== "imported_draft") {
    throw new LawVersionReviewInvalidStatusError();
  }

  const confirmedAt = dependencies.now();

  return prisma.$transaction(async (tx) => {
    const targetVersion = await tx.lawVersion.findUnique({
      where: {
        id: parsed.lawVersionId,
      },
      include: {
        law: true,
      },
    });

    if (!targetVersion) {
      throw new LawVersionReviewTargetMissingError();
    }

    if (targetVersion.status !== "imported_draft") {
      throw new LawVersionReviewInvalidStatusError();
    }

    const previousCurrentVersionId = targetVersion.law.currentVersionId;

    if (previousCurrentVersionId && previousCurrentVersionId !== targetVersion.id) {
      await tx.lawVersion.update({
        where: {
          id: previousCurrentVersionId,
        },
        data: {
          status: "superseded",
        },
      });
    }

    const confirmedVersion = await tx.lawVersion.update({
      where: {
        id: targetVersion.id,
      },
      data: {
        status: "current",
        confirmedAt,
        confirmedByAccountId: parsed.confirmedByAccountId,
      },
    });

    await tx.law.update({
      where: {
        id: targetVersion.lawId,
      },
      data: {
        currentVersionId: targetVersion.id,
      },
    });

    return {
      lawId: targetVersion.lawId,
      lawKey: targetVersion.law.lawKey,
      lawTitle: targetVersion.law.title,
      lawVersionId: confirmedVersion.id,
      previousCurrentVersionId,
      confirmedAt,
      status: confirmedVersion.status,
    };
  });
}
