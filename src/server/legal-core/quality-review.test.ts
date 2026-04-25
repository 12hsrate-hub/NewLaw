import { describe, expect, it } from "vitest";

import {
  attachDeterministicAIQualityReview,
  buildDeterministicAIQualityReviewSnapshot,
} from "@/server/legal-core/quality-review";

describe("ai quality review snapshot", () => {
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
          model: "gpt-5.4-nano",
          attemptedProxyKeys: ["primary"],
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
      model: "gpt-5.4-nano",
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
