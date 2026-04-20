import { describe, expect, it, vi } from "vitest";

import { updatePrecedentValidityStatus } from "@/db/repositories/precedent.repository";

describe("precedent repository", () => {
  it("сохраняет validity_status отдельно от version lifecycle", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "precedent-1",
      validityStatus: "limited",
    });

    const result = await updatePrecedentValidityStatus(
      {
        precedentId: "precedent-1",
        validityStatus: "limited",
      },
      {
        precedent: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
          findUnique: vi.fn(),
          create: vi.fn(),
          update,
        },
      } as never,
    );

    expect(result.validityStatus).toBe("limited");
    expect(update).toHaveBeenCalledWith({
      where: {
        id: "precedent-1",
      },
      data: {
        validityStatus: "limited",
      },
    });
  });
});
