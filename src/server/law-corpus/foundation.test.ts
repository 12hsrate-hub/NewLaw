import { describe, expect, it, vi } from "vitest";

import {
  LawImportRunConflictError,
  buildLawImportRunLockKey,
  createImportedDraftLawVersion,
  registerLawStub,
  startLawImportRun,
} from "@/server/law-corpus/foundation";

describe("law corpus foundation services", () => {
  it("дедуплицирует law stub по server + topic_external_id", async () => {
    const existingLaw = {
      id: "law-1",
      lawKey: "criminal_code",
    };

    const result = await registerLawStub(
      {
        serverId: "server-1",
        title: "Уголовный кодекс",
        topicUrl: "https://forum.gta5rp.com/threads/123",
        topicExternalId: "123",
        lawKind: "primary",
      },
      {
        getLawByServerAndTopicExternalId: vi.fn().mockResolvedValue(existingLaw),
        getLawByServerAndLawKey: vi.fn(),
        createLawRecord: vi.fn(),
        getActiveLawImportRunByLockKey: vi.fn(),
        createLawImportRunRecord: vi.fn(),
        finishLawImportRunRecord: vi.fn(),
        findLawVersionByNormalizedHash: vi.fn(),
        createLawVersionRecord: vi.fn(),
        replaceLawSourcePostsForVersion: vi.fn(),
        replaceLawBlocksForVersion: vi.fn(),
      },
    );

    expect(result).toBe(existingLaw);
  });

  it("строит server-scoped law_key и сохраняет новый закон", async () => {
    const createLawRecord = vi.fn().mockResolvedValue({
      id: "law-1",
      lawKey: "ugolovnyj_kodeks_123",
    });

    await registerLawStub(
      {
        serverId: "server-1",
        title: "Уголовный кодекс",
        topicUrl: "https://forum.gta5rp.com/threads/123",
        topicExternalId: "123",
        lawKind: "primary",
      },
      {
        getLawByServerAndTopicExternalId: vi.fn().mockResolvedValue(null),
        getLawByServerAndLawKey: vi
          .fn()
          .mockResolvedValueOnce({ id: "law-existing" })
          .mockResolvedValueOnce(null),
        createLawRecord,
        getActiveLawImportRunByLockKey: vi.fn(),
        createLawImportRunRecord: vi.fn(),
        finishLawImportRunRecord: vi.fn(),
        findLawVersionByNormalizedHash: vi.fn(),
        createLawVersionRecord: vi.fn(),
        replaceLawSourcePostsForVersion: vi.fn(),
        replaceLawBlocksForVersion: vi.fn(),
      },
    );

    expect(createLawRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        serverId: "server-1",
        topicExternalId: "123",
      }),
    );
    expect(createLawRecord.mock.calls[0]?.[0]?.lawKey).toContain("123");
  });

  it("не позволяет стартовать второй активный import run с тем же lock key", async () => {
    await expect(
      startLawImportRun(
        {
          serverId: "server-1",
          sourceIndexId: "source-1",
          mode: "discovery",
        },
        {
          getLawByServerAndTopicExternalId: vi.fn(),
          getLawByServerAndLawKey: vi.fn(),
          createLawRecord: vi.fn(),
          getActiveLawImportRunByLockKey: vi.fn().mockResolvedValue({ id: "run-1" }),
          createLawImportRunRecord: vi.fn(),
          finishLawImportRunRecord: vi.fn(),
          findLawVersionByNormalizedHash: vi.fn(),
          createLawVersionRecord: vi.fn(),
          replaceLawSourcePostsForVersion: vi.fn(),
          replaceLawBlocksForVersion: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(LawImportRunConflictError);
  });

  it("строит lock key для server/source scope", () => {
    expect(
      buildLawImportRunLockKey({
        serverId: "server-1",
        sourceIndexId: "source-1",
        mode: "discovery",
      }),
    ).toBe("law-run:server-1:discovery:source-1");
  });

  it("не плодит лишние law versions при unchanged normalized hash", async () => {
    const existingVersion = { id: "version-1" };

    const result = await createImportedDraftLawVersion(
      {
        lawId: "law-1",
        normalizedFullText: "Статья 1. Текст",
        sourceSnapshotHash: "source-hash",
        normalizedTextHash: "normalized-hash",
      },
      {
        getLawByServerAndTopicExternalId: vi.fn(),
        getLawByServerAndLawKey: vi.fn(),
        createLawRecord: vi.fn(),
        getActiveLawImportRunByLockKey: vi.fn(),
        createLawImportRunRecord: vi.fn(),
        finishLawImportRunRecord: vi.fn(),
        findLawVersionByNormalizedHash: vi.fn().mockResolvedValue(existingVersion),
        createLawVersionRecord: vi.fn(),
        replaceLawSourcePostsForVersion: vi.fn(),
        replaceLawBlocksForVersion: vi.fn(),
      },
    );

    expect(result).toBe(existingVersion);
  });
});
