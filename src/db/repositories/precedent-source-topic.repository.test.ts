import { describe, expect, it, vi } from "vitest";

import { updatePrecedentSourceTopicManualOverride } from "@/db/repositories/precedent-source-topic.repository";

describe("precedent source topic repository", () => {
  it("сохраняет manual override поля foundation-уровня", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "source-topic-1",
      isExcluded: true,
      classificationOverride: "ignored",
      internalNote: "Оставить только для ручного review.",
    });

    const result = await updatePrecedentSourceTopicManualOverride(
      {
        sourceTopicId: "source-topic-1",
        isExcluded: true,
        classificationOverride: "ignored",
        internalNote: "Оставить только для ручного review.",
      },
      {
        precedentSourceTopic: {
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
        id: "source-topic-1",
      },
      data: {
        isExcluded: true,
        classificationOverride: "ignored",
        internalNote: "Оставить только для ручного review.",
      },
    });
  });
});
