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
          "## Краткий вывод\nОтвет.\n\n## Что прямо следует из норм\nНорма.\n\n## Вывод / интерпретация\nИнтерпретация.",
        sections: {
          summary: "Ответ.",
          normativeAnalysis: "Норма.",
          interpretation: "Интерпретация.",
        },
        metadata: {
          serverId: "server-1",
          serverCode: "blackberry",
          serverName: "Blackberry",
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-20T10:00:00.000Z",
            currentVersionIds: ["version-1"],
            corpusSnapshotHash: "snapshot-hash",
          },
          lawsUsed: [],
          references: [],
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
          "## Краткий вывод\nОтвет.\n\n## Что прямо следует из норм\nНорма.\n\n## Вывод / интерпретация\nИнтерпретация.",
        sections: {
          summary: "Ответ.",
          normativeAnalysis: "Норма.",
          interpretation: "Интерпретация.",
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
