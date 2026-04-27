import { describe, expect, it } from "vitest";

import {
  attachDeterministicAIQualityReview,
  buildDeterministicAIQualityReviewSnapshot,
  buildDeterministicLawBasisReviewResult,
} from "@/server/legal-core/quality-review";
import type { AILegalCoreScenarioExpectationProfile } from "@/server/legal-core/test-scenarios-registry";

function createReviewPayload(input?: {
  directBasisStatus?: string;
  selectedNormRoles?: Array<Record<string, unknown>>;
  primaryBasisEligibility?: Array<Record<string, unknown>>;
  selectedCandidateDiagnostics?: Array<Record<string, unknown>>;
  companionRelationTypes?: Array<{ relation_types: string[] }>;
  includedArticleSegments?: Array<Record<string, unknown>>;
  bundleProjectionExcludedItems?: Array<Record<string, unknown>>;
  citationResolution?: Array<Record<string, unknown>>;
  citationUnresolvedCount?: number;
}) {
  return {
    direct_basis_status: input?.directBasisStatus ?? "direct_basis_present",
    selected_norm_roles: input?.selectedNormRoles ?? [
      {
        law_id: "law-1",
        law_version: "law-version-1",
        law_block_id: "law-block-1",
        law_family: "advocacy_law",
        norm_role: "primary_basis",
      },
    ],
    primary_basis_eligibility: input?.primaryBasisEligibility ?? [
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
    selected_candidate_diagnostics: input?.selectedCandidateDiagnostics ?? [
      {
        law_id: "law-1",
        law_version: "law-version-1",
        law_block_id: "law-block-1",
        article_number: "5",
        law_family: "advocacy_law",
        norm_role: "primary_basis",
        primary_basis_eligibility: "eligible",
        source_channel: "semantic",
        citation_resolution_status: null,
      },
    ],
    companion_relation_types: input?.companionRelationTypes ?? [],
    included_article_segments: input?.includedArticleSegments ?? [],
    bundle_projection_excluded_items: input?.bundleProjectionExcludedItems ?? [],
    missing_expected_companion: [],
    citation_resolution: input?.citationResolution ?? [],
    citation_unresolved_count: input?.citationUnresolvedCount ?? 0,
  };
}

describe("ai quality review snapshot", () => {
  it("ставит fail для missing_primary_basis_norm, когда ожидалась прямая база, но eligible primary отсутствует", () => {
    const expectationProfile = {
      expectedDirectBasisStatus: "direct_basis_present",
    } satisfies AILegalCoreScenarioExpectationProfile;
    const result = buildDeterministicLawBasisReviewResult({
      requestPayloadJson: createReviewPayload({
        directBasisStatus: "no_direct_basis",
        selectedNormRoles: [],
        primaryBasisEligibility: [],
        selectedCandidateDiagnostics: [],
      }),
      reviewContext: {
        expectationProfile,
      },
    });

    expect(result.overall_status).toBe("fail");
    expect(result.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_primary_basis_norm",
          severity: "fail",
        }),
        expect.objectContaining({
          code: "weak_direct_basis",
          severity: "fail",
        }),
      ]),
    );
  });

  it("ставит warn для partial basis и не считает это missing primary fail без жёсткого expected direct basis", () => {
    const result = buildDeterministicLawBasisReviewResult({
      requestPayloadJson: createReviewPayload({
        directBasisStatus: "partial_basis_only",
        primaryBasisEligibility: [
          {
            law_id: "law-1",
            law_version: "law-version-1",
            law_block_id: "law-block-1",
            primary_basis_eligibility: "weak",
            primary_basis_eligibility_reason: "weak_due_to_missing_preferred_family",
            ineligible_primary_basis_reasons: [],
            weak_primary_basis_reasons: ["weak_due_to_missing_preferred_family"],
          },
        ],
        selectedCandidateDiagnostics: [
          {
            law_id: "law-1",
            law_version: "law-version-1",
            law_block_id: "law-block-1",
            article_number: "34",
            law_family: "criminal_code",
            norm_role: "primary_basis",
            primary_basis_eligibility: "weak",
            source_channel: "semantic",
            citation_resolution_status: null,
          },
        ],
      }),
    });

    expect(result.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_primary_basis_norm",
          severity: "warn",
        }),
        expect.objectContaining({
          code: "weak_direct_basis",
          severity: "warn",
        }),
      ]),
    );
  });

  it("ловит law_family_mismatch при конфликте primary family с expected family", () => {
    const expectationProfile = {
      requiredLawFamilies: ["advocacy_law"],
    } satisfies AILegalCoreScenarioExpectationProfile;
    const result = buildDeterministicLawBasisReviewResult({
      requestPayloadJson: createReviewPayload({
        selectedNormRoles: [
          {
            law_id: "law-1",
            law_version: "law-version-1",
            law_block_id: "law-block-1",
            law_family: "criminal_code",
            norm_role: "primary_basis",
          },
        ],
        primaryBasisEligibility: [
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
        selectedCandidateDiagnostics: [
          {
            law_id: "law-1",
            law_version: "law-version-1",
            law_block_id: "law-block-1",
            article_number: "86",
            law_family: "criminal_code",
            norm_role: "primary_basis",
            primary_basis_eligibility: "eligible",
            source_channel: "semantic",
            citation_resolution_status: null,
          },
        ],
      }),
      reviewContext: {
        expectationProfile,
      },
    });

    expect(result.flags).toContainEqual(
      expect.objectContaining({
        code: "law_family_mismatch",
        severity: "fail",
      }),
    );
  });

  it("ловит sanction и exception как primary basis misuse", () => {
    const sanctionResult = buildDeterministicLawBasisReviewResult({
      requestPayloadJson: createReviewPayload({
        selectedNormRoles: [
          {
            law_id: "law-2",
            law_version: "law-version-1",
            law_block_id: "law-block-2",
            law_family: "criminal_code",
            norm_role: "primary_basis",
          },
        ],
        primaryBasisEligibility: [
          {
            law_id: "law-2",
            law_version: "law-version-1",
            law_block_id: "law-block-2",
            primary_basis_eligibility: "ineligible",
            primary_basis_eligibility_reason: "ineligible_due_to_sanction_only",
            ineligible_primary_basis_reasons: ["ineligible_due_to_sanction_only"],
            weak_primary_basis_reasons: [],
          },
        ],
        selectedCandidateDiagnostics: [
          {
            law_id: "law-2",
            law_version: "law-version-1",
            law_block_id: "law-block-2",
            article_number: "86",
            law_family: "criminal_code",
            norm_role: "primary_basis",
            primary_basis_eligibility: "ineligible",
            source_channel: "semantic",
            citation_resolution_status: null,
          },
        ],
      }),
    });
    const exceptionResult = buildDeterministicLawBasisReviewResult({
      requestPayloadJson: createReviewPayload({
        selectedNormRoles: [
          {
            law_id: "law-3",
            law_version: "law-version-1",
            law_block_id: "law-block-3",
            law_family: "criminal_code",
            norm_role: "primary_basis",
          },
        ],
        primaryBasisEligibility: [
          {
            law_id: "law-3",
            law_version: "law-version-1",
            law_block_id: "law-block-3",
            primary_basis_eligibility: "ineligible",
            primary_basis_eligibility_reason: "ineligible_due_to_exception_without_base",
            ineligible_primary_basis_reasons: ["ineligible_due_to_exception_without_base"],
            weak_primary_basis_reasons: [],
          },
        ],
        selectedCandidateDiagnostics: [
          {
            law_id: "law-3",
            law_version: "law-version-1",
            law_block_id: "law-block-3",
            article_number: "17",
            law_family: "criminal_code",
            norm_role: "primary_basis",
            primary_basis_eligibility: "ineligible",
            source_channel: "semantic",
            citation_resolution_status: null,
          },
        ],
      }),
    });

    expect(sanctionResult.flags).toContainEqual(
      expect.objectContaining({
        code: "sanction_or_exception_used_as_primary",
        severity: "fail",
      }),
    );
    expect(exceptionResult.flags).toContainEqual(
      expect.objectContaining({
        code: "sanction_or_exception_used_as_primary",
        severity: "fail",
      }),
    );
  });

  it("ставит fail для missing required companion только в activated scenario context", () => {
    const expectationProfile = {
      activateCompanionChecks: true,
      requiredCompanionRelations: ["procedure_companion"],
    } satisfies AILegalCoreScenarioExpectationProfile;
    const activated = buildDeterministicLawBasisReviewResult({
      requestPayloadJson: createReviewPayload(),
      reviewContext: {
        expectationProfile,
      },
    });
    const nonActivated = buildDeterministicLawBasisReviewResult({
      requestPayloadJson: createReviewPayload(),
      reviewContext: {
        expectationProfile: {
          requiredCompanionRelations: ["procedure_companion"],
        } satisfies AILegalCoreScenarioExpectationProfile,
      },
    });

    expect(activated.flags).toContainEqual(
      expect.objectContaining({
        code: "missing_required_companion_context",
        severity: "fail",
      }),
    );
    expect(nonActivated.flags).toContainEqual(
      expect.objectContaining({
        code: "missing_required_companion_context",
        severity: "pass",
      }),
    );
  });

  it("не считает duplicate_of_primary_excerpt missing companion, а помечает как warn partial coverage", () => {
    const expectationProfile = {
      activateCompanionChecks: true,
      requiredCompanionTargets: [
        {
          relationType: "procedure_companion",
          lawFamily: "advocacy_law",
          articleNumber: "5",
          partNumber: "2",
          marker: "ч. 2",
          allowCoveredByPrimaryExcerpt: true,
        },
      ],
    } satisfies AILegalCoreScenarioExpectationProfile;
    const result = buildDeterministicLawBasisReviewResult({
      requestPayloadJson: createReviewPayload({
        bundleProjectionExcludedItems: [
          {
            law_id: "law-1",
            items: [
              {
                marker: "ч. 2",
                part_number: "2",
                relation_type: "procedure_companion",
                reason_code: "duplicate_of_primary_excerpt",
              },
            ],
          },
        ],
      }),
      reviewContext: {
        expectationProfile,
      },
    });

    expect(result.flags).toContainEqual(
      expect.objectContaining({
        code: "missing_required_companion_context",
        severity: "warn",
      }),
    );
  });

  it("не создаёт fake primary при unresolved explicit citation и валит citation-target basis при misuse", () => {
    const safeResult = buildDeterministicLawBasisReviewResult({
      requestPayloadJson: createReviewPayload({
        directBasisStatus: "partial_basis_only",
        selectedNormRoles: [],
        primaryBasisEligibility: [],
        selectedCandidateDiagnostics: [],
        citationResolution: [
          {
            raw_citation: "999 УК",
            law_family: "criminal_code",
            article_number: "999",
            resolution_status: "unresolved",
          },
        ],
        citationUnresolvedCount: 1,
      }),
    });
    const fakePrimaryResult = buildDeterministicLawBasisReviewResult({
      requestPayloadJson: createReviewPayload({
        directBasisStatus: "direct_basis_present",
        selectedCandidateDiagnostics: [
          {
            law_id: "law-9",
            law_version: "law-version-1",
            law_block_id: "law-block-9",
            article_number: "999",
            law_family: "criminal_code",
            norm_role: "primary_basis",
            primary_basis_eligibility: "eligible",
            source_channel: "citation_target",
            citation_resolution_status: "unresolved",
          },
        ],
        citationResolution: [
          {
            raw_citation: "999 УК",
            law_family: "criminal_code",
            article_number: "999",
            resolution_status: "unresolved",
          },
        ],
        citationUnresolvedCount: 1,
      }),
    });

    expect(safeResult.flags).toContainEqual(
      expect.objectContaining({
        code: "unresolved_explicit_citation_used_as_basis",
        severity: "warn",
      }),
    );
    expect(fakePrimaryResult.flags).toContainEqual(
      expect.objectContaining({
        code: "unresolved_explicit_citation_used_as_basis",
        severity: "fail",
      }),
    );
  });

  it("встраивает structured law-basis review в общий deterministic snapshot", () => {
    const expectationProfile = {
      expectedDirectBasisStatus: "direct_basis_present",
      activateCompanionChecks: true,
      requiredCompanionRelations: ["procedure_companion"],
    } satisfies AILegalCoreScenarioExpectationProfile;
    const snapshot = buildDeterministicAIQualityReviewSnapshot({
      featureKey: "server_legal_assistant",
      requestPayloadJson: createReviewPayload({
        directBasisStatus: "partial_basis_only",
      }),
      responsePayloadJson: {
        future_review_priority: "low",
        future_review_flags: [],
        future_review_reason_codes: [],
        queue_for_future_ai_quality_review: false,
      },
      reviewContext: {
        expectationProfile,
      },
    }, {
      getRuntimeEnv: () => ({
        AI_REVIEW_ENABLED: true,
        AI_REVIEW_MODE: "log_only",
        AI_REVIEW_DAILY_REQUEST_LIMIT: undefined,
        AI_REVIEW_DAILY_COST_LIMIT_USD: undefined,
      }),
    });

    expect(snapshot.root_cause).toBe("law_basis_issue");
    expect(snapshot.layers.deterministic_checks.law_basis_review).toMatchObject({
      overall_status: "fail",
      summary: {
        fail: expect.any(Number),
        warn: expect.any(Number),
        pass: expect.any(Number),
      },
    });
    expect(snapshot.flags).toEqual(
      expect.arrayContaining([
        "missing_primary_basis_norm",
        "weak_direct_basis",
        "missing_required_companion_context",
      ]),
    );
  });

  it("помечает normalization_issue, когда нормализация добавляет факты и юридическую оценку", () => {
    const snapshot = buildDeterministicAIQualityReviewSnapshot({
      featureKey: "server_legal_assistant",
      requestPayloadJson: {
        prompt_version: "server_legal_assistant_legal_core_v1",
        raw_input: "меня увезли в дпс хз че делать",
        normalized_input:
          "Меня увезли в ДПС, что может свидетельствовать о нарушении статьи 5.",
        normalization_model: "gpt-5.4-nano",
        normalization_prompt_version: "legal_input_normalization_v1",
        normalization_changed: true,
        law_version_ids: ["law-version-1"],
        used_sources: [],
      },
      responsePayloadJson: {
        future_review_priority: "medium",
        future_review_flags: ["insufficient_data"],
        future_review_reason_codes: [],
        queue_for_future_ai_quality_review: true,
        answer_markdown_preview: "Ответ preview",
      },
      usageToday: {
        reviewer_attempt_count: 0,
        reviewer_cost_usd: 0,
      },
    }, {
      getRuntimeEnv: () => ({
        AI_REVIEW_ENABLED: true,
        AI_REVIEW_MODE: "full",
        AI_REVIEW_DAILY_REQUEST_LIMIT: undefined,
        AI_REVIEW_DAILY_COST_LIMIT_USD: undefined,
      }),
    });

    expect(snapshot.root_cause).toBe("normalization_issue");
    expect(snapshot.fix_target).toBe("normalization_guardrail");
    expect(snapshot.controls.mode).toBe("full");
    expect(snapshot.queue_for_super_admin).toBe(true);
    expect(snapshot.flags).toEqual(
      expect.arrayContaining([
        "normalization_added_fact",
        "normalization_overlegalized",
        "normalization_changed_meaning",
      ]),
    );
    expect(snapshot.case_chain.normalization_comparison_result).toBe("meaning_risk");
    expect(snapshot.layers.ai_reviewer.status).toBe("not_run");
  });

  it("строит law-basis fingerprint и сохраняет цепочку источников для спорного legal case", async () => {
    const augmented = await attachDeterministicAIQualityReview({
      featureKey: "document_field_rewrite_grounded",
      requestPayloadJson: {
        prompt_version: "document_field_rewrite_grounded_legal_core_v1",
        raw_input: "Сотрудник нарушил порядок рассмотрения жалобы.",
        normalized_input: "Сотрудник нарушил порядок рассмотрения жалобы.",
        normalization_model: "gpt-5.4-nano",
        normalization_prompt_version: "legal_input_normalization_v1",
        normalization_changed: false,
        law_version_ids: ["law-version-2"],
        used_sources: [
          {
            source_kind: "law",
            law_id: "law-legacy",
            law_version: "law-version-2",
          },
        ],
      },
      responsePayloadJson: {
        future_review_priority: "high",
        future_review_flags: ["elevated_answer_risk"],
        future_review_reason_codes: ["law_version_contract_violation"],
        queue_for_future_ai_quality_review: true,
        suggestionPreview: "Нарушение сформулировано.",
      },
    }, {
      getRuntimeEnv: () => ({
        AI_REVIEW_ENABLED: true,
        AI_REVIEW_MODE: "log_only",
        AI_REVIEW_DAILY_REQUEST_LIMIT: 100,
        AI_REVIEW_DAILY_COST_LIMIT_USD: 25,
      }),
      requestProxyCompletion: async () => {
        throw new Error("reviewer should not run in log_only mode");
      },
      getUsageSince: async () => ({
        reviewerAttemptCount: 3,
        reviewerCostUsd: 0.4,
      }),
      now: () => new Date("2026-04-25T12:00:00.000Z"),
    });

    const snapshot = augmented.ai_quality_review as ReturnType<
      typeof buildDeterministicAIQualityReviewSnapshot
    >;

    expect(snapshot.root_cause).toBe("law_basis_issue");
    expect(snapshot.controls).toMatchObject({
      enabled: true,
      mode: "log_only",
      daily_request_limit: 100,
      daily_cost_limit_usd: 25,
      usage_today: {
        reviewer_attempt_count: 3,
        reviewer_cost_usd: 0.4,
      },
      limits_status: "enforced_available",
    });
    expect(snapshot.queue_for_super_admin).toBe(false);
    expect(snapshot.issue_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.issue_cluster_key).toMatch(/^[a-f0-9]{20}$/);
    expect(snapshot.case_chain.retrieved_sources).toEqual([
      expect.objectContaining({
        source_kind: "law",
        law_id: "law-legacy",
      }),
    ]);
    expect(snapshot.review_items).toEqual(
      expect.arrayContaining(["Self-risk signal from legal core: law_version_contract_violation."]),
    );
  });

  it("добавляет ai reviewer output в full mode", async () => {
    const responsePayload = await attachDeterministicAIQualityReview(
      {
        featureKey: "server_legal_assistant",
        requestPayloadJson: {
          raw_input: "меня увезли в дпс хз че делать",
          normalized_input: "Меня увезли в ДПС, что делать по закону.",
          prompt_version: "server_legal_assistant_legal_core_v1",
          normalization_model: "gpt-5.4-nano",
          normalization_prompt_version: "legal_input_normalization_v1",
          normalization_changed: true,
          law_version_ids: ["law-version-1"],
          used_sources: [],
        },
        responsePayloadJson: {
          future_review_priority: "medium",
          future_review_flags: ["elevated_answer_risk"],
          future_review_reason_codes: ["insufficient_grounding"],
          queue_for_future_ai_quality_review: true,
          answer_markdown_preview: "Ответ preview",
        },
      },
      {
        getRuntimeEnv: () => ({
          AI_REVIEW_ENABLED: true,
          AI_REVIEW_MODE: "full",
          AI_REVIEW_DAILY_REQUEST_LIMIT: undefined,
          AI_REVIEW_DAILY_COST_LIMIT_USD: undefined,
        }),
        getUsageSince: async () => ({
          reviewerAttemptCount: 0,
          reviewerCostUsd: 0,
        }),
        now: () => new Date("2026-04-25T12:00:00.000Z"),
        requestProxyCompletion: async () => ({
          status: "success" as const,
          content: JSON.stringify({
            quality_score: 31,
            risk_level: "high",
            confidence: "medium",
            flags: ["reviewer_detected_generation_risk"],
            review_items: ["Reviewer считает, что ответ вышел слишком смелым."],
            root_cause: "generation_issue",
            input_quality: "medium",
          }),
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4-mini",
          attemptedProxyKeys: ["primary"],
          attempts: [],
          responsePayloadJson: {
            choices: [],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 20,
              total_tokens: 120,
            },
          } as never,
        }),
      },
    );

    const snapshot = responsePayload.ai_quality_review as ReturnType<
      typeof buildDeterministicAIQualityReviewSnapshot
    >;

    expect(snapshot.risk_level).toBe("high");
    expect(snapshot.root_cause).toBe("generation_issue");
    expect(snapshot.flags).toEqual(
      expect.arrayContaining(["reviewer_detected_generation_risk"]),
    );
    expect(snapshot.layers.ai_reviewer).toMatchObject({
      status: "completed",
      model: "gpt-5.4-mini",
      prompt_version: "ai_quality_reviewer_v1",
    });
  });

  it("не добавляет ai_quality_review, когда review mode выключен", async () => {
    const responsePayload = await attachDeterministicAIQualityReview(
      {
        featureKey: "server_legal_assistant",
        requestPayloadJson: {
          raw_input: "тест",
          normalized_input: "тест",
        },
        responsePayloadJson: {
          answer_markdown_preview: "Ответ",
        },
      },
      {
        getRuntimeEnv: () => ({
          AI_REVIEW_ENABLED: false,
          AI_REVIEW_MODE: "off",
          AI_REVIEW_DAILY_REQUEST_LIMIT: undefined,
          AI_REVIEW_DAILY_COST_LIMIT_USD: undefined,
        }),
        requestProxyCompletion: async () => {
          throw new Error("reviewer should not run when disabled");
        },
        getUsageSince: async () => ({
          reviewerAttemptCount: 0,
          reviewerCostUsd: 0,
        }),
        now: () => new Date("2026-04-25T12:00:00.000Z"),
      },
    );

    expect(responsePayload).toEqual({
      answer_markdown_preview: "Ответ",
    });
  });

  it("не запускает ai reviewer, когда дневной request limit уже достигнут", async () => {
    const responsePayload = await attachDeterministicAIQualityReview(
      {
        featureKey: "server_legal_assistant",
        requestPayloadJson: {
          raw_input: "тестовый ввод",
          normalized_input: "Тестовый ввод.",
        },
        responsePayloadJson: {
          queue_for_future_ai_quality_review: true,
          future_review_priority: "high",
          future_review_flags: ["elevated_answer_risk"],
          future_review_reason_codes: [],
          answer_markdown_preview: "Ответ",
        },
      },
      {
        getRuntimeEnv: () => ({
          AI_REVIEW_ENABLED: true,
          AI_REVIEW_MODE: "full",
          AI_REVIEW_DAILY_REQUEST_LIMIT: 2,
          AI_REVIEW_DAILY_COST_LIMIT_USD: undefined,
        }),
        getUsageSince: async () => ({
          reviewerAttemptCount: 2,
          reviewerCostUsd: 0.2,
        }),
        now: () => new Date("2026-04-25T12:00:00.000Z"),
        requestProxyCompletion: async () => {
          throw new Error("reviewer should not run after limit reached");
        },
      },
    );

    const snapshot = responsePayload.ai_quality_review as ReturnType<
      typeof buildDeterministicAIQualityReviewSnapshot
    >;

    expect(snapshot.controls.request_limit_reached).toBe(true);
    expect(snapshot.controls.limits_status).toBe("daily_limit_reached");
    expect(snapshot.layers.ai_reviewer).toMatchObject({
      status: "not_run",
      reason: "daily_limit_reached",
    });
  });
});
