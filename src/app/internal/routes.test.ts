import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/internal/access", () => ({
  getInternalAccessContext: vi.fn(),
}));

vi.mock("@/server/internal/corpus", () => ({
  getInternalLawCorpusPageData: vi.fn(),
  getInternalPrecedentCorpusPageData: vi.fn(),
}));

vi.mock("@/server/admin-security/account-search", () => ({
  findAccountForAdminSearch: vi.fn(),
}));

vi.mock("@/server/internal/health", () => ({
  getInternalHealthContext: vi.fn(),
}));

vi.mock("@/server/internal/ai-review", () => ({
  getInternalAIReviewPageContext: vi.fn(),
}));

vi.mock("@/server/internal/access-requests", () => ({
  getInternalAccessRequestsContext: vi.fn(),
}));

import InternalAccessRequestsPage from "@/app/internal/access-requests/page";
import InternalAIReviewPage from "@/app/internal/ai-review/page";
import InternalHealthPage from "@/app/internal/health/page";
import InternalLawsPage from "@/app/internal/laws/page";
import InternalPrecedentsPage from "@/app/internal/precedents/page";
import InternalSecurityPage from "@/app/internal/security/page";
import { findAccountForAdminSearch } from "@/server/admin-security/account-search";
import { getInternalAccessContext } from "@/server/internal/access";
import { getInternalAccessRequestsContext } from "@/server/internal/access-requests";
import {
  getInternalLawCorpusPageData,
  getInternalPrecedentCorpusPageData,
} from "@/server/internal/corpus";
import { getInternalAIReviewPageContext } from "@/server/internal/ai-review";
import { getInternalHealthContext } from "@/server/internal/health";

