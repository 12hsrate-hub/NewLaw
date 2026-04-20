import { describe, expect, it, vi } from "vitest";

import { listCurrentLawBlocksByServer, updateLawManualOverride } from "@/db/repositories/law.repository";

describe("law repository", () => {
  it("сохраняет manual override поля для discovery/import foundation", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "law-1",
      isExcluded: true,
      classificationOverride: "supplement",
      internalNote: "Исключить из обычного discovery.",
    });

    const result = await updateLawManualOverride(
      {
        lawId: "law-1",
        isExcluded: true,
        classificationOverride: "supplement",
        internalNote: "Исключить из обычного discovery.",
      },
      {
        law: {
          findMany: vi.fn(),
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          create: vi.fn(),
          update,
        },
      } as never,
    );

    expect(result.isExcluded).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: {
        id: "law-1",
      },
      data: {
        isExcluded: true,
        classificationOverride: "supplement",
        internalNote: "Исключить из обычного discovery.",
      },
    });
  });

  it("строит retrieval query только по current primary laws выбранного сервера", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await listCurrentLawBlocksByServer(
      {
        serverId: "server-1",
      },
      {
        law: {
          findMany: vi.fn(),
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
        lawBlock: {
          findMany,
        },
      } as never,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lawVersion: {
            status: "current",
            currentForLaw: {
              is: {
                serverId: "server-1",
                isExcluded: false,
                lawKind: "primary",
              },
            },
          },
        },
      }),
    );
  });
});
