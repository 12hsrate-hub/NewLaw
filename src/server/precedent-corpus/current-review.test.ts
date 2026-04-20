import { beforeEach, describe, expect, it, vi } from "vitest";

const { txMock, transactionMock } = vi.hoisted(() => {
  const tx = {
    precedentVersion: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    precedent: {
      update: vi.fn(),
    },
  };

  return {
    txMock: tx,
    transactionMock: vi.fn(async (callback: (tx: Record<string, unknown>) => unknown) => callback(tx)),
  };
});

vi.mock("@/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

import {
  confirmImportedDraftPrecedentVersionAsCurrent,
  isStructurallyWeakPrecedentVersion,
  PrecedentRollbackInvalidStatusError,
  PrecedentValidityRequiresCurrentVersionError,
  PrecedentVersionReviewInvalidStatusError,
  rollbackPrecedentCurrentVersion,
  updateReviewedPrecedentValidityStatus,
} from "@/server/precedent-corpus/current-review";

describe("precedent current review workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.precedentVersion.findUnique.mockResolvedValue({
      id: "precedent-version-draft",
      status: "imported_draft",
      precedentId: "precedent-1",
      precedent: {
        id: "precedent-1",
        precedentKey: "precedent_1",
        displayTitle: "Судебный прецедент № 1",
        currentVersionId: "precedent-version-current",
      },
      blocks: [{ blockType: "unstructured" }],
      _count: {
        sourcePosts: 2,
        blocks: 1,
      },
    });
    txMock.precedentVersion.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    txMock.precedent.update.mockResolvedValue({
      id: "precedent-1",
      currentVersionId: "precedent-version-draft",
    });
  });

  it("подтверждает imported_draft precedent version как current и supersede старую current", async () => {
    const result = await confirmImportedDraftPrecedentVersionAsCurrent(
      {
        precedentVersionId: "precedent-version-draft",
        confirmedByAccountId: "1e8f678a-7680-43d3-a1f7-0d62fd9ab2f0",
      },
      {
        getPrecedentVersionByIdForReview: vi.fn().mockResolvedValue({
          id: "precedent-version-draft",
          status: "imported_draft",
        }),
        getPrecedentByIdForReview: vi.fn(),
        updatePrecedentValidityStatus: vi.fn(),
        now: () => new Date("2026-04-21T10:00:00.000Z"),
      },
    );

    expect(txMock.precedentVersion.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: "precedent-version-current",
      },
      data: {
        status: "superseded",
      },
    });
    expect(txMock.precedentVersion.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: "precedent-version-draft",
        },
        data: expect.objectContaining({
          status: "current",
          confirmedByAccountId: "1e8f678a-7680-43d3-a1f7-0d62fd9ab2f0",
        }),
      }),
    );
    expect(txMock.precedent.update).toHaveBeenCalledWith({
      where: {
        id: "precedent-1",
      },
      data: {
        currentVersionId: "precedent-version-draft",
      },
    });
    expect(result.status).toBe("current");
    expect(result.previousCurrentVersionId).toBe("precedent-version-current");
    expect(result.structurallyWeakWarning).toBe(true);
  });

  it("не позволяет подтвердить non-draft precedent version", async () => {
    await expect(
      confirmImportedDraftPrecedentVersionAsCurrent(
        {
          precedentVersionId: "precedent-version-current",
          confirmedByAccountId: "1e8f678a-7680-43d3-a1f7-0d62fd9ab2f0",
        },
        {
          getPrecedentVersionByIdForReview: vi.fn().mockResolvedValue({
            id: "precedent-version-current",
            status: "current",
          }),
          getPrecedentByIdForReview: vi.fn(),
          updatePrecedentValidityStatus: vi.fn(),
          now: () => new Date(),
        },
      ),
    ).rejects.toBeInstanceOf(PrecedentVersionReviewInvalidStatusError);

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("обновляет validity отдельно от version status и требует current version", async () => {
    const updatePrecedentValidityStatusMock = vi.fn().mockResolvedValue({
      id: "precedent-1",
      validityStatus: "limited",
    });

    const result = await updateReviewedPrecedentValidityStatus(
      {
        precedentId: "precedent-1",
        validityStatus: "limited",
      },
      {
        getPrecedentVersionByIdForReview: vi.fn(),
        getPrecedentByIdForReview: vi.fn().mockResolvedValue({
          id: "precedent-1",
          currentVersionId: "precedent-version-current",
        }),
        updatePrecedentValidityStatus: updatePrecedentValidityStatusMock,
        now: () => new Date(),
      },
    );

    expect(updatePrecedentValidityStatusMock).toHaveBeenCalledWith({
      precedentId: "precedent-1",
      validityStatus: "limited",
    });
    expect(result.validityStatus).toBe("limited");

    await expect(
      updateReviewedPrecedentValidityStatus(
        {
          precedentId: "precedent-1",
          validityStatus: "obsolete",
        },
        {
          getPrecedentVersionByIdForReview: vi.fn(),
          getPrecedentByIdForReview: vi.fn().mockResolvedValue({
            id: "precedent-1",
            currentVersionId: null,
          }),
          updatePrecedentValidityStatus: vi.fn(),
          now: () => new Date(),
        },
      ),
    ).rejects.toBeInstanceOf(PrecedentValidityRequiresCurrentVersionError);
  });

  it("выполняет rollback на superseded precedent version", async () => {
    txMock.precedentVersion.findUnique.mockResolvedValue({
      id: "precedent-version-old-current",
      status: "superseded",
      precedentId: "precedent-1",
      precedent: {
        id: "precedent-1",
        precedentKey: "precedent_1",
        displayTitle: "Судебный прецедент № 1",
        currentVersionId: "precedent-version-current",
      },
    });

    const result = await rollbackPrecedentCurrentVersion(
      {
        precedentVersionId: "precedent-version-old-current",
        confirmedByAccountId: "1e8f678a-7680-43d3-a1f7-0d62fd9ab2f0",
      },
      {
        getPrecedentVersionByIdForReview: vi.fn().mockResolvedValue({
          id: "precedent-version-old-current",
          status: "superseded",
        }),
        getPrecedentByIdForReview: vi.fn(),
        updatePrecedentValidityStatus: vi.fn(),
        now: () => new Date("2026-04-21T10:30:00.000Z"),
      },
    );

    expect(txMock.precedentVersion.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: "precedent-version-current",
      },
      data: {
        status: "superseded",
      },
    });
    expect(txMock.precedentVersion.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: "precedent-version-old-current",
        },
        data: expect.objectContaining({
          status: "current",
          confirmedByAccountId: "1e8f678a-7680-43d3-a1f7-0d62fd9ab2f0",
        }),
      }),
    );
    expect(result.status).toBe("current");
  });

  it("не позволяет rollback на imported_draft и сохраняет warning path отдельно", async () => {
    await expect(
      rollbackPrecedentCurrentVersion(
        {
          precedentVersionId: "precedent-version-draft",
          confirmedByAccountId: "1e8f678a-7680-43d3-a1f7-0d62fd9ab2f0",
        },
        {
          getPrecedentVersionByIdForReview: vi.fn().mockResolvedValue({
            id: "precedent-version-draft",
            status: "imported_draft",
          }),
          getPrecedentByIdForReview: vi.fn(),
          updatePrecedentValidityStatus: vi.fn(),
          now: () => new Date(),
        },
      ),
    ).rejects.toBeInstanceOf(PrecedentRollbackInvalidStatusError);

    expect(
      isStructurallyWeakPrecedentVersion({
        status: "imported_draft",
        blocks: [{ blockType: "unstructured" }],
      }),
    ).toBe(true);
    expect(
      isStructurallyWeakPrecedentVersion({
        status: "imported_draft",
        blocks: [{ blockType: "holding" }],
      }),
    ).toBe(false);
  });
});