describe("internal target route skeletons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInternalAccessContext).mockResolvedValue({
      status: "granted",
      viewer: {
        accountId: "account-1",
        email: "admin@example.com",
        login: "admin",
      },
    });
    vi.mocked(getInternalLawCorpusPageData).mockResolvedValue({
      bootstrapHealthByServerId: {},
      laws: [],
      previewQuery: "",
      retrievalPreview: null,
      selectedPreviewServerId: "",
      servers: [
        {
          id: "server-1",
          name: "Blackberry",
        },
      ],
      sourceIndexes: [],
    });
    vi.mocked(getInternalPrecedentCorpusPageData).mockResolvedValue({
      servers: [
        {
          id: "server-1",
          name: "Blackberry",
        },
      ],
      sourceIndexes: [],
      sourceTopics: [],
    });
    vi.mocked(findAccountForAdminSearch).mockResolvedValue({
      status: "idle",
      identifier: "",
      account: null,
      message: null,
    });
    vi.mocked(getInternalHealthContext).mockResolvedValue({
      runtime: {
        status: "ok",
        service: "lawyer5rp-mvp",
        environment: "test",
        timestamp: "2026-04-22T12:00:00.000Z",
        checks: {
          api: "ok",
          prisma: "prepared",
          database: "not-configured-yet",
        },
      },
      aiQualityReview: {
        enabled: true,
        mode: "full",
        dailyRequestLimit: 500,
        dailyCostLimitUsd: 25,
        todayReviewerAttemptCount: 12,
        todayReviewerCostUsd: 1.75,
        requestLimitReached: false,
        costLimitReached: false,
      },
      aiQualityReviewPreview: {
        queuedCount: 2,
        byPriority: {
          high: 1,
          medium: 1,
          low: 0,
        },
        analytics: {
          reviewedCount: 3,
          queuedCount: 2,
          totalTokens: 860,
          totalCostUsd: 0.033,
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
            server: {
              id: "server-1",
              code: "blackberry",
              name: "Blackberry",
            },
            caseChain: {
              rawInput: "я хачу абжаловать отказ",
              normalizedInput: "Я хочу обжаловать отказ.",
              normalizationModel: "gpt-5.4-nano",
              normalizationPromptVersion: "input_normalization_v1",
              normalizationChanged: true,
              normalizationComparisonResult: "orthography_fixed",
              retrievedSources: [
                {
                  lawId: "law-1",
                },
              ],
              finalOutputPreview: "Preview",
            },
            aiReviewerStatus: "completed",
            outputPreview: "Preview",
          },
        ],
      },
      serverSummaries: [
        {
          id: "server-1",
          code: "blackberry",
          slug: "blackberry",
          name: "Blackberry",
          assistantStatus: "current_corpus_ready",
          currentPrimaryLawCount: 1,
          enabledLawSourceCount: 1,
          totalLawSourceCount: 1,
          precedentTopicCount: 1,
          currentPrecedentCount: 1,
          warnings: [],
        },
      ],
      warnings: [],
    });
    vi.mocked(getInternalAIReviewPageContext).mockResolvedValue({
      reviewPreview: {
        queuedCount: 2,
        byPriority: {
          high: 1,
          medium: 1,
          low: 0,
        },
        analytics: {
          reviewedCount: 3,
          queuedCount: 2,
          totalTokens: 860,
          totalCostUsd: 0.033,
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
            server: {
              id: "server-1",
              code: "blackberry",
              name: "Blackberry",
            },
            caseChain: {
              rawInput: "я хачу абжаловать отказ",
              normalizedInput: "Я хочу обжаловать отказ.",
              normalizationModel: "gpt-5.4-nano",
              normalizationPromptVersion: "input_normalization_v1",
              normalizationChanged: true,
              normalizationComparisonResult: "orthography_fixed",
              retrievedSources: [
                {
                  lawId: "law-1",
                },
              ],
              finalOutputPreview: "Preview",
            },
            aiReviewerStatus: "completed",
            outputPreview: "Preview",
          },
        ],
      },
      accessViews: {
        superAdmin: {
          accessRole: "super_admin",
          visibility: "full_raw",
        },
        serverAdmin: {
          accessRole: "server_admin",
          visibility: "anonymized_statistics",
          queuedCount: 2,
          byPriority: {
            high: 1,
            medium: 1,
            low: 0,
          },
          analytics: {
            reviewedCount: 3,
            queuedCount: 2,
            totalTokens: 860,
            totalCostUsd: 0.033,
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
          },
        },
        tester: {
          accessRole: "tester",
          visibility: "sanitized_test_examples",
          examples: [
            {
              id: "ai-request-1",
              featureKey: "server_legal_assistant",
              priority: "high",
              rootCause: "normalization_issue",
              flags: ["normalization_changed_meaning"],
              reviewItems: ["Нормализация изменила смысл исходного ввода."],
              issueClusterKey: "cluster-1",
              availableChain: {
                hasRawInput: true,
                hasNormalizedInput: true,
                retrievedSourcesCount: 1,
                hasFinalOutput: true,
              },
            },
          ],
        },
      },
      behaviorRules: [
        {
          ruleId: "normalization_preserves_meaning_v1",
          title: "Нормализация не меняет смысл исходного ввода",
          status: "active",
          scope: ["server_legal_assistant"],
          rootCauses: ["normalization_issue"],
          summary: "Summary",
          sourceOfTruth: "step_17",
          acceptanceExpectation: "Acceptance",
        },
      ],
      confirmedIssues: [
        {
          issueId: "confirmed-normalization-meaning-shift-v1",
          title: "Нормализация не должна усиливать юридический смысл исходного ввода",
          status: "fix_in_progress",
          featureScope: ["server_legal_assistant"],
          rootCause: "normalization_issue",
          fixTarget: "normalization_guardrail",
          linkedRuleIds: ["normalization_preserves_meaning_v1"],
          issueFingerprintExample:
            "8f2e4a2fd0872f6cf1e556904ad3b5705d10f2a8651eb4b65ca5ef0a2d29ee10",
          issueClusterKeyExample: "3e0f8d6f6acfe1bc5c87",
          sourceOfTruth: "step_17_ai_quality_review",
          summary: "Summary",
          lifecycle: {
            statusHistory: [
              {
                status: "confirmed_followup_required",
                rationale: "Rationale 1",
              },
              {
                status: "fix_in_progress",
                rationale: "Rationale 2",
              },
            ],
            allowedTransitions: [
              {
                toStatus: "regression_ready",
                label: "Перевести в regression_ready",
                blockedBy: ["Blocked by 1"],
              },
            ],
            closureGuards: ["Guard 1"],
          },
          closureDecision: {
            state: "not_ready",
            summary: "Closure summary",
            requiredArtifacts: ["Artifact 1", "Artifact 2"],
            reopenPolicy: "Reopen policy",
          },
          fixInstructionSnapshot: {
            whatAIDidWrong: "Wrong",
            correctFutureBehavior: "Future",
            badExample: "Bad",
            goodExample: "Good",
            codexInstruction: "Codex",
            regressionExpectation: "Regression",
          },
          regressionFollowUp: {
            status: "test_required",
            artifact: "src/server/legal-core/input-normalization.test.ts",
            justification: null,
          },
        },
      ],
      confirmedIssueLifecycle: {
        total: 1,
        byStatus: {
          confirmed_followup_required: 0,
          fix_in_progress: 1,
          regression_ready: 0,
          closed: 0,
        },
        closableCount: 0,
        closedCount: 0,
      },
      fixInstructionTemplate: [
        {
          fieldKey: "what_ai_did_wrong",
          label: "Что AI сделал неправильно",
          description: "Описание",
          required: true,
        },
      ],
      regressionGateItems: [
        {
          itemKey: "issue_scope_confirmed",
          label: "Подтверждён реальный scope проблемы",
          description: "Описание",
          required: true,
        },
      ],
      regressionGateRules: [
        {
          ruleKey: "close_requires_test_or_justification",
          title: "Проблема не закрывается без теста или обоснования",
          summary: "Summary",
        },
      ],
      workflowNotes: ["Все правки идут через PR."],
    });
    vi.mocked(getInternalAccessRequestsContext).mockResolvedValue({
      pendingRequests: [
        {
          id: "request-1",
          account: {
            id: "account-1",
            email: "user@example.com",
            login: "user",
          },
          server: {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          },
          character: {
            id: "character-1",
            fullName: "Игорь Юристов",
            passportNumber: "AA-001",
          },
          requestType: "advocate_access",
          requestComment: "Нужен доступ",
          createdAt: "2026-04-24T10:00:00.000Z",
        },
      ],
      assignmentReviewCharacters: [
        {
          id: "character-1",
          account: {
            id: "account-1",
            email: "user@example.com",
            login: "user",
          },
          server: {
            id: "server-1",
            code: "blackberry",
            name: "Blackberry",
          },
          character: {
            id: "character-1",
            fullName: "Игорь Юристов",
            passportNumber: "AA-001",
          },
          roleKeys: ["citizen", "lawyer"],
          accessFlags: ["advocate"],
          createdAt: "2026-04-24T09:00:00.000Z",
        },
      ],
    });
  });

  it("рендерит /internal/laws как target corpus section внутри /internal contour", async () => {
    const html = renderToStaticMarkup(await InternalLawsPage({}));

    expect(html).toContain("Law Corpus");
    expect(html).toContain("Internal Source Management");
    expect(html).toContain('value="/internal/laws"');
  });

  it("рендерит /internal/precedents как target corpus section внутри /internal contour", async () => {
    const html = renderToStaticMarkup(await InternalPrecedentsPage({}));

    expect(html).toContain("Precedent Corpus Review");
    expect(html).toContain('value="/internal/precedents"');
  });

  it("сохраняет denied flow для /internal/laws", async () => {
    vi.mocked(getInternalAccessContext).mockResolvedValue({
      status: "denied",
      viewer: {
        accountId: "account-2",
        email: "user@example.com",
        login: "tester",
      },
    });

    const html = renderToStaticMarkup(await InternalLawsPage({}));

    expect(html).toContain("только super_admin");
    expect(html).toContain("tester");
  });

  it("рендерит /internal/security как target admin security section внутри /internal contour", async () => {
    const html = renderToStaticMarkup(await InternalSecurityPage({}));

    expect(html).toContain("Admin Account Security");
    expect(html).toContain('action="/internal/security"');
    expect(html).toContain("Super Admin");
  });

  it("рендерит /internal/access-requests как target review section внутри /internal contour", async () => {
    const html = renderToStaticMarkup(
      await InternalAccessRequestsPage({
        searchParams: Promise.resolve({
          status: "character-access-request-approved",
        }),
      }),
    );

    expect(html).toContain("Character Access Requests");
    expect(html).toContain("Заявка одобрена");
    expect(html).toContain("Одобрить");
    expect(html).toContain("Отклонить");
    expect(html).toContain("Текущие роли и access flags");
    expect(html).toContain("lawyer");
    expect(html).toContain("advocate");
  });

  it("рендерит /internal/health как real internal section внутри /internal contour", async () => {
    const html = renderToStaticMarkup(await InternalHealthPage());

    expect(html).toContain("Application Health");
    expect(html).toContain("Review Runtime Controls");
    expect(html).toContain("Queued AI Cases Preview");
    expect(html).toContain("normalization_issue");
    expect(html).toContain("full");
    expect(html).toContain("Today reviewer runs");
    expect(html).toContain("Corpus, Assistant and Runtime Summary");
    expect(html).toContain("Blackberry");
  });

  it("рендерит /internal/ai-review как internal workflow section внутри /internal contour", async () => {
    const html = renderToStaticMarkup(await InternalAIReviewPage());

    expect(html).toContain("AI Quality Review Workflow");
    expect(html).toContain("Access Scope Preview");
    expect(html).toContain("super_admin");
    expect(html).toContain("server_admin");
    expect(html).toContain("tester");
    expect(html).toContain("Tester View Preview");
    expect(html).toContain("sanitized_test_examples");
    expect(html).toContain("Queued Case Analytics");
    expect(html).toContain("AI Behavior Rules Registry");
    expect(html).toContain("Confirmed Issue Registry");
    expect(html).toContain("Lifecycle and transitions");
    expect(html).toContain("Allowed next transitions");
    expect(html).toContain("Closure guards");
    expect(html).toContain("Closure decision");
    expect(html).toContain("Closure summary");
    expect(html).toContain("Reopen policy");
    expect(html).toContain("Перевести в regression_ready");
    expect(html).toContain("Guard 1");
    expect(html).toContain("confirmed-normalization-meaning-shift-v1");
    expect(html).toContain("Fix instruction snapshot");
    expect(html).toContain("Regression follow-up");
    expect(html).toContain("Fix Instruction Template");
    expect(html).toContain("Regression Gate Checklist");
    expect(html).toContain("close_requires_test_or_justification");
    expect(html).toContain("normalization_issue");
    expect(html).toContain("server_legal_assistant_legal_core_v1");
    expect(html).toContain("law-version-1");
    expect(html).toContain("$0.033000");
    expect(html).toContain("Raw input");
    expect(html).toContain("Normalized input");
    expect(html).toContain("Retrieved sources");
    expect(html).toContain("Final output");
    expect(html).toContain("reviewer completed");
    expect(html).toContain("normalization_prompt");
  });
});
