import { describe, expect, it, vi } from "vitest";

import {
  DirectLawTextUpdateError,
  createLawVersionRecord,
  updateLawVersionMutableFields,
} from "@/db/repositories/law-version.repository";

describe("law version repository", () => {
  it("создаёт imported draft snapshot версии закона", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "version-1",
      status: "imported_draft",
    });

    const result = await createLawVersionRecord(
      {
        lawId: "law-1",
        normalizedFullText: "Статья 1. Текст",
        sourceSnapshotHash: "source-hash",
        normalizedTextHash: "normalized-hash",
      },
      {
        lawVersion: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          findMany: vi.fn(),
          create,
          update: vi.fn(),
        },
      } as never,
    );

    expect(result.status).toBe("imported_draft");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lawId: "law-1",
          normalizedTextHash: "normalized-hash",
        }),
      }),
    );
  });

  it("запрещает ручной update текста закона через mutable repository слой", async () => {
    await expect(
      updateLawVersionMutableFields(
        "version-1",
        {
          normalizedFullText: "Ручная правка",
        },
        {
          lawVersion: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
          },
        } as never,
      ),
    ).rejects.toBeInstanceOf(DirectLawTextUpdateError);
  });
});
