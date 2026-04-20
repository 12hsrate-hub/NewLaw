import { describe, expect, it, vi } from "vitest";

import { answerLegalAssistantQuestion } from "@/server/legal-assistant/flow";

describe("legal assistant flow", () => {
  it("не даёт гостю задать второй вопрос, но возвращает старый ответ", async () => {
    const result = await answerLegalAssistantQuestion(
      {
        serverSlug: "blackberry",
        question: "Можно ли задать второй вопрос?",
      },
      {
        getServerByCode: vi.fn().mockResolvedValue({
          id: "server-1",
          code: "blackberry",
          name: "Blackberry",
        }),
        getAssistantViewerContext: vi.fn().mockResolvedValue({
          user: null,
          account: null,
          isAuthenticated: false,
        }),
        getAssistantGuestUsageState: vi.fn().mockResolvedValue({
          session: {
            id: "guest-1",
          },
          hasGuestQuestionAvailable: false,
          savedAnswer: {
            questionText: "Первый вопрос",
            answerMarkdown:
              "## Краткий вывод\nОтвет.\n\n## Что прямо следует из норм\nНорма.\n\n## Вывод / интерпретация\nИнтерпретация.",
            answerMetadataJson: {
              serverId: "server-1",
            },
            answerStatus: "answered",
            lastAnsweredAt: new Date("2026-04-20T10:00:00.000Z"),
          },
        }),
        storeAssistantGuestAnswer: vi.fn(),
        generateServerLegalAssistantAnswer: vi.fn(),
      },
    );

    expect(result.status).toBe("guest-limit-reached");
    if (result.status === "guest-limit-reached") {
      expect(result.savedAnswer?.question).toBe("Первый вопрос");
      expect(result.requiresAuthCta).toBe(true);
    }
  });

  it("после входа гостевой лимит больше не блокирует пользователя", async () => {
    const generateServerLegalAssistantAnswer = vi.fn().mockResolvedValue({
      status: "answered",
      answerMarkdown:
        "## Краткий вывод\nОтвет.\n\n## Что прямо следует из норм\nНорма.\n\n## Вывод / интерпретация\nИнтерпретация.",
      sections: {
        summary: "Ответ.",
        normativeAnalysis: "Норма.",
        interpretation: "Интерпретация.",
      },
      metadata: {
        serverId: "server-1",
      },
    });

    const result = await answerLegalAssistantQuestion(
      {
        serverSlug: "blackberry",
        question: "Что с договором?",
      },
      {
        getServerByCode: vi.fn().mockResolvedValue({
          id: "server-1",
          code: "blackberry",
          name: "Blackberry",
        }),
        getAssistantViewerContext: vi.fn().mockResolvedValue({
          user: {
            id: "user-1",
            email: "user@example.com",
          },
          account: {
            id: "account-1",
            email: "user@example.com",
            login: "lawyer_user",
          },
          isAuthenticated: true,
        }),
        getAssistantGuestUsageState: vi.fn(),
        storeAssistantGuestAnswer: vi.fn(),
        generateServerLegalAssistantAnswer,
      },
    );

    expect(generateServerLegalAssistantAnswer).toHaveBeenCalled();
    expect(result.status).toBe("answered");
  });
});
