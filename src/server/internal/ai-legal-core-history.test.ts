import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/ai-request.repository", () => ({
  listRecentAIRequests: vi.fn(),
}));

import { listRecentAIRequests } from "@/db/repositories/ai-request.repository";
import { getAILegalCoreScenarioComparisons } from "@/server/internal/ai-legal-core-history";

describe("ai legal core history", () => {
  it("собирает comparison до/после для test scenario по последним AIRequest", async () => {
    vi.mocked(listRecentAIRequests).mockResolvedValue([
      {
        id: "req-2",
        featureKey: "server_legal_assistant",
        model: "gpt-5.4",
        status: "success",
        createdAt: new Date("2026-04-25T18:00:00.000Z"),
        requestPayloadJson: {
          raw_input: "меня задержали без причины",
          normalized_input: "Меня задержали без причины.",
          used_sources: [{ source_kind: "law", law_id: "law-1" }],
          test_run_context: {
            run_kind: "internal_ai_legal_core_test",
            test_run_id: "run-2",
            test_scenario_id: "scenario-1",
            test_scenario_group: "self_questions",
          },
        },
        responsePayloadJson: {
          total_tokens: 520,
          cost_usd: 0.02,
          latencyMs: 230,
          confidence: "high",
          self_assessment: {
            insufficient_data: false,
          },
          queue_for_future_ai_quality_review: false,
          answer_markdown_preview: "Новый ответ preview",
          ai_quality_review: {
            case_chain: {
              final_output_preview: "Новый ответ preview",
            },
          },
        },
        account: null,
        server: null,
      },
      {
        id: "req-1",
        featureKey: "server_legal_assistant",
        model: "gpt-5.4",
        status: "success",
        createdAt: new Date("2026-04-24T18:00:00.000Z"),
        requestPayloadJson: {
          raw_input: "меня задержали без причины",
          normalized_input: "Меня задержали без причины.",
          used_sources: [{ source_kind: "law", law_id: "law-1" }],
          test_run_context: {
            run_kind: "internal_ai_legal_core_test",
            test_run_id: "run-1",
            test_scenario_id: "scenario-1",
            test_scenario_group: "self_questions",
          },
        },
        responsePayloadJson: {
          total_tokens: 500,
          cost_usd: 0.018,
          latencyMs: 210,
          confidence: "medium",
          self_assessment: {
            insufficient_data: true,
          },
          queue_for_future_ai_quality_review: true,
          answer_markdown_preview: "Старый ответ preview",
          ai_quality_review: {
            case_chain: {
              final_output_preview: "Старый ответ preview",
            },
          },
        },
        account: null,
        server: null,
      },
    ]);

    const result = await getAILegalCoreScenarioComparisons({
      scenarioIds: ["scenario-1"],
    });

    expect(result.get("scenario-1")).toEqual(
      expect.objectContaining({
        scenarioId: "scenario-1",
        current: expect.objectContaining({
          testRunId: "run-2",
          confidence: "high",
          sentToReview: false,
        }),
        previous: expect.objectContaining({
          testRunId: "run-1",
          confidence: "medium",
          sentToReview: true,
        }),
        changed: {
          outputPreview: true,
          confidence: true,
          insufficientData: true,
          sentToReview: true,
        },
        deltas: {
          tokens: 20,
          costUsd: 0.002,
          latencyMs: 20,
          usedSourcesCount: 0,
        },
      }),
    );
  });
});
