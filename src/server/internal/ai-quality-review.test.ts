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
        responsePayloadJson: {
          ai_quality_review: {
            queue_for_super_admin: true,
            risk_level: "high",
            root_cause: "normalization_issue",
            flags: ["normalization_changed_meaning"],
            issue_cluster_key: "cluster-1",
            case_chain: {
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
        responsePayloadJson: {
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
    expect(result.recentQueuedItems).toEqual([
      expect.objectContaining({
        id: "ai-request-1",
        featureKey: "server_legal_assistant",
        priority: "high",
        rootCause: "normalization_issue",
        outputPreview: "Preview 1",
      }),
    ]);
  });
});
