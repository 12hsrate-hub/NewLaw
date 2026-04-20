import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLawVersionByIdForReviewMock, txMock, transactionMock } = vi.hoisted(() => {
  const tx = {
    lawVersion: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    law: {
      update: vi.fn(),
    },
  };

  return {
    getLawVersionByIdForReviewMock: vi.fn(),
    txMock: tx,
    transactionMock: vi.fn(async (callback: (tx: Record<string, unknown>) => unknown) => callback(tx)),
  };
});

vi.mock("@/db/repositories/law-version.repository", () => ({
  getLawVersionByIdForReview: getLawVersionByIdForReviewMock,
}));

vi.mock("@/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

import {
  LawVersionReviewInvalidStatusError,
  confirmImportedDraftLawVersionAsCurrent,
} from "@/server/law-corpus/current-version";

describe("current version workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.lawVersion.findUnique.mockResolvedValue({
      id: "version-draft",
      status: "imported_draft",
      lawId: "law-1",
      law: {
        id: "law-1",
        lawKey: "criminal_code",
        title: "Уголовный кодекс",
        currentVersionId: "version-current",
      },
    });
    txMock.lawVersion.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    txMock.law.update.mockResolvedValue({
      id: "law-1",
      currentVersionId: "version-draft",
    });
  });

  it("подтверждает imported_draft как current и supersede старую current", async () => {
    getLawVersionByIdForReviewMock.mockResolvedValue({
      id: "version-draft",
      status: "imported_draft",
      lawId: "law-1",
      law: {
        id: "law-1",
        lawKey: "criminal_code",
        title: "Уголовный кодекс",
        currentVersionId: "version-current",
      },
    });

    const result = await confirmImportedDraftLawVersionAsCurrent({
      lawVersionId: "version-draft",
      confirmedByAccountId: "1e8f678a-7680-43d3-a1f7-0d62fd9ab2f0",
    });

    expect(txMock.lawVersion.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: "version-current",
      },
      data: {
        status: "superseded",
      },
    });
    expect(txMock.lawVersion.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: "version-draft",
        },
        data: expect.objectContaining({
          status: "current",
          confirmedByAccountId: "1e8f678a-7680-43d3-a1f7-0d62fd9ab2f0",
        }),
      }),
    );
    expect(txMock.law.update).toHaveBeenCalledWith({
      where: {
        id: "law-1",
      },
      data: {
        currentVersionId: "version-draft",
      },
    });
    expect(result.status).toBe("current");
    expect(result.previousCurrentVersionId).toBe("version-current");
  });

  it("не позволяет подтвердить non-draft версию", async () => {
    getLawVersionByIdForReviewMock.mockResolvedValue({
      id: "version-current",
      status: "current",
      lawId: "law-1",
      law: {
        id: "law-1",
        lawKey: "criminal_code",
        title: "Уголовный кодекс",
        currentVersionId: "version-current",
      },
    });

    await expect(
      confirmImportedDraftLawVersionAsCurrent({
        lawVersionId: "version-current",
        confirmedByAccountId: "1e8f678a-7680-43d3-a1f7-0d62fd9ab2f0",
      }),
    ).rejects.toBeInstanceOf(LawVersionReviewInvalidStatusError);

    expect(transactionMock).not.toHaveBeenCalled();
  });
});
