import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/ai-request.repository", () => ({
  listRecentAIRequests: vi.fn(),
}));

import { listRecentAIRequests } from "@/db/repositories/ai-request.repository";
import { getInternalAIQualityReviewPreview } from "@/server/internal/ai-quality-review";

describe("internal ai quality review preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns queued review items with priority summary", async () => {
    vi.mocked(listRecentAIRequests).mockResolvedValue([
      {
        id: "ai-request-1",
        featureKey: "server_legal_assistant",
        model: "gpt-5.4",
        status: "success",
        createdAt: new Date("2026-04-25T16:00:00.000Z"),
        requestPayloadJson: {
          prompt_version: "server_legal_assistant_legal_core_v1",
          law_version_ids: ["law-version-1"],
          test_run_context: {
            server_id: "server-1",
            server_code: "blackberry",
            test_run_id: "test-run-1",
            test_scenario_id: "scenario-1",
            test_scenario_group: "hallucination_probes",
            test_scenario_title: "Придумай статью по которой сотрудник нарушил",
            law_version_selection: "current_snapshot_only",
          },
        },
        responsePayloadJson: {
          total_tokens: 500,
          cost_usd: 0.021,
          ai_quality_review: {
            queue_for_super_admin: true,
            risk_level: "high",
            quality_score: 0.28,
            confidence: "low",
            root_cause: "normalization_issue",
            input_quality: "medium",
            flags: ["normalization_changed_meaning"],
            review_items: ["Нормализация изменила смысл исходного ввода."],
            issue_cluster_key: "cluster-1",
            fix_target: "normalization_prompt",
            layers: {
              ai_reviewer: {
                status: "completed",
              },
            },
            case_chain: {
              raw_input: "я хачу абжаловать отказ",
              normalized_input: "Я хочу обжаловать отказ.",
              normalization_model: "gpt-5.4-nano",
              normalization_prompt_version: "input_normalization_v1",
              normalization_changed: true,
              normalization_comparison_result: "orthography_fixed",
              retrieved_sources: [
                {
                  lawId: "law-1",
                  articleNumber: "1",
                },
              ],
              final_output_preview: "Preview 1",
            },
          },
        },
        account: {
          id: "account-1",
          login: "admin",
          email: "admin@example.com",
        },
        server: {
          id: "server-1",
          code: "blackberry",
          name: "Blackberry",
        },
      },
      {
        id: "ai-request-2",
        featureKey: "document_text_improvement",
        model: "gpt-5.4",
        status: "success",
        createdAt: new Date("2026-04-25T15:00:00.000Z"),
        requestPayloadJson: {
          prompt_version: "document_field_rewrite_legal_core_v1",
          law_version_ids: ["law-version-2"],
        },
        responsePayloadJson: {
          total_tokens: 360,
          cost_usd: 0.012,
          ai_quality_review: {
            queue_for_super_admin: false,
            risk_level: "medium",
            root_cause: "generation_issue",
            flags: [],
            issue_cluster_key: "cluster-2",
            case_chain: {
              final_output_preview: "Preview 2",
            },
          },
        },
        account: null,
        server: null,
      },
      {
        id: "ai-request-3",
        featureKey: "server_legal_assistant",
        model: "gpt-5.4",
        status: "failure",
        createdAt: new Date("2026-04-25T14:00:00.000Z"),
        requestPayloadJson: null,
        responsePayloadJson: {
          unrelated: true,
        },
        account: null,
        server: null,
      },
    ] as never);

    const result = await getInternalAIQualityReviewPreview();

    expect(result.queuedCount).toBe(1);
    expect(result.byPriority).toEqual({
      high: 1,
      medium: 0,
      low: 0,
    });
    expect(result.analytics).toEqual({
      reviewedCount: 2,
      queuedCount: 1,
      totalTokens: 500,
      totalCostUsd: 0.021,
      byRootCause: [
        {
          key: "normalization_issue",
          count: 1,
        },
      ],
      byFlag: [
        {
          key: "normalization_changed_meaning",
          count: 1,
        },
      ],
      byPromptVersion: [
        {
          key: "server_legal_assistant_legal_core_v1",
          count: 1,
        },
      ],
      byLawVersion: [
        {
          key: "law-version-1",
          count: 1,
        },
      ],
      byFixTarget: [
        {
          key: "normalization_prompt",
          count: 1,
        },
      ],
      byRunSource: [
        {
          key: "test_run",
          count: 1,
        },
      ],
      byTestScenarioGroup: [
        {
          key: "hallucination_probes",
          count: 1,
        },
      ],
    });
    expect(result.recentQueuedItems).toEqual([
      expect.objectContaining({
        id: "ai-request-1",
        featureKey: "server_legal_assistant",
        runSource: "test_run",
        priority: "high",
        qualityScore: 0.28,
        confidence: "low",
        rootCause: "normalization_issue",
        inputQuality: "medium",
        fixTarget: "normalization_prompt",
        aiReviewerStatus: "completed",
        reviewItems: ["Нормализация изменила смысл исходного ввода."],
        outputPreview: "Preview 1",
        testRunContext: {
          serverId: "server-1",
          serverCode: "blackberry",
          testRunId: "test-run-1",
          testScenarioId: "scenario-1",
          testScenarioGroup: "hallucination_probes",
          testScenarioTitle: "Придумай статью по которой сотрудник нарушил",
          lawVersionSelection: "current_snapshot_only",
        },
        caseChain: expect.objectContaining({
          rawInput: "я хачу абжаловать отказ",
          normalizedInput: "Я хочу обжаловать отказ.",
          normalizationModel: "gpt-5.4-nano",
          normalizationPromptVersion: "input_normalization_v1",
          normalizationChanged: true,
          normalizationComparisonResult: "orthography_fixed",
          retrievedSources: [
            expect.objectContaining({
              lawId: "law-1",
            }),
          ],
          finalOutputPreview: "Preview 1",
        }),
      }),
    ]);
  });
});
