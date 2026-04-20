import { describe, expect, it, vi } from "vitest";

import { generateServerLegalAssistantAnswer } from "@/server/legal-assistant/answer-pipeline";

describe("answer pipeline", () => {
  it("честно возвращает fallback, если нормы не найдены", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn();
    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Есть ли норма про неизвестный институт?",
      },
      {
        searchCurrentLawCorpus: vi.fn().mockResolvedValue({
          query: "Есть ли норма про неизвестный институт?",
          serverId: "server-1",
          resultCount: 0,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-20T10:00:00.000Z",
            currentVersionIds: ["version-1"],
            corpusSnapshotHash: "snapshot-hash",
          },
          results: [],
        }),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-20T10:00:00.000Z"),
      },
    );

    expect(result.status).toBe("no_norms");
    if (result.status === "no_norms") {
      expect(result.answerMarkdown).toContain("Краткий вывод");
      expect(result.answerMarkdown).toContain("Использованные нормы / источники");
      expect(result.metadata.references).toEqual([]);
    }
    expect(requestAssistantProxyCompletion).not.toHaveBeenCalled();
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        requestPayloadJson: expect.objectContaining({
          branch: "no_norms",
        }),
      }),
    );
  });

  it("возвращает grounded metadata и article blocks в успешном ответе", async () => {
    const createAIRequest = vi.fn();
    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Нужен ли письменный договор?",
        accountId: "account-1",
      },
      {
        searchCurrentLawCorpus: vi.fn().mockResolvedValue({
          query: "Нужен ли письменный договор?",
          serverId: "server-1",
          resultCount: 1,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-20T10:00:00.000Z",
            currentVersionIds: ["version-1"],
            corpusSnapshotHash: "snapshot-hash",
          },
          results: [
            {
              serverId: "server-1",
              lawId: "law-1",
              lawKey: "civil_code",
              lawTitle: "Гражданский кодекс",
              lawVersionId: "version-1",
              lawVersionStatus: "current",
              lawBlockId: "block-1",
              blockType: "article",
              blockOrder: 1,
              articleNumberNormalized: "1",
              snippet: "Статья 1. Договор заключается письменно.",
              blockText: "Статья 1. Договор заключается письменно.",
              sourceTopicUrl: "https://forum.gta5rp.com/threads/100001/",
              sourcePosts: [
                {
                  postExternalId: "post-1",
                  postUrl: "https://forum.gta5rp.com/posts/1001",
                  postOrder: 1,
                },
              ],
              metadata: {
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
                corpusSnapshotHash: "snapshot-hash",
              },
            },
          ],
        }),
        requestAssistantProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content:
            "## Краткий вывод\nДа, договор должен быть письменным.\n\n## Что прямо следует из норм\nСтатья 1 прямо требует письменную форму.\n\n## Вывод / интерпретация\nЭто означает, что устной формы недостаточно, если нет специального исключения в корпусе.",
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4",
          responsePayloadJson: {
            choices: [],
          },
        }),
        createAIRequest,
        now: () => new Date("2026-04-20T10:00:00.000Z"),
      },
    );

    expect(result.status).toBe("answered");
    if (result.status === "answered") {
      expect(result.sections.normativeAnalysis).toContain("Статья 1");
      expect(result.sections.sources).toContain("Гражданский кодекс");
      expect(result.metadata.references).toHaveLength(1);
      expect(result.metadata.references[0].blockType).toBe("article");
      expect(result.answerMarkdown).toContain("## Использованные нормы / источники");
    }
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "server_legal_assistant",
        accountId: "account-1",
        status: "success",
        requestPayloadJson: expect.objectContaining({
          retrievalResults: expect.any(Array),
        }),
      }),
    );
  });

  it("возвращает безопасный unavailable state, если AI proxy недоступен", async () => {
    const createAIRequest = vi.fn();
    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Нужен ли письменный договор?",
      },
      {
        searchCurrentLawCorpus: vi.fn().mockResolvedValue({
          query: "Нужен ли письменный договор?",
          serverId: "server-1",
          resultCount: 1,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-20T10:00:00.000Z",
            currentVersionIds: ["version-1"],
            corpusSnapshotHash: "snapshot-hash",
          },
          results: [
            {
              serverId: "server-1",
              lawId: "law-1",
              lawKey: "civil_code",
              lawTitle: "Гражданский кодекс",
              lawVersionId: "version-1",
              lawVersionStatus: "current",
              lawBlockId: "block-1",
              blockType: "article",
              blockOrder: 1,
              articleNumberNormalized: "1",
              snippet: "Статья 1. Договор заключается письменно.",
              blockText: "Статья 1. Договор заключается письменно.",
              sourceTopicUrl: "https://forum.gta5rp.com/threads/100001/",
              sourcePosts: [],
              metadata: {
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
                corpusSnapshotHash: "snapshot-hash",
              },
            },
          ],
        }),
        requestAssistantProxyCompletion: vi.fn().mockResolvedValue({
          status: "unavailable",
          message: "AI proxy не настроен.",
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4",
        }),
        createAIRequest,
        now: () => new Date("2026-04-20T10:00:00.000Z"),
      },
    );

    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.message).toContain("недоступен");
    }
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unavailable",
      }),
    );
  });

  it("логирует no_corpus без вызова модели", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn();

    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Нужен ли письменный договор?",
      },
      {
        searchCurrentLawCorpus: vi.fn().mockResolvedValue({
          query: "Нужен ли письменный договор?",
          serverId: "server-1",
          resultCount: 0,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-20T10:00:00.000Z",
            currentVersionIds: [],
            corpusSnapshotHash: "snapshot-hash",
          },
          results: [],
        }),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-20T10:00:00.000Z"),
      },
    );

    expect(result.status).toBe("no_corpus");
    expect(requestAssistantProxyCompletion).not.toHaveBeenCalled();
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unavailable",
        requestPayloadJson: expect.objectContaining({
          branch: "no_corpus",
        }),
      }),
    );
  });

  it("нормализует ответ модели в структурированный markdown даже если секции неполные", async () => {
    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Нужен ли письменный договор?",
      },
      {
        searchCurrentLawCorpus: vi.fn().mockResolvedValue({
          query: "Нужен ли письменный договор?",
          serverId: "server-1",
          resultCount: 1,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-20T10:00:00.000Z",
            currentVersionIds: ["version-1"],
            corpusSnapshotHash: "snapshot-hash",
          },
          results: [
            {
              serverId: "server-1",
              lawId: "law-1",
              lawKey: "civil_code",
              lawTitle: "Гражданский кодекс",
              lawVersionId: "version-1",
              lawVersionStatus: "current",
              lawBlockId: "block-1",
              blockType: "article",
              blockOrder: 1,
              articleNumberNormalized: "1",
              snippet: "Статья 1. Договор заключается письменно.",
              blockText: "Статья 1. Договор заключается письменно.",
              sourceTopicUrl: "https://forum.gta5rp.com/threads/100001/",
              sourcePosts: [],
              metadata: {
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
                corpusSnapshotHash: "snapshot-hash",
              },
            },
          ],
        }),
        requestAssistantProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content: "## Краткий вывод\nДа.\n\n## Вывод / интерпретация\nИнтерпретация.",
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4",
          responsePayloadJson: {
            choices: [],
          },
        }),
        createAIRequest: vi.fn(),
        now: () => new Date("2026-04-20T10:00:00.000Z"),
      },
    );

    expect(result.status).toBe("answered");
    if (result.status === "answered") {
      expect(result.answerMarkdown).toContain("## Краткий вывод");
      expect(result.answerMarkdown).toContain("## Что прямо следует из норм");
      expect(result.answerMarkdown).toContain("## Вывод / интерпретация");
      expect(result.answerMarkdown).toContain("## Использованные нормы / источники");
    }
  });
});
