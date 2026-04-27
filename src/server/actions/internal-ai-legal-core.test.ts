import { describe, expect, it, vi } from "vitest";

import { runInternalAILegalCoreScenariosAction } from "@/server/actions/internal-ai-legal-core";

describe("internal ai legal core action", () => {
  it("не превращает law_basis_review fail в automatic suite failure, если expectation_summary остаётся passed", async () => {
    const formData = new FormData();
    formData.set("serverSlug", "blackberry");
    formData.set("lawVersionSelection", "current_snapshot_only");
    formData.set("actorContext", "self");
    formData.set("answerMode", "normal");
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
            total_tokens: 256,
            cost_usd: 0.009,
            latency_ms: 180,
            self_assessment: {
              answer_confidence: "medium",
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
          id: "ai-request-review-calibration-1",
          requestPayloadJson: {
            normalized_input: "Можно ли задержать человека за маску?",
            legal_query_plan: {
              normalized_input: "Можно ли задержать человека за маску?",
              primaryLegalIssueType: "duty_question",
              secondaryLegalIssueTypes: ["procedure_question"],
              legalIssueConfidence: "medium",
              legalIssueDiagnostics: {
                legal_issue_type: "duty_question",
                legal_issue_secondary_types: ["procedure_question"],
                legal_issue_confidence: "medium",
                legal_issue_signals: [],
                legal_issue_unclear_reason: null,
              },
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
              legal_issue_type: "duty_question",
              legal_issue_secondary_types: ["procedure_question"],
              legal_issue_confidence: "medium",
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
            ai_quality_review: {
              layers: {
                deterministic_checks: {
                  law_basis_review: {
                    overall_status: "fail",
                    flags: [
                      {
                        code: "law_family_mismatch",
                        severity: "fail",
                      },
                    ],
                    summary: {
                      pass: 0,
                      warn: 0,
                      fail: 1,
                    },
                  },
                },
              },
            },
            stage_usage: {
              generation: {
                model: "gpt-5.4-mini",
                prompt_tokens: 100,
                completion_tokens: 30,
                total_tokens: 130,
                estimated_cost_usd: 0.002,
                latency_ms: 180,
              },
            },
          },
        }),
        getAILegalCoreScenarioComparisons: vi.fn().mockResolvedValue(new Map()),
        now: () => new Date("2026-04-27T09:00:00.000Z"),
        createId: () => "test-run-review-calibration-1",
      },
    );

    expect(result.status).toBe("success");
    expect(result.results[0]).toMatchObject({
      expectation_summary: {
        failed: 0,
      },
      law_basis_review: {
        overall_status: "fail",
        failed_flag_codes: ["law_family_mismatch"],
      },
      law_basis_gate_simulation: {
        would_fail_gate: true,
        candidate_fail_flag_codes: ["law_family_mismatch"],
        warn_only_flag_codes: [],
        diagnostics_only_flag_codes: [],
        status: "would_fail",
      },
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
    expect(result.law_basis_review_summary).toEqual({
      counts_by_law_basis_review_status: {
        pass: 0,
        warn: 0,
        fail: 1,
        unknown: 0,
      },
      scenarios_with_failed_law_basis_review: ["general-mask-detention"],
      top_law_basis_review_flags: [
        {
          code: "law_family_mismatch",
          count: 1,
        },
      ],
    });
    expect(result.law_basis_gate_simulation_summary).toEqual({
      scenarios_that_would_fail_law_basis_gate: ["general-mask-detention"],
      law_basis_gate_simulation_counts: {
        pass: 0,
        would_fail: 1,
      },
      top_candidate_gate_flag_codes: [
        {
          code: "law_family_mismatch",
          count: 1,
        },
      ],
      groups_with_candidate_gate_fails: [
        {
          scenario_group: "mask_and_identity",
          count: 1,
        },
      ],
    });
  });

  it("раскладывает candidate, warn_only и diagnostics_only flags в non-blocking gate simulation без изменения suite result", async () => {
    const formData = new FormData();
    formData.set("serverSlug", "blackberry");
    formData.set("lawVersionSelection", "current_snapshot_only");
    formData.set("actorContext", "general_question");
    formData.set("answerMode", "normal");
    formData.set("executionMode", "compact_generation");
    formData.set("scenarioGroup", "general_legal_questions");
    formData.set("scenarioId", "general-no-bodycam");
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
        }),
        runInternalDocumentTextImprovementScenario: vi.fn(),
        syncAITestScenarios: vi.fn().mockResolvedValue(undefined),
        createAITestRun: vi.fn().mockResolvedValue(undefined),
        completeAITestRun: vi.fn().mockResolvedValue(undefined),
        createAITestRunResult: vi.fn().mockResolvedValue(undefined),
        findLatestAIRequestByTestRunContext: vi.fn().mockResolvedValue({
          id: "ai-request-gate-simulation-1",
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
            ai_quality_review: {
              layers: {
                deterministic_checks: {
                  law_basis_review: {
                    overall_status: "fail",
                    flags: [
                      {
                        code: "law_family_mismatch",
                        severity: "fail",
                      },
                      {
                        code: "weak_direct_basis",
                        severity: "warn",
                      },
                      {
                        code: "unresolved_explicit_citation_used_as_basis",
                        severity: "fail",
                      },
                    ],
                    summary: {
                      pass: 0,
                      warn: 1,
                      fail: 2,
                    },
                  },
                },
              },
            },
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
        now: () => new Date("2026-04-27T11:00:00.000Z"),
        createId: () => "test-run-gate-simulation-1",
      },
    );

    expect(result.status).toBe("success");
    expect(result.results[0]).toMatchObject({
      expectation_summary: {
        failed: 1,
      },
      law_basis_gate_simulation: {
        would_fail_gate: true,
        candidate_fail_flag_codes: ["law_family_mismatch"],
        warn_only_flag_codes: ["weak_direct_basis"],
        diagnostics_only_flag_codes: ["unresolved_explicit_citation_used_as_basis"],
        status: "would_fail",
      },
    });
    expect(result.scenario_group_summary).toEqual({
      total_scenarios: 1,
      passed_scenarios: 0,
      failed_scenarios: 1,
      unresolved_scenarios: 0,
      groups: [
        {
          scenario_group: "bodycam_and_recording",
          total_scenarios: 1,
          passed_scenarios: 0,
          failed_scenarios: 1,
          unresolved_scenarios: 0,
        },
      ],
    });
    expect(result.law_basis_gate_simulation_summary).toEqual({
      scenarios_that_would_fail_law_basis_gate: ["general-no-bodycam"],
      law_basis_gate_simulation_counts: {
        pass: 0,
        would_fail: 1,
      },
      top_candidate_gate_flag_codes: [
        {
          code: "law_family_mismatch",
          count: 1,
        },
      ],
      groups_with_candidate_gate_fails: [
        {
          scenario_group: "bodycam_and_recording",
          count: 1,
        },
      ],
    });
  });

  it("не переводит warn_only и diagnostics_only flags в would_fail gate", async () => {
    const formData = new FormData();
    formData.set("serverSlug", "blackberry");
    formData.set("lawVersionSelection", "current_snapshot_only");
    formData.set("actorContext", "general_question");
    formData.set("answerMode", "normal");
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
            total_tokens: 220,
            cost_usd: 0.005,
            latency_ms: 150,
            self_assessment: {
              answer_confidence: "medium",
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
          id: "ai-request-gate-simulation-2",
          requestPayloadJson: {
            normalized_input: "Можно ли задержать человека за маску?",
            direct_basis_status: "partial_basis_only",
            selected_norm_roles: [],
            applicability_diagnostics: [],
            grounding_diagnostics: {
              direct_basis_status: "partial_basis_only",
            },
          },
          responsePayloadJson: {
            used_sources: [],
            ai_quality_review: {
              layers: {
                deterministic_checks: {
                  law_basis_review: {
                    overall_status: "warn",
                    flags: [
                      {
                        code: "weak_direct_basis",
                        severity: "warn",
                      },
                      {
                        code: "missing_required_companion_context",
                        severity: "warn",
                      },
                      {
                        code: "unresolved_explicit_citation_used_as_basis",
                        severity: "fail",
                      },
                    ],
                    summary: {
                      pass: 0,
                      warn: 2,
                      fail: 1,
                    },
                  },
                },
              },
            },
            stage_usage: {
              generation: {
                model: "gpt-5.4-mini",
                prompt_tokens: 90,
                completion_tokens: 25,
                total_tokens: 115,
                estimated_cost_usd: 0.002,
                latency_ms: 150,
              },
            },
          },
        }),
        getAILegalCoreScenarioComparisons: vi.fn().mockResolvedValue(new Map()),
        now: () => new Date("2026-04-27T11:05:00.000Z"),
        createId: () => "test-run-gate-simulation-2",
      },
    );

    expect(result.status).toBe("success");
    expect(result.results[0]).toMatchObject({
      law_basis_gate_simulation: {
        would_fail_gate: false,
        candidate_fail_flag_codes: [],
        warn_only_flag_codes: ["weak_direct_basis", "missing_required_companion_context"],
        diagnostics_only_flag_codes: ["unresolved_explicit_citation_used_as_basis"],
        status: "pass",
      },
    });
    expect(result.law_basis_gate_simulation_summary).toEqual({
      scenarios_that_would_fail_law_basis_gate: [],
      law_basis_gate_simulation_counts: {
        pass: 1,
        would_fail: 0,
      },
      top_candidate_gate_flag_codes: [],
      groups_with_candidate_gate_fails: [],
    });
  });

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
              primaryLegalIssueType: "duty_question",
              secondaryLegalIssueTypes: ["procedure_question"],
              legalIssueConfidence: "medium",
              legalIssueDiagnostics: {
                legal_issue_type: "duty_question",
                legal_issue_secondary_types: ["procedure_question"],
                legal_issue_confidence: "medium",
                legal_issue_signals: [],
                legal_issue_unclear_reason: null,
              },
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
              legal_issue_type: "duty_question",
              legal_issue_secondary_types: ["procedure_question"],
              legal_issue_confidence: "medium",
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
            ai_quality_review: {
              layers: {
                deterministic_checks: {
                  law_basis_review: {
                    overall_status: "pass",
                    flags: [
                      {
                        code: "missing_primary_basis_norm",
                        severity: "pass",
                      },
                      {
                        code: "law_family_mismatch",
                        severity: "pass",
                      },
                    ],
                    summary: {
                      pass: 2,
                      warn: 0,
                      fail: 0,
                    },
                  },
                },
              },
            },
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
    expect(result.law_basis_review_summary).toEqual({
      counts_by_law_basis_review_status: {
        pass: 1,
        warn: 0,
        fail: 0,
        unknown: 0,
      },
      scenarios_with_failed_law_basis_review: [],
      top_law_basis_review_flags: [],
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
      law_basis_review: {
        overall_status: "pass",
        fail_count: 0,
        warn_count: 0,
        pass_count: 2,
        flag_codes: ["missing_primary_basis_norm", "law_family_mismatch"],
        failed_flag_codes: [],
        warn_flag_codes: [],
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
              primaryLegalIssueType: "duty_question",
              secondaryLegalIssueTypes: ["procedure_question"],
              legalIssueConfidence: "medium",
              legalIssueDiagnostics: {
                legal_issue_type: "duty_question",
                legal_issue_secondary_types: ["procedure_question"],
                legal_issue_confidence: "medium",
                legal_issue_signals: [],
                legal_issue_unclear_reason: null,
              },
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
              legal_issue_type: "duty_question",
              legal_issue_secondary_types: ["procedure_question"],
              legal_issue_confidence: "medium",
            },
            direct_basis_status: "direct_basis_present",
          },
          responsePayloadJson: {
            used_sources: [{ source_kind: "law", law_id: "law-1" }],
            ai_quality_review: {
              layers: {
                deterministic_checks: {
                  law_basis_review: {
                    overall_status: "warn",
                    flags: [
                      {
                        code: "weak_direct_basis",
                        severity: "warn",
                      },
                    ],
                    summary: {
                      pass: 1,
                      warn: 1,
                      fail: 0,
                    },
                  },
                },
              },
            },
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
      law_basis_review: {
        overall_status: "warn",
        fail_count: 0,
        warn_count: 1,
        pass_count: 1,
        flag_codes: ["weak_direct_basis"],
        failed_flag_codes: [],
        warn_flag_codes: ["weak_direct_basis"],
      },
      coreSnapshot: {
        normalized_input: "Можно ли задержать человека за маску?",
        legal_query_plan: {
          normalized_input: "Можно ли задержать человека за маску?",
          primaryLegalIssueType: "duty_question",
          secondaryLegalIssueTypes: ["procedure_question"],
          legalIssueConfidence: "medium",
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
            legal_issue_type: "duty_question",
            legal_issue_secondary_types: ["procedure_question"],
            legal_issue_confidence: "medium",
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
              primaryLegalIssueType: "evidence_question",
              secondaryLegalIssueTypes: ["duty_question"],
              legalIssueConfidence: "medium",
              legalIssueDiagnostics: {
                legal_issue_type: "evidence_question",
                legal_issue_secondary_types: ["duty_question"],
                legal_issue_confidence: "medium",
                legal_issue_signals: [],
                legal_issue_unclear_reason: null,
              },
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
              legal_issue_type: "evidence_question",
              legal_issue_secondary_types: ["duty_question"],
              legal_issue_confidence: "medium",
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
            ai_quality_review: {
              layers: {
                deterministic_checks: {
                  law_basis_review: {
                    overall_status: "fail",
                    flags: [
                      {
                        code: "law_family_mismatch",
                        severity: "fail",
                      },
                      {
                        code: "weak_direct_basis",
                        severity: "warn",
                      },
                    ],
                    summary: {
                      pass: 0,
                      warn: 1,
                      fail: 1,
                    },
                  },
                },
              },
            },
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
      law_basis_review: {
        overall_status: "fail",
        fail_count: 1,
        warn_count: 1,
        pass_count: 0,
        flag_codes: ["law_family_mismatch", "weak_direct_basis"],
        failed_flag_codes: ["law_family_mismatch"],
        warn_flag_codes: ["weak_direct_basis"],
      },
    });
    expect(result.law_basis_review_summary).toEqual({
      counts_by_law_basis_review_status: {
        pass: 0,
        warn: 0,
        fail: 1,
        unknown: 0,
      },
      scenarios_with_failed_law_basis_review: ["general-no-bodycam"],
      top_law_basis_review_flags: [
        {
          code: "law_family_mismatch",
          count: 1,
        },
        {
          code: "weak_direct_basis",
          count: 1,
        },
      ],
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
              primaryLegalIssueType: "duty_question",
              secondaryLegalIssueTypes: ["procedure_question"],
              legalIssueConfidence: "medium",
              legalIssueDiagnostics: {
                legal_issue_type: "duty_question",
                legal_issue_secondary_types: ["procedure_question"],
                legal_issue_confidence: "medium",
                legal_issue_signals: [],
                legal_issue_unclear_reason: null,
              },
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
              legal_issue_type: "duty_question",
              legal_issue_secondary_types: ["procedure_question"],
              legal_issue_confidence: "medium",
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
          primaryLegalIssueType: "duty_question",
          secondaryLegalIssueTypes: ["procedure_question"],
          legalIssueConfidence: "medium",
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
            legal_issue_type: "duty_question",
            legal_issue_secondary_types: ["procedure_question"],
            legal_issue_confidence: "medium",
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
