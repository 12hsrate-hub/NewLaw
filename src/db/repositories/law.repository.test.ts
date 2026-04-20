import { describe, expect, it, vi } from "vitest";

import { updateLawManualOverride } from "@/db/repositories/law.repository";

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
});
