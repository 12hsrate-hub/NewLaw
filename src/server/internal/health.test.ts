import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/server.repository", () => ({
  listServerDirectoryServers: vi.fn(),
}));

vi.mock("@/db/repositories/law-source-index.repository", () => ({
  listLawSourceIndexes: vi.fn(),
}));

vi.mock("@/db/repositories/precedent-source-topic.repository", () => ({
  listPrecedentSourceTopicsForAdminReview: vi.fn(),
}));

vi.mock("@/server/http/health", () => ({
  getHealthPayload: vi.fn(),
}));

vi.mock("@/server/internal/ai-quality-review", () => ({
  getInternalAIQualityReviewPreview: vi.fn(),
}));

import { listLawSourceIndexes } from "@/db/repositories/law-source-index.repository";
import { listPrecedentSourceTopicsForAdminReview } from "@/db/repositories/precedent-source-topic.repository";
import { listServerDirectoryServers } from "@/db/repositories/server.repository";
import { getHealthPayload } from "@/server/http/health";
import { getInternalAIQualityReviewPreview } from "@/server/internal/ai-quality-review";
import { getInternalHealthContext } from "@/server/internal/health";

describe("internal health context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_REVIEW_ENABLED = "true";
    process.env.AI_REVIEW_MODE = "full";
    process.env.AI_REVIEW_DAILY_REQUEST_LIMIT = "500";
    process.env.AI_REVIEW_DAILY_COST_LIMIT_USD = "25";
    vi.mocked(getInternalAIQualityReviewPreview).mockResolvedValue({
      queuedCount: 2,
      byPriority: {
        high: 1,
        medium: 1,
        low: 0,
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
          rootCause: "normalization_issue",
          flags: ["normalization_changed_meaning"],
          issueClusterKey: "cluster-1",
          account: null,
          server: {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          },
          outputPreview: "Preview",
        },
      ],
    });
  });

  afterEach(() => {
    delete process.env.AI_REVIEW_ENABLED;
    delete process.env.AI_REVIEW_MODE;
    delete process.env.AI_REVIEW_DAILY_REQUEST_LIMIT;
    delete process.env.AI_REVIEW_DAILY_COST_LIMIT_USD;
  });

  it("собирает compact runtime summary, server health statuses и concise warnings", async () => {
    vi.mocked(getHealthPayload).mockReturnValue({
      status: "ok",
      service: "lawyer5rp-mvp",
      environment: "production",
      timestamp: "2026-04-22T12:00:00.000Z",
      checks: {
        api: "ok",
        prisma: "prepared",
        database: "not-configured-yet",
      },
    });
    vi.mocked(listServerDirectoryServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
        isActive: true,
        laws: [
          {
            lawKind: "primary",
            isExcluded: false,
            classificationOverride: null,
            currentVersionId: "version-1",
            _count: {
              versions: 1,
            },
          },
        ],
      },
      {
        id: "server-2",
        code: "sunrise",
        name: "Sunrise",
        isActive: true,
        laws: [],
      },
      {
        id: "server-3",
        code: "legacy",
        name: "Legacy",
        isActive: false,
        laws: [],
      },
    ] as never);
    vi.mocked(listLawSourceIndexes).mockResolvedValue([
      {
        id: "source-1",
        serverId: "server-1",
        isEnabled: true,
        lastDiscoveryStatus: "success",
      },
      {
        id: "source-2",
        serverId: "server-2",
        isEnabled: true,
        lastDiscoveryStatus: "failure",
      },
    ] as never);
    vi.mocked(listPrecedentSourceTopicsForAdminReview).mockResolvedValue([
      {
        id: "topic-1",
        serverId: "server-1",
        lastDiscoveryStatus: "success",
        importRuns: [
          {
            status: "success",
          },
        ],
        precedents: [
          {
            currentVersionId: "precedent-version-1",
            validityStatus: "applicable",
          },
        ],
      },
      {
        id: "topic-2",
        serverId: "server-2",
        lastDiscoveryStatus: "failure",
        importRuns: [
          {
            status: "failure",
          },
        ],
        precedents: [],
      },
    ] as never);

    const result = await getInternalHealthContext();

    expect(result.runtime.environment).toBe("production");
    expect(result.aiQualityReview).toMatchObject({
      enabled: true,
      mode: "full",
      dailyRequestLimit: 500,
      dailyCostLimitUsd: 25,
    });
    expect(result.aiQualityReviewPreview.queuedCount).toBe(2);
    expect(result.serverSummaries).toHaveLength(3);
    expect(result.serverSummaries[0]).toMatchObject({
      code: "blackberry",
      assistantStatus: "current_corpus_ready",
      currentPrimaryLawCount: 1,
      enabledLawSourceCount: 1,
      precedentTopicCount: 1,
      currentPrecedentCount: 1,
      warnings: [],
    });
    expect(result.serverSummaries[1]).toMatchObject({
      code: "sunrise",
      assistantStatus: "no_corpus",
      currentPrimaryLawCount: 0,
      enabledLawSourceCount: 1,
      precedentTopicCount: 1,
      currentPrecedentCount: 0,
    });
    expect(result.serverSummaries[1]?.warnings.map((warning) => warning.message)).toEqual(
      expect.arrayContaining([
        "Нет usable corpus для normal assistant flow.",
        "Есть recent law discovery failure.",
        "Есть recent precedent discovery failure.",
        "Есть recent precedent import failure.",
      ]),
    );
    expect(result.serverSummaries[2]).toMatchObject({
      code: "legacy",
      assistantStatus: "assistant_disabled",
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
