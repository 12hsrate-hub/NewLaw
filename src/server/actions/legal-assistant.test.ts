import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/legal-assistant/flow", () => ({
  answerLegalAssistantQuestion: vi.fn(),
}));

import { answerLegalAssistantQuestion } from "@/server/legal-assistant/flow";
import { submitAssistantQuestionAction } from "@/server/actions/legal-assistant";

describe("submit assistant question action", () => {
  it("возвращает ответ из server legal assistant flow", async () => {
    vi.mocked(answerLegalAssistantQuestion).mockResolvedValue({
      status: "answered",
      server: {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
      answer: {
        question: "Что с договором?",
        answerMarkdown:
          "## Краткий вывод\nОтвет.\n\n## Что прямо следует из норм закона\nНорма.\n\n## Что подтверждается судебными прецедентами\nПрецедент.\n\n## Вывод / интерпретация\nИнтерпретация.",
        sections: {
          summary: "Ответ.",
          normativeAnalysis: "Норма.",
          precedentAnalysis: "Прецедент.",
          interpretation: "Интерпретация.",
          sources: "Источник 1.",
        },
        metadata: {
          serverId: "server-1",
          serverCode: "blackberry",
          serverName: "Blackberry",
          lawCorpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-20T10:00:00.000Z",
            currentVersionIds: ["version-1"],
            corpusSnapshotHash: "law-snapshot-hash",
          },
          precedentCorpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-20T10:00:00.000Z",
            currentVersionIds: [],
            corpusSnapshotHash: "precedent-snapshot-hash",
          },
          combinedRetrievalRevision: {
            serverId: "server-1",
            generatedAt: "2026-04-20T10:00:00.000Z",
            lawCorpusSnapshotHash: "law-snapshot-hash",
            precedentCorpusSnapshotHash: "precedent-snapshot-hash",
            combinedCorpusSnapshotHash: "snapshot-hash",
            lawCurrentVersionIds: ["version-1"],
            precedentCurrentVersionIds: [],
          },
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-20T10:00:00.000Z",
            lawCorpusSnapshotHash: "law-snapshot-hash",
            precedentCorpusSnapshotHash: "precedent-snapshot-hash",
            combinedCorpusSnapshotHash: "snapshot-hash",
            lawCurrentVersionIds: ["version-1"],
            precedentCurrentVersionIds: [],
          },
          lawsUsed: [],
          precedentsUsed: [],
          references: [],
          intent: "situation_analysis",
          actor_context: "general_question",
          response_mode: "normal",
          prompt_version: "server_legal_assistant_legal_core_v1",
          raw_input: "Что с договором?",
          normalized_input: "Что с договором?",
          normalization_model: "gpt-5.4-nano",
          normalization_prompt_version: "legal_input_normalization_v1",
          normalization_changed: false,
          legal_query_plan: {
            normalized_input: "Что с договором?",
            intent: "situation_analysis",
            actor_context: "general_question",
            response_mode: "normal",
            server_id: "server-1",
            law_version: "current_snapshot_only",
            question_scope: "general_question",
            legal_anchors: [],
            required_law_families: [],
            preferred_norm_roles: ["primary_basis", "procedure"],
            forbidden_scope_markers: [],
            expanded_query: "Что с договором?",
          },
          selected_norm_roles: [],
          direct_basis_status: "no_direct_basis",
          applicability_diagnostics: [],
          grounding_diagnostics: {
            flags: ["missing_primary_basis_norm", "weak_direct_basis"],
            direct_basis_status: "no_direct_basis",
            selected_norm_count: 0,
            primary_basis_norm_count: 0,
            selected_law_families: [],
          },
          retrieval_query: "Что с договором?",
          law_version_ids: ["version-1"],
          law_version_contract: {
            server_id: "server-1",
            law_corpus_snapshot_hash: "law-snapshot-hash",
            law_version_ids: ["version-1"],
            contract_mode: "current_snapshot_only",
            found_norms_outside_current_snapshot: [],
            context_norms_outside_current_snapshot: [],
            used_norms_outside_current_snapshot: [],
            is_current_snapshot_consistent: true,
          },
          used_sources: [],
          source_ledger: {
            server_id: "server-1",
            law_version_ids: ["version-1"],
            found_norms: [],
            context_norms: [],
            used_norms: [],
          },
          generation_source_budget: 4,
          generation_sources_count: 0,
          generation_excerpt_budget: 650,
          generation_context_chars: 0,
          generation_context_trimmed: false,
          answer_mode_effective_budget: {
            response_mode: "normal",
            max_total_sources: 4,
            max_excerpt_chars_per_source: 650,
            max_total_context_chars: 2400,
          },
          latency_ms: 0,
          prompt_tokens: null,
          completion_tokens: null,
          total_tokens: null,
          cost_usd: null,
          review_status: {
            queue_for_future_ai_quality_review: false,
            future_review_priority: "low",
            future_review_flags: [],
            future_review_reason_codes: [],
          },
          test_run_context: null,
          self_assessment: {
            answer_confidence: "medium",
            insufficient_data: false,
            answer_risk_level: "low",
          },
        },
      },
      viewer: {
        isAuthenticated: true,
      },
      requiresAuthCta: false,
    });

    const formData = new FormData();
    formData.set("serverSlug", "blackberry");
    formData.set("question", "Что с договором?");
    formData.set("actorContext", "self");

    const result = await submitAssistantQuestionAction(
      {
        status: "idle",
        errorMessage: null,
        fieldErrors: {},
        answer: null,
        requiresAuthCta: false,
      },
      formData,
    );

    expect(result.status).toBe("answered");
    expect(result.answer?.sections.summary).toBe("Ответ.");
    expect(answerLegalAssistantQuestion).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      question: "Что с договором?",
      actorContext: "self",
    });
  });

  it("показывает CTA, если гость уже исчерпал вопрос", async () => {
    vi.mocked(answerLegalAssistantQuestion).mockResolvedValue({
      status: "guest-limit-reached",
      server: {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
      savedAnswer: {
        question: "Первый вопрос",
        answerMarkdown:
          "## Краткий вывод\nОтвет.\n\n## Что прямо следует из норм закона\nНорма.\n\n## Что подтверждается судебными прецедентами\nПрецедент.\n\n## Вывод / интерпретация\nИнтерпретация.",
        sections: {
          summary: "Ответ.",
          normativeAnalysis: "Норма.",
          precedentAnalysis: "Прецедент.",
          interpretation: "Интерпретация.",
          sources: "Источник 1.",
        },
        metadata: null,
        status: "answered",
      },
      requiresAuthCta: true,
    });

    const formData = new FormData();
    formData.set("serverSlug", "blackberry");
    formData.set("question", "Второй вопрос");

    const result = await submitAssistantQuestionAction(
      {
        status: "idle",
        errorMessage: null,
        fieldErrors: {},
        answer: null,
        requiresAuthCta: false,
      },
      formData,
    );

    expect(result.status).toBe("guest_limit_reached");
    expect(result.requiresAuthCta).toBe(true);
    expect(result.answer?.question).toBe("Первый вопрос");
  });
});
