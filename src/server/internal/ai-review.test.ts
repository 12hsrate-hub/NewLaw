import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/internal/ai-quality-review", () => ({
  getInternalAIQualityReviewPreview: vi.fn(),
}));

import { getInternalAIQualityReviewPreview } from "@/server/internal/ai-quality-review";
import { getInternalAIReviewPageContext } from "@/server/internal/ai-review";

describe("internal ai review page context", () => {
  it("собирает queue preview, behavior rules и fix instruction template", async () => {
    vi.mocked(getInternalAIQualityReviewPreview).mockResolvedValue({
      queuedCount: 1,
      byPriority: {
        high: 1,
        medium: 0,
        low: 0,
      },
      analytics: {
        reviewedCount: 2,
        queuedCount: 1,
        totalTokens: 500,
        totalCostUsd: 0.021,
        byRootCause: [],
        byFlag: [],
        byPromptVersion: [],
        byLawVersion: [],
        byFixTarget: [],
      },
      recentQueuedItems: [
        {
          id: "ai-request-1",
          createdAt: "2026-04-25T16:00:00.000Z",
          featureKey: "server_legal_assistant",
          model: "gpt-5.4",
          status: "success",
          queueForSuperAdmin: true,
          priority: "high",
          qualityScore: 0.28,
          confidence: "low",
          rootCause: "normalization_issue",
          inputQuality: "medium",
          flags: ["normalization_changed_meaning"],
          reviewItems: ["Нормализация изменила смысл исходного ввода."],
          issueClusterKey: "cluster-1",
          fixTarget: "normalization_prompt",
          account: null,
          server: null,
          caseChain: {
            rawInput: "я хачу абжаловать отказ",
            normalizedInput: "Я хочу обжаловать отказ.",
            normalizationModel: "gpt-5.4-nano",
            normalizationPromptVersion: "input_normalization_v1",
            normalizationChanged: true,
            normalizationComparisonResult: "orthography_fixed",
            retrievedSources: [{ lawId: "law-1" }],
            finalOutputPreview: "Preview 1",
          },
          aiReviewerStatus: "completed",
          outputPreview: "Preview 1",
        },
      ],
    });

    const result = await getInternalAIReviewPageContext();

    expect(result.reviewPreview.queuedCount).toBe(1);
    expect(result.accessViews.superAdmin).toEqual({
      accessRole: "super_admin",
      visibility: "full_raw",
    });
    expect(result.accessViews.serverAdmin).toMatchObject({
      accessRole: "server_admin",
      visibility: "anonymized_statistics",
      queuedCount: 1,
      byPriority: {
        high: 1,
        medium: 0,
        low: 0,
      },
    });
    expect(result.accessViews.tester).toMatchObject({
      accessRole: "tester",
      visibility: "sanitized_test_examples",
      examples: [
        expect.objectContaining({
          id: "ai-request-1",
          featureKey: "server_legal_assistant",
          priority: "high",
          rootCause: "normalization_issue",
          flags: ["normalization_changed_meaning"],
        }),
      ],
    });
    expect(result.accessViews.tester.examples[0]?.availableChain).toEqual({
      hasRawInput: true,
      hasNormalizedInput: true,
      retrievedSourcesCount: 1,
      hasFinalOutput: true,
    });
    expect(result.behaviorRules.length).toBeGreaterThan(0);
    expect(result.confirmedIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueId: "confirmed-normalization-meaning-shift-v1",
          rootCause: "normalization_issue",
        }),
      ]),
    );
    expect(result.confirmedIssueLifecycle).toEqual({
      total: 3,
      byStatus: {
        confirmed_followup_required: 0,
        fix_in_progress: 1,
        regression_ready: 1,
        closed: 1,
      },
      closableCount: 1,
      closedCount: 1,
    });
    expect(result.fixInstructionTemplate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "what_ai_did_wrong",
          required: true,
        }),
      ]),
    );
    expect(result.regressionGateItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemKey: "issue_scope_confirmed",
          required: true,
        }),
      ]),
    );
    expect(result.regressionGateRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleKey: "close_requires_test_or_justification",
        }),
      ]),
    );
    expect(result.workflowNotes).toEqual(
      expect.arrayContaining([
        "AI Behavior Rules остаются repo-managed source of truth и меняются только через PR и commit.",
      ]),
    );
  });
});
