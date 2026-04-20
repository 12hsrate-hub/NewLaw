import { describe, expect, it, vi } from "vitest";

import {
  DirectPrecedentTextUpdateError,
  updatePrecedentVersionMutableFields,
} from "@/db/repositories/precedent-version.repository";

describe("precedent version repository", () => {
  it("сохраняет version status отдельно от precedent validity", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "version-1",
      status: "current",
      confirmedByAccountId: "3d14613b-4479-4498-aa76-49767b4661aa",
    });

    const result = await updatePrecedentVersionMutableFields(
      "version-1",
      {
        status: "current",
        confirmedAt: new Date("2026-04-20T12:00:00.000Z"),
        confirmedByAccountId: "3d14613b-4479-4498-aa76-49767b4661aa",
      },
      {
        precedentVersion: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
          findUnique: vi.fn(),
          create: vi.fn(),
          update,
        },
      } as never,
    );

    expect(result.status).toBe("current");
    expect(update).toHaveBeenCalledWith({
      where: {
        id: "version-1",
      },
      data: {
        status: "current",
        confirmedAt: new Date("2026-04-20T12:00:00.000Z"),
        confirmedByAccountId: "3d14613b-4479-4498-aa76-49767b4661aa",
      },
    });
  });

  it("не позволяет редактировать текст precedent через mutable update слой", async () => {
    await expect(
      updatePrecedentVersionMutableFields(
        "version-1",
        {
          normalizedFullText: "Новый текст",
        },
        {
          precedentVersion: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
          },
        } as never,
      ),
    ).rejects.toBeInstanceOf(DirectPrecedentTextUpdateError);
  });
});
