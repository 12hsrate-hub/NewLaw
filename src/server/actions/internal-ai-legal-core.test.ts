import { describe, expect, it, vi } from "vitest";

import { runInternalAILegalCoreScenariosAction } from "@/server/actions/internal-ai-legal-core";

describe("internal ai legal core action", () => {
  it("запускает выбранный assistant scenario через legal-core pipeline и возвращает technical snapshot", async () => {
    const formData = new FormData();
    formData.set("serverSlug", "blackberry");
    formData.set("lawVersionSelection", "current_snapshot_only");
    formData.set("actorContext", "self");
    formData.set("answerMode", "detailed");
    formData.set("scenarioGroup", "general_legal_questions");
    formData.set("scenarioId", "general-mask-detention");
    formData.set("runTarget", "scenario");

    const result = await runInternalAILegalCoreScenariosAction(
      {
        status: "idle",
        errorMessage: null,
        fieldErrors: {},
        runSummary: null,
        results: [],
      },
      formData,
      {
        requireSuperAdminAccountContext: vi.fn().mockResolvedValue({
          account: {
            id: "account-1",
            isSuperAdmin: true,
          },
        }),
        getServerByCode: vi.fn().mockResolvedValue({
          id: "server-1",
          code: "blackberry",
          name: "Blackberry",
        }),
        generateServerLegalAssistantAnswer: vi.fn().mockResolvedValue({
          status: "answered",
          answerMarkdown:
            "## Краткий вывод\nОтвет.\n\n## Что прямо следует из норм закона\nНорма.\n\n## Что подтверждается судебными прецедентами\nПрецедент.\n\n## Вывод / интерпретация\nИнтерпретация.",
          sections: {
            summary: "Ответ.",
            normativeAnalysis: "Норма.",
            precedentAnalysis: "Прецедент.",
            interpretation: "Интерпретация.",
            sources: "Источник.",
          },
          metadata: {
            used_sources: [{ source_kind: "law", law_id: "law-1" }],
            total_tokens: 512,
            cost_usd: 0.019,
            latency_ms: 245,
            self_assessment: {
              answer_confidence: "high",
              insufficient_data: false,
            },
            review_status: {
              queue_for_future_ai_quality_review: false,
              future_review_priority: "low",
            },
          },
        }),
        runInternalDocumentTextImprovementScenario: vi.fn(),
        getAILegalCoreScenarioComparisons: vi.fn().mockResolvedValue(
          new Map([
            [
              "general-mask-detention",
              {
                scenarioId: "general-mask-detention",
                current: {
                  scenarioId: "general-mask-detention",
                  testRunId: "test-run-1",
                  createdAt: "2026-04-25T18:00:00.000Z",
                  featureKey: "server_legal_assistant",
                  status: "success",
                  rawInput: "можно ли задержать человека за маску",
                  normalizedInput: "Можно ли задержать человека за маску?",
                  outputPreview: "Ответ.",
                  usedSourcesCount: 1,
                  confidence: "high",
                  insufficientData: false,
                  tokens: 512,
                  costUsd: 0.019,
                  latencyMs: 245,
                  sentToReview: false,
                  reviewPriority: "low",
                },
                previous: null,
                changed: {
                  outputPreview: false,
                  confidence: false,
                  insufficientData: false,
                  sentToReview: false,
                },
                deltas: {
                  tokens: null,
                  costUsd: null,
                  latencyMs: null,
                  usedSourcesCount: null,
                },
              },
            ],
          ]),
        ),
        now: () => new Date("2026-04-25T18:00:00.000Z"),
        createId: () => "test-run-1",
      },
    );

    expect(result.status).toBe("success");
    expect(result.runSummary).toEqual({
      testRunId: "test-run-1",
      serverCode: "blackberry",
      serverName: "Blackberry",
      scenarioCount: 1,
      sentToReviewCount: 0,
      completedAt: "2026-04-25T18:00:00.000Z",
    });
    expect(result.results[0]).toMatchObject({
      scenarioId: "general-mask-detention",
      status: "answered",
      technical: {
        confidence: "high",
        insufficientData: false,
        tokens: 512,
        costUsd: 0.019,
        latencyMs: 245,
        sentToReview: false,
        reviewPriority: "low",
      },
    });
  });

  it("честно возвращает ошибку, если группа пока не имеет assistant scenarios", async () => {
    const formData = new FormData();
    formData.set("serverSlug", "blackberry");
    formData.set("lawVersionSelection", "current_snapshot_only");
    formData.set("actorContext", "general_question");
    formData.set("answerMode", "normal");
    formData.set("scenarioGroup", "document_text_improvement");
    formData.set("runTarget", "group");

    const result = await runInternalAILegalCoreScenariosAction(
      {
        status: "idle",
        errorMessage: null,
        fieldErrors: {},
        runSummary: null,
        results: [],
      },
      formData,
      {
        requireSuperAdminAccountContext: vi.fn().mockResolvedValue({
          account: {
            id: "account-1",
            isSuperAdmin: true,
          },
        }),
        getServerByCode: vi.fn().mockResolvedValue({
          id: "server-1",
          code: "blackberry",
          name: "Blackberry",
        }),
        generateServerLegalAssistantAnswer: vi.fn(),
        runInternalDocumentTextImprovementScenario: vi.fn(),
        getAILegalCoreScenarioComparisons: vi.fn().mockResolvedValue(new Map()),
        now: () => new Date("2026-04-25T18:00:00.000Z"),
        createId: () => "test-run-2",
      },
    );

    expect(result.status).toBe("success");
    expect(result.results[0]).toMatchObject({
      scenarioGroup: "document_text_improvement",
      targetFlow: "document_text_improvement",
      status: "error",
    });
  });

  it("запускает document_text_improvement scenario через internal rewrite runner", async () => {
    const formData = new FormData();
    formData.set("serverSlug", "blackberry");
    formData.set("lawVersionSelection", "current_snapshot_only");
    formData.set("actorContext", "self");
    formData.set("answerMode", "document_ready");
    formData.set("scenarioGroup", "document_text_improvement");
    formData.set("scenarioId", "rewrite-self-detained-mask");
    formData.set("runTarget", "scenario");

    const result = await runInternalAILegalCoreScenariosAction(
      {
        status: "idle",
        errorMessage: null,
        fieldErrors: {},
        runSummary: null,
        results: [],
      },
      formData,
      {
        requireSuperAdminAccountContext: vi.fn().mockResolvedValue({
          account: {
            id: "account-1",
            isSuperAdmin: true,
          },
        }),
        getServerByCode: vi.fn().mockResolvedValue({
          id: "server-1",
          code: "blackberry",
          name: "Blackberry",
        }),
        generateServerLegalAssistantAnswer: vi.fn(),
        runInternalDocumentTextImprovementScenario: vi.fn().mockResolvedValue({
          status: "rewritten",
          sourceText: "меня задержали за маску сотрудник ничего не объяснил потом посадил",
          suggestionText:
            "Меня задержали за ношение маски, при этом сотрудник не разъяснил основания задержания, после чего я был помещён под арест.",
          metadata: {
            used_sources: [{ source_kind: "law", law_id: "law-1" }],
            total_tokens: 410,
            cost_usd: 0.014,
            latency_ms: 180,
            self_assessment: {
              answer_confidence: "medium",
              insufficient_data: true,
            },
            review_status: {
              queue_for_future_ai_quality_review: true,
              future_review_priority: "medium",
            },
          },
        }),
        getAILegalCoreScenarioComparisons: vi.fn().mockResolvedValue(
          new Map([
            [
              "rewrite-self-detained-mask",
              {
                scenarioId: "rewrite-self-detained-mask",
                current: {
                  scenarioId: "rewrite-self-detained-mask",
                  testRunId: "test-run-3",
                  createdAt: "2026-04-25T18:05:00.000Z",
                  featureKey: "document_field_rewrite",
                  status: "success",
                  rawInput: "меня задержали за маску сотрудник ничего не объяснил потом посадил",
                  normalizedInput:
                    "Меня задержали за маску, сотрудник ничего не объяснил, потом посадил.",
                  outputPreview: "Меня задержали за ношение маски...",
                  usedSourcesCount: 1,
                  confidence: "medium",
                  insufficientData: true,
                  tokens: 410,
                  costUsd: 0.014,
                  latencyMs: 180,
                  sentToReview: true,
                  reviewPriority: "medium",
                },
                previous: {
                  scenarioId: "rewrite-self-detained-mask",
                  testRunId: "test-run-0",
                  createdAt: "2026-04-24T10:00:00.000Z",
                  featureKey: "document_field_rewrite",
                  status: "success",
                  rawInput: "меня задержали за маску сотрудник ничего не объяснил потом посадил",
                  normalizedInput:
                    "Меня задержали за маску, сотрудник ничего не объяснил, потом посадил.",
                  outputPreview: "Меня задержали за маску.",
                  usedSourcesCount: 1,
                  confidence: "low",
                  insufficientData: true,
                  tokens: 380,
                  costUsd: 0.012,
                  latencyMs: 160,
                  sentToReview: true,
                  reviewPriority: "high",
                },
                changed: {
                  outputPreview: true,
                  confidence: true,
                  insufficientData: false,
                  sentToReview: false,
                },
                deltas: {
                  tokens: 30,
                  costUsd: 0.002,
                  latencyMs: 20,
                  usedSourcesCount: 0,
                },
              },
            ],
          ]),
        ),
        now: () => new Date("2026-04-25T18:05:00.000Z"),
        createId: () => "test-run-3",
      },
    );

    expect(result.status).toBe("success");
    expect(result.results[0]).toMatchObject({
      scenarioId: "rewrite-self-detained-mask",
      targetFlow: "document_text_improvement",
      answer: null,
      rewrite: {
        suggestionText: expect.stringContaining("Меня задержали"),
      },
      technical: {
        confidence: "medium",
        insufficientData: true,
        tokens: 410,
        costUsd: 0.014,
        latencyMs: 180,
        sentToReview: true,
        reviewPriority: "medium",
      },
      comparison: {
        changed: {
          outputPreview: true,
        },
        previous: expect.objectContaining({
          testRunId: "test-run-0",
        }),
      },
    });
  });
});
