import { describe, expect, it } from "vitest";

import {
  createPrecedentInputSchema,
  precedentSourceTopicManualOverrideSchema,
} from "@/schemas/precedent-corpus";

describe("precedent corpus schema", () => {
  it("не позволяет смешивать precedent classification с law_kind/supplement", () => {
    const result = precedentSourceTopicManualOverrideSchema.safeParse({
      sourceTopicId: "source-topic-1",
      isExcluded: false,
      classificationOverride: "supplement",
      internalNote: null,
    });

    expect(result.success).toBe(false);
  });

  it("поддерживает отдельный validity_status для precedent", () => {
    const result = createPrecedentInputSchema.safeParse({
      serverId: "server-1",
      precedentSourceTopicId: "source-topic-1",
      precedentKey: "supreme_court_case_1",
      displayTitle: "Решение Верховного суда",
      precedentLocatorKey: "case_1",
      validityStatus: "obsolete",
    });

    expect(result.success).toBe(true);
  });
});
