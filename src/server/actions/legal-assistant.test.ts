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
