import { describe, expect, it } from "vitest";

import {
  buildAIStageUsageEntry,
  estimateUsageCostUsd,
  extractAIReviewerStageUsage,
  mergeAIStageUsageEntries,
} from "@/server/legal-core/observability";

describe("observability helpers", () => {
  it("оценивает стоимость по pricing config для gpt-5.4-mini и nano", () => {
    expect(
      estimateUsageCostUsd({
        model: "gpt-5.4-mini",
        prompt_tokens: 1000,
        completion_tokens: 500,
      }),
    ).toBe(0.003);
    expect(
      estimateUsageCostUsd({
        model: "gpt-5.4-nano",
        prompt_tokens: 1000,
        completion_tokens: 500,
      }),
    ).toBe(0.000825);
  });

  it("использует explicit cost, если proxy его вернул", () => {
    expect(
      buildAIStageUsageEntry({
        model: "gpt-5.4-mini",
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
        cost_usd: 0.1234567,
        latency_ms: 900,
      }),
    ).toEqual({
      model: "gpt-5.4-mini",
      prompt_tokens: 1000,
      completion_tokens: 500,
      total_tokens: 1500,
      estimated_cost_usd: 0.123457,
      latency_ms: 900,
    });
  });

  it("может агрегировать retry usage и review usage", () => {
    const retryUsage = mergeAIStageUsageEntries([
      buildAIStageUsageEntry({
        model: "gpt-5.4-mini",
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        cost_usd: null,
        latency_ms: 400,
      }),
      buildAIStageUsageEntry({
        model: "gpt-5.4-mini",
        prompt_tokens: 80,
        completion_tokens: 10,
        total_tokens: 90,
        cost_usd: null,
        latency_ms: 300,
      }),
    ]);

    expect(retryUsage).toEqual({
      model: "gpt-5.4-mini",
      prompt_tokens: 180,
      completion_tokens: 30,
      total_tokens: 210,
      estimated_cost_usd: 0.00027,
      latency_ms: 700,
    });

    const reviewStageUsage = extractAIReviewerStageUsage({
      ai_quality_review: {
        layers: {
          ai_reviewer: {
            status: "completed",
            model: "gpt-5.4-mini",
            latency_ms: 1200,
            prompt_tokens: 200,
            completion_tokens: 50,
            total_tokens: 250,
            cost_usd: null,
          },
        },
      },
    });

    expect(reviewStageUsage).toEqual({
      model: "gpt-5.4-mini",
      prompt_tokens: 200,
      completion_tokens: 50,
      total_tokens: 250,
      estimated_cost_usd: 0.000375,
      latency_ms: 1200,
    });
  });
});
