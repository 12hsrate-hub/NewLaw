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
        syncAITestScenarios: vi.fn().mockResolvedValue(undefined),
        createAITestRun: vi.fn().mockResolvedValue(undefined),
        completeAITestRun: vi.fn().mockResolvedValue(undefined),
        createAITestRunResult: vi.fn().mockResolvedValue(undefined),
        findLatestAIRequestByTestRunContext: vi.fn().mockResolvedValue({
          id: "ai-request-1",
          requestPayloadJson: {
            normalized_input: "Можно ли задержать человека за маску?",
            legal_query_plan: {
              normalized_input: "Можно ли задержать человека за маску?",
            },
            selected_norm_roles: [
              {
                law_id: "law-1",
                law_version: "law-version-1",
                law_block_id: "law-block-1",
                law_family: "administrative_code",
                norm_role: "primary_basis",
                applicability_score: 10,
              },
            ],
            applicability_diagnostics: [
              {
                law_id: "law-1",
                law_version: "law-version-1",
                law_block_id: "law-block-1",
                primary_basis_eligibility: "eligible",
                primary_basis_eligibility_reason: null,
                ineligible_primary_basis_reasons: [],
                weak_primary_basis_reasons: [],
              },
            ],
            grounding_diagnostics: {
              direct_basis_status: "direct_basis_present",
            },
            direct_basis_status: "direct_basis_present",
          },
          responsePayloadJson: {
            used_sources: [
              {
                source_kind: "law",
                law_id: "law-1",
                law_name: "Административный кодекс",
                article_number: "18",
              },
            ],
            stage_usage: {
              normalization: {
                model: "gpt-5.4-nano",
                prompt_tokens: 10,
                completion_tokens: 3,
                total_tokens: 13,
                estimated_cost_usd: 0.00001,
                latency_ms: 120,
              },
              generation: {
                model: "gpt-5.4-mini",
                prompt_tokens: 120,
                completion_tokens: 45,
                total_tokens: 165,
                estimated_cost_usd: 0.003,
                latency_ms: 245,
              },
            },
          },
        }),
        getAILegalCoreScenarioComparisons: vi.fn().mockResolvedValue(
          new Map([
            [
              "general-mask-detention",
              {
                scenarioId: "general-mask-detention",
                current: {
                  scenarioId: "general-mask-detention",
                  testRunId: "test-run-1",
                  serverId: "server-1",
                  serverCode: "blackberry",
                  lawVersionSelection: "current_snapshot_only",
                  lawVersionIds: [],
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
    expect(result.scenario_group_summary).toEqual({
      total_scenarios: 1,
      passed_scenarios: 1,
      failed_scenarios: 0,
      unresolved_scenarios: 0,
      groups: [
        {
          scenario_group: "mask_and_identity",
          total_scenarios: 1,
          passed_scenarios: 1,
          failed_scenarios: 0,
          unresolved_scenarios: 0,
        },
      ],
    });
    expect(result.cost_summary).toEqual({
      total_tokens: 512,
      average_tokens: 512,
      total_cost: 0.019,
      average_latency: 245,
    });
    expect(result.direct_basis_summary).toEqual({
      counts_by_direct_basis_status: {
        direct_basis_present: 1,
        partial_basis_only: 0,
        no_direct_basis: 0,
        unknown: 0,
      },
      scenarios_with_missing_direct_basis: [],
      scenarios_with_weak_only_basis: [],
    });
    expect(result.results[0]).toMatchObject({
      scenarioId: "general-mask-detention",
      status: "answered",
      passed_expectations: expect.arrayContaining([
        expect.objectContaining({
          key: "requiredLawFamilies",
          status: "passed",
        }),
      ]),
      failed_expectations: [],
      expectation_summary: {
        passed: 7,
        failed: 0,
        not_evaluable: 0,
        future_reserved: 1,
      },
      scenario_group_summary: {
        scenario_group: "mask_and_identity",
        scenario_variant: "general_short",
        semantic_cluster: "mask_detention",
      },
      cost_summary: {
        tokens: 512,
        input_tokens: 130,
        output_tokens: 48,
        cost: 0.019,
        latency: 245,
      },
      direct_basis_summary: {
        direct_basis_status: "direct_basis_present",
        primary_basis_count: 1,
        eligible_primary_basis_count: 1,
        selected_law_families: ["administrative_code"],
      },
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
        syncAITestScenarios: vi.fn().mockResolvedValue(undefined),
        createAITestRun: vi.fn().mockResolvedValue(undefined),
        completeAITestRun: vi.fn().mockResolvedValue(undefined),
        createAITestRunResult: vi.fn().mockResolvedValue(undefined),
        findLatestAIRequestByTestRunContext: vi.fn().mockResolvedValue(null),
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
      expectation_summary: {
        passed: 0,
        failed: 0,
        not_evaluable: 0,
        future_reserved: 0,
      },
    });
  });

  it("в core_only режиме возвращает legal-core snapshot без final answer generation", async () => {
    const formData = new FormData();
    formData.set("serverSlug", "blackberry");
    formData.set("lawVersionSelection", "current_snapshot_only");
    formData.set("actorContext", "general_question");
    formData.set("answerMode", "normal");
    formData.set("executionMode", "core_only");
    formData.set("scenarioGroup", "general_legal_questions");
    formData.set("scenarioId", "general-mask-detention");
    formData.set("runTarget", "scenario");

    const generateServerLegalAssistantAnswer = vi.fn().mockResolvedValue({
      status: "core_only",
      message: null,
      metadata: {
        used_sources: [{ source_kind: "law", law_id: "law-1" }],
        self_assessment: {
          answer_confidence: "medium",
          insufficient_data: false,
        },
        review_status: {
          queue_for_future_ai_quality_review: false,
          future_review_priority: "low",
        },
      },
    });

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
        generateServerLegalAssistantAnswer,
        runInternalDocumentTextImprovementScenario: vi.fn(),
        syncAITestScenarios: vi.fn().mockResolvedValue(undefined),
        createAITestRun: vi.fn().mockResolvedValue(undefined),
        completeAITestRun: vi.fn().mockResolvedValue(undefined),
        createAITestRunResult: vi.fn().mockResolvedValue(undefined),
        findLatestAIRequestByTestRunContext: vi.fn().mockResolvedValue({
          id: "ai-request-core-only-1",
          requestPayloadJson: {
            normalized_input: "Можно ли задержать человека за маску?",
            legal_query_plan: {
              normalized_input: "Можно ли задержать человека за маску?",
            },
            selected_norm_roles: [
              {
                law_id: "law-1",
                law_version: "law-version-1",
                law_block_id: "law-block-1",
                law_family: "administrative_code",
                norm_role: "primary_basis",
                applicability_score: 10,
              },
            ],
            applicability_diagnostics: [
              {
                law_id: "law-1",
                law_version: "law-version-1",
                law_block_id: "law-block-1",
                primary_basis_eligibility: "eligible",
                primary_basis_eligibility_reason: null,
                ineligible_primary_basis_reasons: [],
                weak_primary_basis_reasons: [],
              },
            ],
            grounding_diagnostics: {
              direct_basis_status: "direct_basis_present",
            },
            direct_basis_status: "direct_basis_present",
          },
          responsePayloadJson: {
            used_sources: [{ source_kind: "law", law_id: "law-1" }],
            stage_usage: {
              normalization: {
                model: "gpt-5.4-nano",
                prompt_tokens: 10,
                completion_tokens: 3,
                total_tokens: 13,
                estimated_cost_usd: 0.00001,
                latency_ms: 120,
              },
            },
          },
        }),
        getAILegalCoreScenarioComparisons: vi.fn().mockResolvedValue(new Map()),
        now: () => new Date("2026-04-26T12:00:00.000Z"),
        createId: () => "test-run-core-only-1",
      },
    );

    expect(result.status).toBe("success");
    expect(generateServerLegalAssistantAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        internalExecutionMode: "core_only",
      }),
    );
    expect(result.results[0]).toMatchObject({
      scenarioId: "general-mask-detention",
      status: "core_only",
      executionMode: "core_only",
      answer: null,
      technical: {
        confidence: "medium",
      },
      passed_expectations: expect.arrayContaining([
        expect.objectContaining({
          key: "requiredLawFamilies",
          status: "passed",
        }),
      ]),
      failed_expectations: [],
      expectation_summary: {
        passed: 5,
        failed: 0,
        not_evaluable: 2,
        future_reserved: 1,
      },
      scenario_group_summary: {
        scenario_group: "mask_and_identity",
        scenario_variant: "general_short",
        semantic_cluster: "mask_detention",
      },
      cost_summary: {
        tokens: 13,
        input_tokens: 10,
        output_tokens: 3,
        cost: 0.00001,
        latency: 120,
      },
      direct_basis_summary: {
        direct_basis_status: "direct_basis_present",
        primary_basis_count: 1,
        eligible_primary_basis_count: 1,
        selected_law_families: ["administrative_code"],
      },
      coreSnapshot: {
        normalized_input: "Можно ли задержать человека за маску?",
        legal_query_plan: {
          normalized_input: "Можно ли задержать человека за маску?",
        },
        selected_norm_roles: [
          expect.objectContaining({
            law_id: "law-1",
          }),
        ],
        primary_basis_eligibility: [
          expect.objectContaining({
            primary_basis_eligibility: "eligible",
          }),
        ],
        direct_basis_status: "direct_basis_present",
        used_sources: [
          expect.objectContaining({
            source_kind: "law",
          }),
        ],
        diagnostics: {
          applicability_diagnostics: expect.any(Array),
          grounding_diagnostics: expect.objectContaining({
            direct_basis_status: "direct_basis_present",
          }),
        },
        stage_usage: {
          normalization: expect.objectContaining({
            model: "gpt-5.4-nano",
          }),
        },
      },
    });
  });

  it("в compact_generation режиме прокидывает internal compact mode без изменения public surface", async () => {
    const formData = new FormData();
    formData.set("serverSlug", "blackberry");
    formData.set("lawVersionSelection", "current_snapshot_only");
    formData.set("actorContext", "general_question");
    formData.set("answerMode", "normal");
    formData.set("executionMode", "compact_generation");
    formData.set("scenarioGroup", "general_legal_questions");
    formData.set("scenarioId", "general-no-bodycam");
    formData.set("runTarget", "scenario");

    const generateServerLegalAssistantAnswer = vi.fn().mockResolvedValue({
      status: "answered",
      answerMarkdown:
        "## Краткий вывод\nКраткий вывод.\n\n## Что прямо следует из норм закона\nПункт.\n\n## Что подтверждается судебными прецедентами\nНе использовались.\n\n## Вывод / интерпретация\nЧто делать: действовать по процедуре.",
      sections: {
        summary: "Краткий вывод.",
        normativeAnalysis: "Пункт.",
        precedentAnalysis: "Не использовались.",
        interpretation: "Что делать: действовать по процедуре.",
        sources: "АК 18.",
      },
      metadata: {
        used_sources: [{ source_kind: "law", law_id: "law-1" }],
        total_tokens: 180,
        cost_usd: 0.004,
        latency_ms: 140,
        self_assessment: {
          answer_confidence: "medium",
          insufficient_data: false,
        },
        review_status: {
          queue_for_future_ai_quality_review: false,
          future_review_priority: "low",
        },
      },
    });

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
        generateServerLegalAssistantAnswer,
        runInternalDocumentTextImprovementScenario: vi.fn(),
        syncAITestScenarios: vi.fn().mockResolvedValue(undefined),
        createAITestRun: vi.fn().mockResolvedValue(undefined),
        completeAITestRun: vi.fn().mockResolvedValue(undefined),
        createAITestRunResult: vi.fn().mockResolvedValue(undefined),
        findLatestAIRequestByTestRunContext: vi.fn().mockResolvedValue({
          id: "ai-request-compact-1",
          requestPayloadJson: {
            normalized_input: "Если сотрудник не вел бодикам это нарушение?",
            legal_query_plan: {
              normalized_input: "Если сотрудник не вел бодикам это нарушение?",
            },
            selected_norm_roles: [
              {
                law_id: "law-2",
                law_version: "law-version-2",
                law_block_id: "law-block-2",
                law_family: "government_code",
                norm_role: "primary_basis",
                applicability_score: 6,
              },
            ],
            applicability_diagnostics: [
              {
                law_id: "law-2",
                law_version: "law-version-2",
                law_block_id: "law-block-2",
                primary_basis_eligibility: "weak",
                primary_basis_eligibility_reason: "government_code_general_scope",
                ineligible_primary_basis_reasons: [],
                weak_primary_basis_reasons: ["government_code_general_scope"],
              },
            ],
            grounding_diagnostics: {
              direct_basis_status: "partial_basis_only",
            },
            direct_basis_status: "partial_basis_only",
          },
          responsePayloadJson: {
            used_sources: [
              {
                source_kind: "law",
                law_id: "law-2",
                law_name: "Закон об ОГП",
                article_number: "4",
              },
            ],
            stage_usage: {
              normalization: {
                model: "gpt-5.4-nano",
                prompt_tokens: 8,
                completion_tokens: 2,
                total_tokens: 10,
                estimated_cost_usd: 0.00001,
                latency_ms: 100,
              },
              generation: {
                model: "gpt-5.4-mini",
                prompt_tokens: 70,
                completion_tokens: 20,
                total_tokens: 90,
                estimated_cost_usd: 0.0015,
                latency_ms: 140,
              },
            },
          },
        }),
        getAILegalCoreScenarioComparisons: vi.fn().mockResolvedValue(new Map()),
        now: () => new Date("2026-04-26T12:05:00.000Z"),
        createId: () => "test-run-compact-1",
      },
    );

    expect(result.status).toBe("success");
    expect(generateServerLegalAssistantAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        internalExecutionMode: "compact_generation",
      }),
    );
    expect(result.results[0]).toMatchObject({
      status: "answered",
      executionMode: "compact_generation",
      passed_expectations: expect.arrayContaining([
        expect.objectContaining({
          key: "expectedDirectBasisStatus",
          status: "passed",
        }),
      ]),
      failed_expectations: [
        expect.objectContaining({
          key: "forbiddenPrimaryBasis",
          status: "failed",
        }),
      ],
      expectation_summary: {
        passed: 4,
        failed: 1,
        not_evaluable: 0,
        future_reserved: 1,
      },
      scenario_group_summary: {
        scenario_group: "bodycam_and_recording",
        scenario_variant: "general_short",
        semantic_cluster: "bodycam_missing_recording",
      },
      technical: {
        tokens: 180,
        costUsd: 0.004,
        latencyMs: 140,
      },
      cost_summary: {
        tokens: 180,
        input_tokens: 78,
        output_tokens: 22,
        cost: 0.004,
        latency: 140,
      },
      direct_basis_summary: {
        direct_basis_status: "partial_basis_only",
        primary_basis_count: 1,
        eligible_primary_basis_count: 0,
        selected_law_families: ["government_code"],
      },
    });
  });

  it("в compact_generation режиме сохраняет coreSnapshot и expectation diagnostics при malformed proxy config unavailable", async () => {
    const formData = new FormData();
    formData.set("serverSlug", "blackberry");
    formData.set("lawVersionSelection", "current_snapshot_only");
    formData.set("actorContext", "general_question");
    formData.set("answerMode", "normal");
    formData.set("executionMode", "compact_generation");
    formData.set("scenarioGroup", "general_legal_questions");
    formData.set("scenarioId", "general-mask-detention");
    formData.set("runTarget", "scenario");

    const createAITestRunResult = vi.fn().mockResolvedValue(undefined);
    const generateServerLegalAssistantAnswer = vi.fn().mockResolvedValue({
      status: "unavailable",
      message: "Сервис юридического помощника сейчас недоступен. Попробуй задать вопрос позже.",
      metadata: {
        used_sources: [{ source_kind: "law", law_id: "law-1" }],
        total_tokens: null,
        cost_usd: null,
        latency_ms: 0,
        self_assessment: {
          answer_confidence: "low",
          insufficient_data: true,
        },
        review_status: {
          queue_for_future_ai_quality_review: true,
          future_review_priority: "high",
        },
      },
    });

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
        generateServerLegalAssistantAnswer,
        runInternalDocumentTextImprovementScenario: vi.fn(),
        syncAITestScenarios: vi.fn().mockResolvedValue(undefined),
        createAITestRun: vi.fn().mockResolvedValue(undefined),
        completeAITestRun: vi.fn().mockResolvedValue(undefined),
        createAITestRunResult,
        findLatestAIRequestByTestRunContext: vi.fn().mockResolvedValue({
          id: "ai-request-compact-unavailable-1",
          requestPayloadJson: {
            normalized_input: "Можно ли задержать человека за маску?",
            legal_query_plan: {
              normalized_input: "Можно ли задержать человека за маску?",
            },
            selected_norm_roles: [
              {
                law_id: "law-1",
                law_version: "law-version-1",
                law_block_id: "law-block-1",
                law_family: "administrative_code",
                norm_role: "primary_basis",
                applicability_score: 10,
              },
            ],
            applicability_diagnostics: [
              {
                law_id: "law-1",
                law_version: "law-version-1",
                law_block_id: "law-block-1",
                primary_basis_eligibility: "eligible",
                primary_basis_eligibility_reason: null,
                ineligible_primary_basis_reasons: [],
                weak_primary_basis_reasons: [],
              },
            ],
            grounding_diagnostics: {
              direct_basis_status: "direct_basis_present",
            },
            direct_basis_status: "direct_basis_present",
          },
          responsePayloadJson: {
            used_sources: [{ source_kind: "law", law_id: "law-1" }],
            stage_usage: {
              normalization: {
                model: "gpt-5.4-nano",
                prompt_tokens: 10,
                completion_tokens: 3,
                total_tokens: 13,
                estimated_cost_usd: 0.00001,
                latency_ms: 120,
              },
              generation: {
                model: null,
                prompt_tokens: null,
                completion_tokens: null,
                total_tokens: null,
                estimated_cost_usd: null,
                latency_ms: 0,
              },
            },
          },
        }),
        getAILegalCoreScenarioComparisons: vi.fn().mockResolvedValue(new Map()),
        now: () => new Date("2026-04-26T12:10:00.000Z"),
        createId: () => "test-run-compact-unavailable-1",
      },
    );

    expect(result.status).toBe("success");
    expect(generateServerLegalAssistantAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        internalExecutionMode: "compact_generation",
      }),
    );
    expect(createAITestRunResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unavailable",
      }),
    );
    expect(result.results[0]).toMatchObject({
      scenarioId: "general-mask-detention",
      status: "unavailable",
      executionMode: "compact_generation",
      message: "Сервис юридического помощника сейчас недоступен. Попробуй задать вопрос позже.",
      passed_expectations: expect.arrayContaining([
        expect.objectContaining({
          key: "requiredLawFamilies",
          status: "passed",
        }),
      ]),
      failed_expectations: [],
      expectation_summary: {
        passed: 6,
        failed: 0,
        not_evaluable: 1,
        future_reserved: 1,
      },
      scenario_group_summary: {
        scenario_group: "mask_and_identity",
        scenario_variant: "general_short",
        semantic_cluster: "mask_detention",
      },
      cost_summary: {
        tokens: 13,
        input_tokens: 10,
        output_tokens: 3,
        cost: 0.00001,
        latency: 0,
      },
      direct_basis_summary: {
        direct_basis_status: "direct_basis_present",
        primary_basis_count: 1,
        eligible_primary_basis_count: 1,
        selected_law_families: ["administrative_code"],
      },
      coreSnapshot: {
        normalized_input: "Можно ли задержать человека за маску?",
        legal_query_plan: {
          normalized_input: "Можно ли задержать человека за маску?",
        },
        selected_norm_roles: [
          expect.objectContaining({
            law_id: "law-1",
          }),
        ],
        primary_basis_eligibility: [
          expect.objectContaining({
            primary_basis_eligibility: "eligible",
          }),
        ],
        direct_basis_status: "direct_basis_present",
        diagnostics: {
          applicability_diagnostics: expect.any(Array),
          grounding_diagnostics: expect.objectContaining({
            direct_basis_status: "direct_basis_present",
          }),
        },
        stage_usage: {
          normalization: expect.objectContaining({
            model: "gpt-5.4-nano",
          }),
          generation: expect.objectContaining({
            model: null,
          }),
        },
      },
    });
    expect(result.scenario_group_summary).toEqual({
      total_scenarios: 1,
      passed_scenarios: 0,
      failed_scenarios: 0,
      unresolved_scenarios: 1,
      groups: [
        {
          scenario_group: "mask_and_identity",
          total_scenarios: 1,
          passed_scenarios: 0,
          failed_scenarios: 0,
          unresolved_scenarios: 1,
        },
      ],
    });
    expect(result.direct_basis_summary).toEqual({
      counts_by_direct_basis_status: {
        direct_basis_present: 1,
        partial_basis_only: 0,
        no_direct_basis: 0,
        unknown: 0,
      },
      scenarios_with_missing_direct_basis: [],
      scenarios_with_weak_only_basis: [],
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
        syncAITestScenarios: vi.fn().mockResolvedValue(undefined),
        createAITestRun: vi.fn().mockResolvedValue(undefined),
        completeAITestRun: vi.fn().mockResolvedValue(undefined),
        createAITestRunResult: vi.fn().mockResolvedValue(undefined),
        findLatestAIRequestByTestRunContext: vi.fn().mockResolvedValue({
          id: "ai-request-3",
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
                  serverId: "server-1",
                  serverCode: "blackberry",
                  lawVersionSelection: "current_snapshot_only",
                  lawVersionIds: [],
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
                  serverId: "server-1",
                  serverCode: "blackberry",
                  lawVersionSelection: "current_snapshot_only",
                  lawVersionIds: [],
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
      expectation_summary: {
        passed: 0,
        failed: 0,
        not_evaluable: 0,
        future_reserved: 0,
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
