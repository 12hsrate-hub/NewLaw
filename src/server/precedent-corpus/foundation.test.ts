import { describe, expect, it, vi } from "vitest";

import {
  createImportedDraftPrecedentVersion,
  PrecedentImportRunConflictError,
  startPrecedentImportRun,
} from "@/server/precedent-corpus/foundation";

describe("precedent corpus foundation services", () => {
  it("не позволяет стартовать второй активный precedent import run с тем же lock key", async () => {
    await expect(
      startPrecedentImportRun(
        {
          serverId: "server-1",
          sourceIndexId: "source-1",
          mode: "discovery",
        },
        {
          getPrecedentBySourceTopicAndLocator: vi.fn(),
          getPrecedentByServerAndKey: vi.fn(),
          createPrecedentRecord: vi.fn(),
          updatePrecedentDisplayTitle: vi.fn(),
          getActivePrecedentImportRunByLockKey: vi.fn().mockResolvedValue({ id: "run-1" }),
          createPrecedentImportRunRecord: vi.fn(),
          finishPrecedentImportRunRecord: vi.fn(),
          findPrecedentVersionByNormalizedHash: vi.fn(),
          createPrecedentVersionRecord: vi.fn(),
          listPrecedentVersionsByPrecedent: vi.fn(),
          updatePrecedentVersionMutableFields: vi.fn(),
          replacePrecedentSourcePostsForVersion: vi.fn(),
          replacePrecedentBlocksForVersion: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(PrecedentImportRunConflictError);
  });

  it("не плодит лишние precedent versions при unchanged normalized hash", async () => {
    const existingVersion = { id: "precedent-version-1" };

    const result = await createImportedDraftPrecedentVersion(
      {
        precedentId: "precedent-1",
        normalizedFullText: "Текст precedent",
        sourceSnapshotHash: "source-hash",
        normalizedTextHash: "normalized-hash",
      },
      {
        getPrecedentBySourceTopicAndLocator: vi.fn(),
        getPrecedentByServerAndKey: vi.fn(),
        createPrecedentRecord: vi.fn(),
        updatePrecedentDisplayTitle: vi.fn(),
        getActivePrecedentImportRunByLockKey: vi.fn(),
        createPrecedentImportRunRecord: vi.fn(),
        finishPrecedentImportRunRecord: vi.fn(),
        findPrecedentVersionByNormalizedHash: vi.fn().mockResolvedValue(existingVersion),
        createPrecedentVersionRecord: vi.fn(),
        listPrecedentVersionsByPrecedent: vi.fn(),
        updatePrecedentVersionMutableFields: vi.fn(),
        replacePrecedentSourcePostsForVersion: vi.fn(),
        replacePrecedentBlocksForVersion: vi.fn(),
      },
    );

    expect(result).toBe(existingVersion);
  });

  it("оставляет только один активный imported_draft на precedent", async () => {
    const updatePrecedentVersionMutableFields = vi.fn();
    const createPrecedentVersionRecord = vi.fn().mockResolvedValue({
      id: "precedent-version-new-draft",
      status: "imported_draft",
    });

    await createImportedDraftPrecedentVersion(
      {
        precedentId: "precedent-1",
        normalizedFullText: "Новая редакция precedent",
        sourceSnapshotHash: "source-hash-2",
        normalizedTextHash: "normalized-hash-2",
      },
      {
        getPrecedentBySourceTopicAndLocator: vi.fn(),
        getPrecedentByServerAndKey: vi.fn(),
        createPrecedentRecord: vi.fn(),
        updatePrecedentDisplayTitle: vi.fn(),
        getActivePrecedentImportRunByLockKey: vi.fn(),
        createPrecedentImportRunRecord: vi.fn(),
        finishPrecedentImportRunRecord: vi.fn(),
        findPrecedentVersionByNormalizedHash: vi.fn().mockResolvedValue(null),
        createPrecedentVersionRecord,
        listPrecedentVersionsByPrecedent: vi.fn().mockResolvedValue([
          {
            id: "precedent-version-old-draft",
            status: "imported_draft",
          },
          {
            id: "precedent-version-current",
            status: "current",
          },
        ]),
        updatePrecedentVersionMutableFields,
        replacePrecedentSourcePostsForVersion: vi.fn(),
        replacePrecedentBlocksForVersion: vi.fn(),
      },
    );

    expect(updatePrecedentVersionMutableFields).toHaveBeenCalledWith("precedent-version-old-draft", {
      status: "superseded",
    });
    expect(createPrecedentVersionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        precedentId: "precedent-1",
        status: "imported_draft",
      }),
    );
  });
});
