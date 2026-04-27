import { describe, expect, it, vi } from "vitest";

import { generateServerLegalAssistantAnswer } from "@/server/legal-assistant/answer-pipeline";

function createNormalizationResult(rawInput: string, normalizedInput = rawInput) {
  return {
    raw_input: rawInput,
    normalized_input: normalizedInput,
    normalization_model: "gpt-5.4-nano",
    normalization_prompt_version: "legal_input_normalization_v1",
    normalization_changed: normalizedInput !== rawInput,
    normalization_stage_usage: {
      model: "gpt-5.4-nano",
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      estimated_cost_usd: null,
      latency_ms: 0,
    },
    normalization_retry_stage_usage: null,
  };
}

function createAssistantRetrieval(overrides?: Partial<{
  hasCurrentLawCorpus: boolean;
  hasUsablePrecedentCorpus: boolean;
  lawCurrentVersionIds: string[];
  lawResults: Array<Record<string, unknown>>;
  precedentResults: Array<Record<string, unknown>>;
  retrievalDebug: Record<string, unknown> | null;
}>) {
  const lawResults = (overrides?.lawResults ?? []) as Array<Record<string, unknown>>;
  const precedentResults = (overrides?.precedentResults ?? []) as Array<Record<string, unknown>>;
  const hasCurrentLawCorpus = overrides?.hasCurrentLawCorpus ?? lawResults.length > 0;
  const hasUsablePrecedentCorpus =
    overrides?.hasUsablePrecedentCorpus ?? precedentResults.length > 0;
  const lawCurrentVersionIds =
    overrides?.lawCurrentVersionIds ?? (hasCurrentLawCorpus ? ["law-version-1"] : []);

  return {
    serverId: "server-1",
    query: "Что с договором?",
    generatedAt: "2026-04-21T08:00:00.000Z",
    hasCurrentLawCorpus,
    hasUsablePrecedentCorpus,
    hasAnyUsableCorpus: hasCurrentLawCorpus || hasUsablePrecedentCorpus,
    lawRetrieval: {
      query: "Что с договором?",
      serverId: "server-1",
      resultCount: lawResults.length,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-21T08:00:00.000Z",
        currentVersionIds: lawCurrentVersionIds,
        corpusSnapshotHash: "law-snapshot-hash",
      },
      results: lawResults,
      retrievalDebug: overrides?.retrievalDebug ?? null,
    },
    precedentRetrieval: {
      query: "Что с договором?",
      serverId: "server-1",
      resultCount: precedentResults.length,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-21T08:00:00.000Z",
        currentVersionIds: hasUsablePrecedentCorpus ? ["precedent-version-1"] : [],
        corpusSnapshotHash: "precedent-snapshot-hash",
      },
      results: precedentResults,
    },
    resultCount: lawResults.length + precedentResults.length,
    results: [
      ...lawResults.map((result) => ({ ...result, sourceKind: "law" })),
      ...precedentResults.map((result) => ({ ...result, sourceKind: "precedent" })),
    ],
    lawCorpusSnapshot: {
      serverId: "server-1",
      generatedAt: "2026-04-21T08:00:00.000Z",
      currentVersionIds: lawCurrentVersionIds,
      corpusSnapshotHash: "law-snapshot-hash",
    },
    precedentCorpusSnapshot: {
      serverId: "server-1",
      generatedAt: "2026-04-21T08:00:00.000Z",
      currentVersionIds: hasUsablePrecedentCorpus ? ["precedent-version-1"] : [],
      corpusSnapshotHash: "precedent-snapshot-hash",
    },
    combinedRetrievalRevision: {
      serverId: "server-1",
      generatedAt: "2026-04-21T08:00:00.000Z",
      lawCorpusSnapshotHash: "law-snapshot-hash",
      precedentCorpusSnapshotHash: "precedent-snapshot-hash",
      combinedCorpusSnapshotHash: "combined-snapshot-hash",
      lawCurrentVersionIds,
      precedentCurrentVersionIds: hasUsablePrecedentCorpus ? ["precedent-version-1"] : [],
    },
    retrievalDebug: overrides?.retrievalDebug ?? null,
  };
}

function createLawResult(overrides?: Partial<Record<string, unknown>>) {
  return {
    serverId: "server-1",
    lawId: "law-1",
    lawKey: "procedural_code",
    lawTitle: "Процессуальный кодекс",
    lawVersionId: "law-version-1",
    lawVersionStatus: "current",
    lawBlockId: "law-block-1",
    blockType: "article",
    blockOrder: 1,
    articleNumberNormalized: "23.1",
    snippet: "Статья 23.1. Порядок привлечения к ответственности зависит от обстоятельств дела.",
    blockText: "Статья 23.1. Порядок привлечения к ответственности зависит от обстоятельств дела.",
    sourceTopicUrl: "https://forum.gta5rp.com/threads/100001/",
    sourcePosts: [
      {
        postExternalId: "post-1",
        postUrl: "https://forum.gta5rp.com/posts/1001",
        postOrder: 1,
      },
    ],
    metadata: {
      sourceSnapshotHash: "law-source-hash",
      normalizedTextHash: "law-normalized-hash",
      corpusSnapshotHash: "law-snapshot-hash",
      citation: {
        source_channel: "citation_target",
        citation_resolution_status: "resolved",
        citation_resolution_reason: null,
        citation_match_strength: "exact_article",
      },
    },
    ...overrides,
  };
}

describe("answer pipeline", () => {
  it("обогащает retrieval query для маски и задержания до вызова corpus search", async () => {
    const searchAssistantCorpus = vi.fn().mockResolvedValue(
      createAssistantRetrieval({
        hasCurrentLawCorpus: true,
        hasUsablePrecedentCorpus: true,
      }),
    );

    await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Можно ли задержать человека за ношение маски?",
      },
      {
        searchAssistantCorpus,
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Можно ли задержать человека за ношение маски?")),
        requestAssistantProxyCompletion: vi.fn(),
        createAIRequest: vi.fn(),
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(searchAssistantCorpus).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("административный кодекс"),
      }),
    );
    expect(searchAssistantCorpus).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("процессуальный кодекс"),
      }),
    );
  });

  it("честно возвращает fallback, если не найдены ни нормы, ни подтверждённые precedents", async () => {
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
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            hasCurrentLawCorpus: true,
            hasUsablePrecedentCorpus: true,
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Есть ли норма про неизвестный институт?")),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("no_norms");
    if (result.status === "no_norms") {
      expect(result.answerMarkdown).toContain("Что подтверждается судебными прецедентами");
      expect(result.metadata.references).toEqual([]);
      expect(result.metadata.intent).toBe("situation_analysis");
      expect(result.metadata.actor_context).toBe("general_question");
      expect(result.metadata.response_mode).toBe("normal");
      expect(result.metadata.source_ledger).toMatchObject({
        server_id: "server-1",
        found_norms: [],
      });
      expect(result.metadata.self_assessment).toMatchObject({
        answer_confidence: "low",
        insufficient_data: true,
      });
      expect(result.sections.precedentAnalysis).toContain("precedent");
    }
    expect(requestAssistantProxyCompletion).not.toHaveBeenCalled();
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        requestPayloadJson: expect.objectContaining({
          payload_profile: "runtime_compact",
          branch: "no_norms",
          raw_input: "Есть ли норма про неизвестный институт?",
          normalized_input: "Есть ли норма про неизвестный институт?",
          normalization_model: "gpt-5.4-nano",
          input_trace: expect.objectContaining({
            input_kind: "assistant_question",
            question_preview: "Есть ли норма про неизвестный институт?",
          }),
        }),
        responsePayloadJson: expect.objectContaining({
          payload_profile: "runtime_compact",
          stage_usage: expect.objectContaining({
            normalization: expect.objectContaining({
              model: "gpt-5.4-nano",
              estimated_cost_usd: null,
            }),
          }),
          output_trace: expect.objectContaining({
            output_preview: expect.any(String),
            answer_section_titles: expect.arrayContaining([
              "summary",
              "normativeAnalysis",
              "precedentAnalysis",
              "interpretation",
              "sources",
            ]),
            answer_section_count: 5,
          }),
          answer_markdown_preview: expect.stringContaining("Краткий вывод"),
        }),
      }),
    );
  });

  it("предпочитает raw explicit citation над normalization drift в legal query plan payload", async () => {
    const createAIRequest = vi.fn();

    await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "можно ли по 23.1 ПК",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            hasCurrentLawCorpus: true,
            hasUsablePrecedentCorpus: false,
            retrievalDebug: {
              candidate_pool_before_filters_count: 0,
              candidate_pool_after_filters_count: 0,
              citation_resolution: [],
              citation_target_count: 0,
              citation_companion_count: 0,
              citation_unresolved_count: 0,
              citation_partially_supported_count: 0,
              semantic_retrieval_allowed_as_companion_only: false,
            },
          }),
        ),
        normalizeInputText: vi.fn().mockResolvedValue(
          createNormalizationResult("можно ли по 23.1 ПК", "Можно ли по статье 23.1 НК РФ?"),
        ),
        requestAssistantProxyCompletion: vi.fn(),
        createAIRequest,
        now: () => new Date("2026-04-26T10:00:00.000Z"),
      },
    );

    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson.legal_query_plan).toMatchObject({
      normalized_input: "Можно ли по статье 23.1 НК РФ?",
      explicitLegalCitations: [
        expect.objectContaining({
          lawCode: "ПК",
          lawFamily: "procedural_code",
          articleNumber: "23.1",
          partNumber: null,
          resolutionStatus: "not_attempted",
        }),
      ],
      citationDiagnostics: expect.objectContaining({
        raw_citation_count: 1,
        normalized_citation_count: 0,
        merged_citation_count: 1,
        normalized_citations_discarded_count: 0,
        citation_merge_strategy: "raw_preferred",
        citation_normalization_drift_detected: true,
      }),
    });
    expect(aiRequestPayload.requestPayloadJson.citation_behavior_mode).toBe(
      "application_with_insufficient_facts",
    );
  });

  it("прокидывает explanation_only contract в prompt и request payload для bare explicit citation", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Это норма про общий состав административного нарушения.",
        "",
        "## Что прямо следует из норм закона",
        "Статья описывает состав и пределы применения нормы.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённые precedents для этого вопроса не добавлены.",
        "",
        "## Вывод / интерпретация",
        "Для применения к конкретной ситуации нужны факты.",
        "",
        "## Использованные нормы / источники",
        "Административный кодекс — статья 22.",
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4",
      responsePayloadJson: {
        usage: {
          prompt_tokens: 120,
          completion_tokens: 90,
          total_tokens: 210,
          cost_usd: 0.01,
        },
      },
    });

    await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "22 ч.1 АК",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              createLawResult({
                lawId: "law-ak-22",
                lawKey: "administrative_code",
                lawTitle: "Административный кодекс",
                articleNumberNormalized: "22",
                blockText: "Статья 22. Нарушение установленного порядка влечёт ответственность.",
              }),
            ],
            retrievalDebug: {
              candidate_pool_before_filters_count: 1,
              candidate_pool_after_filters_count: 1,
              citation_resolution: [],
              citation_target_count: 1,
              citation_companion_count: 0,
              citation_unresolved_count: 0,
              citation_partially_supported_count: 0,
              semantic_retrieval_allowed_as_companion_only: false,
            },
          }),
        ),
        normalizeInputText: vi.fn().mockResolvedValue(createNormalizationResult("22 ч.1 АК")),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-26T10:00:00.000Z"),
      },
    );

    const proxyCall = requestAssistantProxyCompletion.mock.calls[0]?.[0];
    expect(proxyCall.userPrompt).toContain("Citation behavior mode: explanation_only");
    expect(proxyCall.userPrompt).toContain("Не делай applied conclusion по фактам");

    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson.citation_behavior_mode).toBe("explanation_only");
    expect(aiRequestPayload.requestPayloadJson.legal_query_plan).toMatchObject({
      primaryLegalIssueType: "citation_explanation",
      citationBehaviorMode: "explanation_only",
    });
  });

  it("сохраняет explanation_only contract для явного explanation phrasing по Закону об адвокатуре", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Это explanatory ответ по cited норме.",
        "",
        "## Что прямо следует из норм закона",
        "Норма описывает рамку права и пределы отказа.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённые precedents здесь не меняют explanatory режим.",
        "",
        "## Вывод / интерпретация",
        "Для применения к конкретной ситуации нужны дополнительные факты.",
        "",
        "## Использованные нормы / источники",
        "Закон об адвокатуре — статья 5.",
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4",
      responsePayloadJson: {
        usage: {
          prompt_tokens: 130,
          completion_tokens: 100,
          total_tokens: 230,
          cost_usd: 0.01,
        },
      },
    });

    await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "что означает 5 ч.4 Закона об адвокатуре",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              createLawResult({
                lawId: "law-advocacy-5",
                lawKey: "advocacy_law",
                lawTitle: "Закон об адвокатуре и адвокатской деятельности",
                articleNumberNormalized: "5",
                blockText:
                  "Статья 5. Ответ на адвокатский запрос предоставляется в установленном порядке, если нет прямо названных оснований для отказа.",
              }),
            ],
            retrievalDebug: {
              candidate_pool_before_filters_count: 1,
              candidate_pool_after_filters_count: 1,
              citation_resolution: [],
              citation_target_count: 1,
              citation_companion_count: 0,
              citation_unresolved_count: 0,
              citation_partially_supported_count: 0,
              semantic_retrieval_allowed_as_companion_only: false,
            },
          }),
        ),
        normalizeInputText: vi.fn().mockResolvedValue(
          createNormalizationResult("что означает 5 ч.4 Закона об адвокатуре"),
        ),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-26T10:05:00.000Z"),
      },
    );

    const proxyCall = requestAssistantProxyCompletion.mock.calls[0]?.[0];
    expect(proxyCall.userPrompt).toContain("Citation behavior mode: explanation_only");
    expect(proxyCall.userPrompt).toContain("Не делай applied conclusion по фактам");

    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson.citation_behavior_mode).toBe("explanation_only");
    expect(aiRequestPayload.requestPayloadJson.legal_query_plan).toMatchObject({
      primaryLegalIssueType: "citation_explanation",
      citationBehaviorMode: "explanation_only",
    });
  });

  it("прокидывает application_with_insufficient_facts contract в prompt для thin citation application", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Оценка зависит от фактических обстоятельств.",
        "",
        "## Что прямо следует из норм закона",
        "Норма задаёт рамку, но не заменяет анализ фактов.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённые precedents не меняют need for facts.",
        "",
        "## Вывод / интерпретация",
        "Для вывода нужны дополнительные обстоятельства.",
        "",
        "## Использованные нормы / источники",
        "Процессуальный кодекс — статья 23.1.",
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4",
      responsePayloadJson: {
        usage: {
          prompt_tokens: 120,
          completion_tokens: 90,
          total_tokens: 210,
          cost_usd: 0.01,
        },
      },
    });

    await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "можно ли по 23.1 ПК",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [createLawResult()],
            retrievalDebug: {
              candidate_pool_before_filters_count: 1,
              candidate_pool_after_filters_count: 1,
              citation_resolution: [],
              citation_target_count: 1,
              citation_companion_count: 0,
              citation_unresolved_count: 0,
              citation_partially_supported_count: 0,
              semantic_retrieval_allowed_as_companion_only: false,
            },
          }),
        ),
        normalizeInputText: vi.fn().mockResolvedValue(createNormalizationResult("можно ли по 23.1 ПК")),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-26T10:00:00.000Z"),
      },
    );

    const proxyCall = requestAssistantProxyCompletion.mock.calls[0]?.[0];
    expect(proxyCall.userPrompt).toContain(
      "Citation behavior mode: application_with_insufficient_facts",
    );
    expect(proxyCall.userPrompt).toContain("явно назови, каких фактов не хватает");

    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson.citation_behavior_mode).toBe(
      "application_with_insufficient_facts",
    );
  });

  it("прокидывает application contract в prompt для factual citation application без automatic categorical conclusion", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Норма может применяться только при подтверждении обстоятельств нарушения.",
        "",
        "## Что прямо следует из норм закона",
        "Статья задаёт состав и пределы ответственности.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённые precedents здесь не отменяют need for factual assessment.",
        "",
        "## Вывод / интерпретация",
        "Вывод по ситуации остаётся условным и зависит от состава фактов.",
        "",
        "## Использованные нормы / источники",
        "Административный кодекс — статья 22.",
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4",
      responsePayloadJson: {
        usage: {
          prompt_tokens: 150,
          completion_tokens: 110,
          total_tokens: 260,
          cost_usd: 0.012,
        },
      },
    });

    await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "можно ли по 22 ч.1 АК привлечь за танцы в больнице",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              createLawResult({
                lawId: "law-ak-22",
                lawKey: "administrative_code",
                lawTitle: "Административный кодекс",
                articleNumberNormalized: "22",
                blockText:
                  "Статья 22. Незаконное проникновение или нахождение в определённых местах влечёт ответственность.",
              }),
            ],
            retrievalDebug: {
              candidate_pool_before_filters_count: 1,
              candidate_pool_after_filters_count: 1,
              citation_resolution: [],
              citation_target_count: 1,
              citation_companion_count: 0,
              citation_unresolved_count: 0,
              citation_partially_supported_count: 0,
              semantic_retrieval_allowed_as_companion_only: false,
            },
          }),
        ),
        normalizeInputText: vi.fn().mockResolvedValue(
          createNormalizationResult("можно ли по 22 ч.1 АК привлечь за танцы в больнице"),
        ),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-26T10:10:00.000Z"),
      },
    );

    const proxyCall = requestAssistantProxyCompletion.mock.calls[0]?.[0];
    expect(proxyCall.userPrompt).toContain("Citation behavior mode: application");
    expect(proxyCall.userPrompt).toContain(
      "не делай автоматический категоричный вывод без достаточных фактов",
    );

    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson.citation_behavior_mode).toBe("application");
    expect(aiRequestPayload.requestPayloadJson.legal_query_plan).toMatchObject({
      primaryLegalIssueType: "citation_application",
      citationBehaviorMode: "application",
    });
  });

  it("прокидывает unresolved_citation contract в request payload, если explicit citation не resolved", async () => {
    const createAIRequest = vi.fn();

    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "999 УК",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            hasCurrentLawCorpus: true,
            hasUsablePrecedentCorpus: false,
            retrievalDebug: {
              candidate_pool_before_filters_count: 0,
              candidate_pool_after_filters_count: 0,
              citation_resolution: [
                {
                  raw_citation: "999 УК",
                  law_family: "criminal_code",
                  article_number: "999",
                  part_number: null,
                  point_number: null,
                  resolution_status: "unresolved",
                  resolution_reason: "no_article",
                },
              ],
              citation_target_count: 0,
              citation_companion_count: 0,
              citation_unresolved_count: 1,
              citation_partially_supported_count: 0,
              semantic_retrieval_allowed_as_companion_only: false,
            },
          }),
        ),
        normalizeInputText: vi.fn().mockResolvedValue(createNormalizationResult("999 УК")),
        requestAssistantProxyCompletion: vi.fn(),
        createAIRequest,
        now: () => new Date("2026-04-26T10:00:00.000Z"),
      },
    );

    expect(result.status).toBe("no_norms");
    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson.citation_behavior_mode).toBe("unresolved_citation");
    expect(aiRequestPayload.requestPayloadJson.legal_query_plan).toMatchObject({
      primaryLegalIssueType: "citation_explanation",
      citationBehaviorMode: "explanation_only",
    });
  });

  it("для mixed_or_unclear прокидывает explanation-first contract и не сваливается в automatic application", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Сначала нужно объяснить cited норму, а затем только условно оценивать применение.",
        "",
        "## Что прямо следует из норм закона",
        "Норма задаёт состав, но её применение зависит от обстоятельств.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Прецеденты не отменяют need for missing facts.",
        "",
        "## Вывод / интерпретация",
        "Без дополнительных фактов категоричный вывод делать нельзя.",
        "",
        "## Использованные нормы / источники",
        "Административный кодекс — статья 22.",
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4",
      responsePayloadJson: {
        usage: {
          prompt_tokens: 160,
          completion_tokens: 120,
          total_tokens: 280,
          cost_usd: 0.013,
        },
      },
    });

    await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "22 ч.1 АК, это вообще про что и можно ли по ней привлечь в такой ситуации",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              createLawResult({
                lawId: "law-ak-22",
                lawKey: "administrative_code",
                lawTitle: "Административный кодекс",
                articleNumberNormalized: "22",
                blockText:
                  "Статья 22. Незаконное проникновение или нахождение влечёт ответственность при наличии состава нарушения.",
              }),
            ],
            retrievalDebug: {
              candidate_pool_before_filters_count: 1,
              candidate_pool_after_filters_count: 1,
              citation_resolution: [],
              citation_target_count: 1,
              citation_companion_count: 0,
              citation_unresolved_count: 0,
              citation_partially_supported_count: 0,
              semantic_retrieval_allowed_as_companion_only: false,
            },
          }),
        ),
        normalizeInputText: vi.fn().mockResolvedValue(
          createNormalizationResult(
            "22 ч.1 АК, это вообще про что и можно ли по ней привлечь в такой ситуации",
          ),
        ),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-26T10:15:00.000Z"),
      },
    );

    const proxyCall = requestAssistantProxyCompletion.mock.calls[0]?.[0];
    expect(proxyCall.userPrompt).toContain("Citation behavior mode: mixed_or_unclear");
    expect(proxyCall.userPrompt).toContain("Сначала коротко объясни cited норму");
    expect(proxyCall.userPrompt).toContain("явно перечисли missing facts");

    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson.citation_behavior_mode).toBe("mixed_or_unclear");
    expect(aiRequestPayload.requestPayloadJson.legal_query_plan).toMatchObject({
      citationBehaviorMode: "mixed_or_unclear",
    });
  });

  it("сохраняет unresolved_citation для application wording и fallback не звучит как найденная точная норма", async () => {
    const createAIRequest = vi.fn();

    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "можно ли по 999 УК привлечь",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            hasCurrentLawCorpus: true,
            hasUsablePrecedentCorpus: false,
            retrievalDebug: {
              candidate_pool_before_filters_count: 0,
              candidate_pool_after_filters_count: 0,
              citation_resolution: [
                {
                  raw_citation: "по 999 УК",
                  law_family: "criminal_code",
                  article_number: "999",
                  part_number: null,
                  point_number: null,
                  resolution_status: "unresolved",
                  resolution_reason: "no_article",
                },
              ],
              citation_target_count: 0,
              citation_companion_count: 0,
              citation_unresolved_count: 1,
              citation_partially_supported_count: 0,
              semantic_retrieval_allowed_as_companion_only: false,
            },
          }),
        ),
        normalizeInputText: vi.fn().mockResolvedValue(
          createNormalizationResult("можно ли по 999 УК привлечь"),
        ),
        requestAssistantProxyCompletion: vi.fn(),
        createAIRequest,
        now: () => new Date("2026-04-26T10:20:00.000Z"),
      },
    );

    expect(result.status).toBe("no_norms");
    if (result.status === "no_norms") {
      expect(result.answerMarkdown).toContain("Подтверждённые нормы и прямые ссылки на источники в этом ответе не использовались");
      expect(result.answerMarkdown).not.toContain("Статья 999");
    }

    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson.citation_behavior_mode).toBe("unresolved_citation");
    expect(aiRequestPayload.requestPayloadJson.citation_target_count).toBe(0);
  });

  it("строит laws-first ответ и grounded metadata для законов и precedents", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Да, письменная форма требуется, а судебная практика подтверждает жёсткий подход к её отсутствию.",
        "",
        "## Что прямо следует из норм закона",
        "Статья 1 прямо требует письменную форму договора.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённый precedent указывает, что отсутствие письменной формы ведёт к отказу в защите требования.",
        "",
        "## Вывод / интерпретация",
        "Следовательно, без письменного оформления позиция стороны будет слабее, если в корпусе нет специального исключения.",
        "",
        "## Использованные нормы / источники",
        "Гражданский кодекс — статья 1. О письменной форме договора.",
        "",
        '<!-- used_sources_json: {"laws":[{"law_id":"law-1","law_version":"law-version-1","law_block_id":"law-block-1"}],"precedents":[{"precedent_id":"precedent-1","precedent_version":"precedent-version-1","precedent_block_id":"precedent-block-1"}]} -->',
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4",
      responsePayloadJson: {
        choices: [],
        usage: {
          prompt_tokens: 320,
          completion_tokens: 180,
          total_tokens: 500,
          cost_usd: 0.021,
        },
      },
    });

    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Нужен ли письменный договор?",
        actorContext: "self",
        accountId: "account-1",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-1",
                lawKey: "civil_code",
                lawTitle: "Гражданский кодекс",
                lawVersionId: "law-version-1",
                lawVersionStatus: "current",
                lawBlockId: "law-block-1",
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
                  sourceSnapshotHash: "law-source-hash",
                  normalizedTextHash: "law-normalized-hash",
                  corpusSnapshotHash: "law-snapshot-hash",
                },
              },
            ],
            precedentResults: [
              {
                serverId: "server-1",
                precedentId: "precedent-1",
                precedentKey: "precedent_written_form",
                precedentTitle: "О письменной форме договора",
                precedentVersionId: "precedent-version-1",
                precedentVersionStatus: "current",
                precedentBlockId: "precedent-block-1",
                blockType: "holding",
                blockOrder: 2,
                snippet: "Суд указал, что устное соглашение не подтверждает право требования.",
                blockText: "Суд указал, что устное соглашение не подтверждает право требования.",
                validityStatus: "applicable",
                sourceTopicUrl: "https://forum.gta5rp.com/threads/200001/",
                sourceTopicTitle: "Судебные прецеденты Верховного суда",
                sourcePosts: [
                  {
                    postExternalId: "post-2",
                    postUrl: "https://forum.gta5rp.com/posts/2001",
                    postOrder: 2,
                  },
                ],
                metadata: {
                  sourceSnapshotHash: "precedent-source-hash",
                  normalizedTextHash: "precedent-normalized-hash",
                  corpusSnapshotHash: "precedent-snapshot-hash",
                },
              },
            ],
            retrievalDebug: {
              retrieval_query_base_terms: ["договор"],
              retrieval_query_anchor_terms: [],
              retrieval_query_family_terms: ["гражданский кодекс"],
              retrieval_runtime_tags: [],
              candidate_pool_before_filters: [],
              candidate_pool_after_filters: [],
              applied_biases: [],
              filter_reasons: [],
              citation_resolution: [
                {
                  raw_citation: "84 ук",
                  law_family: "criminal_code",
                  article_number: "84",
                  part_number: null,
                  point_number: null,
                  resolution_status: "resolved",
                  resolution_reason: null,
                  resolved_block_id: "law-block-1",
                  resolved_law_source_id: "law-1",
                  matched_law_title: "Гражданский кодекс",
                  matched_block_title: "Статья 1",
                  collision_candidates_count: 0,
                  same_law_companion_candidates_count: 0,
                  note_exception_comment_hits_count: 0,
                  cross_reference_hits_count: 0,
                },
              ],
              citation_target_count: 1,
              citation_companion_count: 0,
              citation_unresolved_count: 0,
              citation_partially_supported_count: 0,
              semantic_retrieval_allowed_as_companion_only: true,
            },
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Нужен ли письменный договор?")),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("answered");
    if (result.status === "answered") {
      expect(result.sections.normativeAnalysis).toContain("Статья 1");
      expect(result.sections.precedentAnalysis).toContain("precedent");
      expect(result.answerMarkdown).toContain("## Что прямо следует из норм закона");
      expect(result.answerMarkdown).toContain("## Что подтверждается судебными прецедентами");
      expect(result.metadata.lawsUsed).toHaveLength(1);
      expect(result.metadata.precedentsUsed).toHaveLength(1);
      expect(result.metadata.references).toHaveLength(2);
      expect(result.metadata.references[0].sourceKind).toBe("law");
      expect(result.metadata.references[1].sourceKind).toBe("precedent");
      expect(result.metadata.intent).toBe("situation_analysis");
      expect(result.metadata.actor_context).toBe("self");
      expect(result.metadata.response_mode).toBe("normal");
      expect(result.metadata.prompt_version).toBe("server_legal_assistant_legal_core_v1");
      expect(result.metadata.law_version_ids).toEqual(["law-version-1"]);
      expect(result.metadata.legal_query_plan).toMatchObject({
        normalized_input: "Нужен ли письменный договор?",
        server_id: "server-1",
        law_version: "current_snapshot_only",
        primaryLegalIssueType: "unclear",
        secondaryLegalIssueTypes: [],
        legalIssueConfidence: "low",
        legalIssueDiagnostics: expect.objectContaining({
          legal_issue_type: "unclear",
          legal_issue_confidence: "low",
        }),
      });
      expect(result.metadata.selected_norm_roles).toEqual([
        expect.objectContaining({
          law_id: "law-1",
          norm_role: "primary_basis",
        }),
      ]);
      expect(result.metadata.direct_basis_status).toBe("direct_basis_present");
      expect(result.metadata.applicability_diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            law_id: "law-1",
            law_family: expect.any(String),
            norm_role: expect.any(String),
            primary_basis_eligibility: expect.any(String),
          }),
        ]),
      );
      expect(result.metadata.law_version_contract).toMatchObject({
        contract_mode: "current_snapshot_only",
        is_current_snapshot_consistent: true,
      });
      expect(result.metadata.used_sources).toHaveLength(1);
      expect(result.metadata.generation_source_budget).toBe(4);
      expect(result.metadata.generation_sources_count).toBe(1);
      expect(result.metadata.generation_excerpt_budget).toBe(650);
      expect(result.metadata.generation_context_chars).toBeGreaterThan(0);
      expect(result.metadata.generation_context_trimmed).toBe(false);
      expect(result.metadata.answer_mode_effective_budget).toMatchObject({
        response_mode: "normal",
        max_total_sources: 4,
        max_excerpt_chars_per_source: 650,
        max_total_context_chars: 2400,
      });
      expect(result.answerMarkdown).not.toContain("used_sources_json");
      expect(result.metadata.source_ledger).toMatchObject({
        server_id: "server-1",
        law_version_ids: ["law-version-1"],
        used_norms: [
          expect.objectContaining({
            law_id: "law-1",
            law_version: "law-version-1",
          }),
        ],
      });
      expect(result.metadata.self_assessment).toMatchObject({
        answer_confidence: "high",
        insufficient_data: false,
        answer_risk_level: "low",
      });
      expect(result.metadata.combinedRetrievalRevision.combinedCorpusSnapshotHash).toBe(
        "combined-snapshot-hash",
      );
    }
    expect(requestAssistantProxyCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Законы и судебные прецеденты — разные типы источников"),
        userPrompt: expect.stringContaining("Actor context: self"),
        requestMetadata: expect.objectContaining({
          lawResultsCount: 1,
          precedentResultsCount: 1,
          prompt_version: "server_legal_assistant_legal_core_v1",
          normalized_input: "Нужен ли письменный договор?",
        }),
      }),
    );
    const promptInput = requestAssistantProxyCompletion.mock.calls[0]?.[0]?.userPrompt as string;
    expect(promptInput).toContain("Law source 1");
    expect(promptInput).not.toContain("law_id:");
    expect(promptInput).not.toContain("law_key:");
    expect(promptInput).not.toContain("version_id:");
    expect(promptInput).not.toContain("block_id:");
    expect(promptInput).not.toContain("block_type:");
    expect(promptInput).not.toContain("applicability_score:");
    expect(promptInput).not.toContain("source_topic_url:");
    expect(promptInput).not.toContain("Grounding flags:");
    expect(promptInput).not.toContain("Combined corpus snapshot hash:");
    expect(promptInput).not.toContain("Law version contract:");
    expect(promptInput).toContain("primary_basis_eligibility: eligible");
    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.featureKey).toBe("server_legal_assistant");
    expect(aiRequestPayload.accountId).toBe("account-1");
    expect(aiRequestPayload.status).toBe("success");
    expect(aiRequestPayload.requestPayloadJson).toMatchObject({
      payload_profile: "runtime_compact",
      intent: "situation_analysis",
      actor_context: "self",
      response_mode: "normal",
      raw_input: "Нужен ли письменный договор?",
      normalized_input: "Нужен ли письменный договор?",
      normalization_model: "gpt-5.4-nano",
      input_trace: expect.objectContaining({
        input_kind: "assistant_question",
        question_preview: "Нужен ли письменный договор?",
      }),
      law_version_contract: expect.objectContaining({
        contract_mode: "current_snapshot_only",
        is_current_snapshot_consistent: true,
      }),
      source_ledger: expect.objectContaining({
        law_version_ids: ["law-version-1"],
        found_norms_count: expect.any(Number),
        context_norms_count: expect.any(Number),
        used_norms_count: expect.any(Number),
        used_sources_projection: [
          expect.objectContaining({
            source_kind: "law",
            law_name: "Гражданский кодекс",
          }),
        ],
      }),
      generation_source_budget: 4,
      generation_sources_count: 1,
      generation_excerpt_budget: 650,
      generation_context_chars: expect.any(Number),
      generation_context_trimmed: false,
      answer_mode_effective_budget: expect.objectContaining({
        response_mode: "normal",
        max_total_sources: 4,
      }),
      candidate_pool_before_filters_count: expect.any(Number),
      candidate_pool_after_filters_count: expect.any(Number),
      candidate_pool_before_filters_preview: expect.any(Array),
      candidate_pool_after_filters_preview: expect.any(Array),
      candidate_pool_family_counts: expect.any(Object),
      candidate_pool_role_counts: expect.any(Object),
      filter_reason_counts: expect.any(Object),
      top_filter_reasons: expect.any(Array),
      selected_candidate_diagnostics: expect.arrayContaining([
        expect.objectContaining({
          primary_basis_eligibility: expect.any(String),
        }),
      ]),
      primary_basis_eligibility: expect.arrayContaining([
        expect.objectContaining({
          primary_basis_eligibility: expect.any(String),
        }),
      ]),
      diagnostics_summary: expect.objectContaining({
        counts_by_primary_basis_eligibility: expect.any(Object),
      }),
      grounding_diagnostics: expect.objectContaining({
        direct_basis_status: expect.any(String),
        selected_primary_basis_eligibility_summary: expect.any(Object),
        legal_issue_type: expect.any(String),
        legal_issue_secondary_types: expect.any(Array),
        legal_issue_confidence: expect.any(String),
      }),
      citation_resolution: [
        expect.objectContaining({
          raw_citation: "84 ук",
          resolution_status: "resolved",
        }),
      ],
      citation_target_count: 1,
      citation_companion_count: 0,
      citation_unresolved_count: 0,
      citation_partially_supported_count: 0,
      semantic_retrieval_allowed_as_companion_only: true,
    });
    expect(aiRequestPayload.requestPayloadJson.legal_query_plan).toMatchObject({
      primaryLegalIssueType: "unclear",
      secondaryLegalIssueTypes: [],
      legalIssueConfidence: "low",
      legalIssueDiagnostics: expect.objectContaining({
        legal_issue_type: "unclear",
      }),
    });
    expect(aiRequestPayload.requestPayloadJson.applied_biases).toEqual(expect.any(Array));
    expect(aiRequestPayload.requestPayloadJson).not.toHaveProperty("retrievalResults");
    expect(aiRequestPayload.requestPayloadJson).not.toHaveProperty("applicability_diagnostics");
    expect(aiRequestPayload.requestPayloadJson).not.toHaveProperty("candidate_pool_before_filters");
    expect(aiRequestPayload.requestPayloadJson).not.toHaveProperty("candidate_pool_after_filters");
    expect(aiRequestPayload.requestPayloadJson).not.toHaveProperty("filter_reasons");
    expect(aiRequestPayload.responsePayloadJson).toMatchObject({
      payload_profile: "runtime_compact",
      latencyMs: 0,
      prompt_tokens: 320,
      completion_tokens: 180,
      total_tokens: 500,
      cost_usd: 0.021,
      stage_usage: {
        normalization: {
          model: "gpt-5.4-nano",
          prompt_tokens: null,
          completion_tokens: null,
          total_tokens: null,
          estimated_cost_usd: null,
          latency_ms: 0,
        },
        generation: {
          model: "gpt-5.4",
          prompt_tokens: 320,
          completion_tokens: 180,
          total_tokens: 500,
          estimated_cost_usd: 0.021,
          latency_ms: 0,
        },
      },
      confidence: "high",
      output_trace: expect.objectContaining({
        output_preview: expect.any(String),
        answer_section_titles: expect.arrayContaining([
          "summary",
          "normativeAnalysis",
          "precedentAnalysis",
          "interpretation",
          "sources",
        ]),
        answer_section_count: 5,
      }),
      answer_markdown_preview: expect.stringContaining("Краткий вывод"),
      used_sources_manifest: expect.objectContaining({
        laws: [
          expect.objectContaining({
            law_id: "law-1",
          }),
        ],
        precedents: [
          expect.objectContaining({
            precedent_id: "precedent-1",
          }),
        ],
      }),
      queue_for_future_ai_quality_review: false,
      future_review_priority: "low",
      future_review_flags: [],
      future_review_reason_codes: [],
      used_sources: [expect.objectContaining({ source_kind: "law" })],
    });
    expect(aiRequestPayload.responsePayloadJson).not.toHaveProperty("answer_sections");
  });

  it("сохраняет internal_full payload для test runs даже в full_generation", async () => {
    const createAIRequest = vi.fn();

    await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Можно ли задержать человека за маску?",
        testRunContext: {
          run_kind: "internal_ai_legal_core_test",
          server_id: "server-1",
          server_code: "blackberry",
          test_run_id: "test-run-1",
          test_scenario_id: "scenario-1",
          test_scenario_group: "general_legal_questions",
          test_scenario_title: "Mask",
          law_version_selection: "current_snapshot_only",
        },
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-1",
                lawKey: "administrative_code",
                lawTitle: "Административный кодекс",
                lawVersionId: "law-version-1",
                lawVersionStatus: "current",
                lawBlockId: "law-block-1",
                blockType: "article",
                blockOrder: 1,
                articleNumberNormalized: "18",
                snippet: "Статья 18. Использование маски запрещено.",
                blockText: "Статья 18. Использование маски запрещено.",
                sourceTopicUrl: "https://forum.gta5rp.com/threads/100001/",
                sourcePosts: [],
                metadata: {
                  sourceSnapshotHash: "source-hash",
                  normalizedTextHash: "normalized-hash",
                  corpusSnapshotHash: "snapshot-hash",
                  citation: {
                    source_channel: "citation_target",
                    explicit_citation_raw: "18 АК",
                    citation_resolution_status: "resolved",
                    citation_resolution_reason: null,
                    citation_match_strength: "exact_article",
                  },
                },
              },
            ],
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Можно ли задержать человека за маску?")),
        requestAssistantProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content: [
            "## Краткий вывод",
            "Да, может применяться при наличии состава.",
            "",
            "## Что прямо следует из норм закона",
            "Статья 18 регулирует маски.",
            "",
            "## Что подтверждается судебными прецедентами",
            "Подтверждённые прецеденты не использовались.",
            "",
            "## Вывод / интерпретация",
            "Оценка зависит от обстоятельств.",
            "",
            "## Использованные нормы / источники",
            "Административный кодекс, ст. 18.",
            "",
            '<!-- used_sources_json: {"laws":[{"law_id":"law-1","law_version":"law-version-1","law_block_id":"law-block-1"}],"precedents":[]} -->',
          ].join("\n"),
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4-mini",
          responsePayloadJson: {
            choices: [],
          },
        }),
        createAIRequest,
        now: () => new Date("2026-04-26T08:00:00.000Z"),
      },
    );

    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson).toMatchObject({
      payload_profile: "internal_full",
      test_run_context: expect.objectContaining({
        test_run_id: "test-run-1",
      }),
      applicability_diagnostics: expect.any(Array),
      candidate_pool_before_filters: expect.any(Array),
      candidate_pool_after_filters: expect.any(Array),
      filter_reasons: expect.any(Array),
    });
    expect(aiRequestPayload.responsePayloadJson).toMatchObject({
      payload_profile: "internal_full",
      answer_sections: expect.objectContaining({
        summary: expect.any(String),
      }),
    });
  });

  it("явно допускает precedent-only ответ, если laws нет, но есть подтверждённый precedent", async () => {
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Прямой нормы закона в подтверждённом corpus не найдено, но есть подтверждённый судебный precedent.",
        "",
        "## Что прямо следует из норм закона",
        "В current primary laws выбранного сервера релевантная норма закона не найдена.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённый precedent указывает на необходимость письменной формы.",
        "",
        "## Вывод / интерпретация",
        "Ответ опирается на precedent-corpus, а не на прямую норму закона.",
        "",
        '<!-- used_sources_json: {"laws":[],"precedents":[{"precedent_id":"precedent-1","precedent_version":"precedent-version-1","precedent_block_id":"precedent-block-1"}]} -->',
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4",
      responsePayloadJson: {
        choices: [],
      },
    });
    const createAIRequest = vi.fn();

    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Что если только precedent?",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            hasCurrentLawCorpus: false,
            hasUsablePrecedentCorpus: true,
            precedentResults: [
              {
                serverId: "server-1",
                precedentId: "precedent-1",
                precedentKey: "precedent_only",
                precedentTitle: "Precedent only",
                precedentVersionId: "precedent-version-1",
                precedentVersionStatus: "current",
                precedentBlockId: "precedent-block-1",
                blockType: "holding",
                blockOrder: 1,
                snippet: "Holding.",
                blockText: "Holding.",
                validityStatus: "limited",
                sourceTopicUrl: "https://forum.gta5rp.com/threads/200001/",
                sourceTopicTitle: "Topic",
                sourcePosts: [],
                metadata: {
                  sourceSnapshotHash: "source-hash",
                  normalizedTextHash: "normalized-hash",
                  corpusSnapshotHash: "snapshot-hash",
                  citation: {
                    source_channel: "citation_target",
                    explicit_citation_raw: "18 АК",
                    citation_resolution_status: "resolved",
                    citation_resolution_reason: null,
                    citation_match_strength: "exact_article",
                  },
                },
              },
            ],
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Что если только precedent?")),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("answered");
    expect(requestAssistantProxyCompletion).toHaveBeenCalled();
    if (result.status === "answered") {
      expect(result.metadata.lawsUsed).toEqual([]);
      expect(result.metadata.precedentsUsed).toHaveLength(1);
      expect(result.metadata.used_sources).toEqual([
        expect.objectContaining({
          source_kind: "precedent",
          precedent_id: "precedent-1",
        }),
      ]);
      expect(result.metadata.direct_basis_status).toBe("no_direct_basis");
      expect(result.metadata.self_assessment).toMatchObject({
        answer_confidence: "low",
        insufficient_data: true,
        answer_risk_level: "high",
      });
      expect(result.sections.normativeAnalysis).toContain("норма закона");
      expect(result.sections.precedentAnalysis).toContain("precedent");
    }
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        responsePayloadJson: expect.objectContaining({
          output_trace: expect.objectContaining({
            output_preview: expect.any(String),
          }),
          queue_for_future_ai_quality_review: true,
          future_review_priority: "high",
          future_review_reason_codes: expect.arrayContaining(["precedent_only_grounding"]),
        }),
      }),
    );
  });

  it("помечает нарушение law version contract, если найденная норма вне current snapshot", async () => {
    const createAIRequest = vi.fn();

    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Что с нормой вне current snapshot?",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawCurrentVersionIds: ["law-version-1"],
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-legacy",
                lawKey: "legacy_code",
                lawTitle: "Старый кодекс",
                lawVersionId: "law-version-2",
                lawVersionStatus: "current",
                lawBlockId: "law-block-legacy",
                blockType: "article",
                blockOrder: 1,
                articleNumberNormalized: "7",
                snippet: "Статья 7.",
                blockText: "Статья 7. Legacy text.",
                sourceTopicUrl: "https://forum.gta5rp.com/threads/100777/",
                sourcePosts: [],
                metadata: {
                  sourceSnapshotHash: "legacy-source-hash",
                  normalizedTextHash: "legacy-normalized-hash",
                  corpusSnapshotHash: "law-snapshot-hash",
                },
              },
            ],
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Что с нормой вне current snapshot?")),
        requestAssistantProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content: [
            "## Краткий вывод",
            "Ответ зависит от соблюдения порядка.",
            "",
            "## Что прямо следует из норм закона",
            "Статья 7 указывает на специальный порядок.",
            "",
            "## Что подтверждается судебными прецедентами",
            "Подтверждённые прецеденты не использовались.",
            "",
            "## Вывод / интерпретация",
            "Применение зависит от действующей редакции.",
            "",
            "## Использованные нормы / источники",
            "Старый кодекс — статья 7.",
            "",
            '<!-- used_sources_json: {"laws":[{"law_id":"law-legacy","law_version":"law-version-2","law_block_id":"law-block-legacy"}],"precedents":[]} -->',
          ].join("\n"),
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4",
          responsePayloadJson: {
            choices: [],
          },
        }),
        createAIRequest,
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("answered");
    if (result.status === "answered") {
      expect(result.metadata.law_version_contract).toMatchObject({
        is_current_snapshot_consistent: false,
        found_norms_outside_current_snapshot: ["law-version-2"],
        context_norms_outside_current_snapshot: ["law-version-2"],
        used_norms_outside_current_snapshot: ["law-version-2"],
      });
    }

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        responsePayloadJson: expect.objectContaining({
          output_trace: expect.objectContaining({
            output_preview: expect.any(String),
          }),
          queue_for_future_ai_quality_review: true,
          future_review_priority: "high",
          future_review_reason_codes: expect.arrayContaining(["law_version_contract_violation"]),
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
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-1",
                lawKey: "civil_code",
                lawTitle: "Гражданский кодекс",
                lawVersionId: "law-version-1",
                lawVersionStatus: "current",
                lawBlockId: "law-block-1",
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
                  citation: {
                    source_channel: "citation_target",
                    explicit_citation_raw: "18 АК",
                    citation_resolution_status: "resolved",
                    citation_resolution_reason: null,
                    citation_match_strength: "exact_article",
                  },
                },
              },
            ],
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Нужен ли письменный договор?")),
        requestAssistantProxyCompletion: vi.fn().mockResolvedValue({
          status: "unavailable",
          message: "AI proxy не настроен.",
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4",
        }),
        createAIRequest,
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.message).toContain("недоступен");
      expect(result.metadata.self_assessment).toMatchObject({
        answer_confidence: "low",
        insufficient_data: true,
        answer_risk_level: "high",
      });
    }
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unavailable",
        requestPayloadJson: expect.objectContaining({
          raw_input: "Нужен ли письменный договор?",
          normalized_input: "Нужен ли письменный договор?",
          input_trace: expect.objectContaining({
            input_kind: "assistant_question",
          }),
        }),
        responsePayloadJson: expect.objectContaining({
          stage_usage: expect.objectContaining({
            normalization: expect.objectContaining({
              model: "gpt-5.4-nano",
            }),
            generation: expect.objectContaining({
              model: "gpt-5.4",
              estimated_cost_usd: null,
            }),
          }),
          output_trace: null,
        }),
      }),
    );
  });

  it("при malformed proxy config отдаёт наружу generic unavailable, но сохраняет operational причину и core diagnostics в AIRequest", async () => {
    const createAIRequest = vi.fn();

    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Можно ли задержать человека за маску?",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-1",
                lawKey: "administrative_code",
                lawTitle: "Административный кодекс",
                lawVersionId: "law-version-1",
                lawVersionStatus: "current",
                lawBlockId: "law-block-1",
                blockType: "article",
                blockOrder: 1,
                articleNumberNormalized: "18",
                snippet: "Статья 18. Использование маски и средств маскировки запрещено.",
                blockText: "Статья 18. Использование маски и средств маскировки запрещено.",
                sourceTopicUrl: "https://forum.gta5rp.com/threads/100001/",
                sourcePosts: [],
                metadata: {
                  sourceSnapshotHash: "source-hash",
                  normalizedTextHash: "normalized-hash",
                  corpusSnapshotHash: "snapshot-hash",
                  citation: {
                    source_channel: "citation_target",
                    explicit_citation_raw: "18 АК",
                    citation_resolution_status: "resolved",
                    citation_resolution_reason: null,
                    citation_match_strength: "exact_article",
                  },
                },
              },
            ],
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Можно ли задержать человека за маску?")),
        requestAssistantProxyCompletion: vi.fn().mockResolvedValue({
          status: "unavailable",
          message: "Конфигурация AI proxy повреждена или неполна.",
          attemptedProxyKeys: [],
          attempts: [],
        }),
        createAIRequest,
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.message).toBe(
        "Сервис юридического помощника сейчас недоступен. Попробуй задать вопрос позже.",
      );
      expect(result.metadata.selected_norm_roles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            law_id: "law-1",
            norm_role: expect.any(String),
          }),
        ]),
      );
      expect(result.metadata.applicability_diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            law_id: "law-1",
            primary_basis_eligibility: expect.any(String),
          }),
        ]),
      );
      expect(result.metadata.direct_basis_status).toEqual(expect.any(String));
      expect(result.metadata.used_sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source_kind: "law",
            law_id: "law-1",
          }),
        ]),
      );
    }

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unavailable",
        errorMessage: "Конфигурация AI proxy повреждена или неполна.",
        requestPayloadJson: expect.objectContaining({
          payload_profile: "runtime_compact",
          raw_input: "Можно ли задержать человека за маску?",
          normalized_input: "Можно ли задержать человека за маску?",
          selected_norm_roles: expect.arrayContaining([
            expect.objectContaining({
              law_id: "law-1",
            }),
          ]),
          selected_candidate_diagnostics: expect.arrayContaining([
            expect.objectContaining({
              law_id: "law-1",
              primary_basis_eligibility: expect.any(String),
            }),
          ]),
          diagnostics_summary: expect.objectContaining({
            counts_by_primary_basis_eligibility: expect.any(Object),
          }),
          grounding_diagnostics: expect.objectContaining({
            direct_basis_status: expect.any(String),
          }),
          used_sources: expect.arrayContaining([
            expect.objectContaining({
              source_kind: "law",
              law_id: "law-1",
            }),
          ]),
        }),
        responsePayloadJson: expect.objectContaining({
          payload_profile: "runtime_compact",
          output_trace: null,
          stage_usage: expect.objectContaining({
            generation: expect.objectContaining({
              model: null,
              prompt_tokens: null,
              completion_tokens: null,
            }),
          }),
        }),
      }),
    );
  });

  it("логирует retry stage usage, если generation переключилась на резервный proxy", async () => {
    const createAIRequest = vi.fn();

    await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Нужен ли письменный договор?",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-1",
                lawKey: "civil_code",
                lawTitle: "Гражданский кодекс",
                lawVersionId: "law-version-1",
                lawVersionStatus: "current",
                lawBlockId: "law-block-1",
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
                  citation: {
                    source_channel: "citation_target",
                    explicit_citation_raw: "18 АК",
                    citation_resolution_status: "resolved",
                    citation_resolution_reason: null,
                    citation_match_strength: "exact_article",
                  },
                },
              },
            ],
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Нужен ли письменный договор?")),
        requestAssistantProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content: [
            "## Краткий вывод",
            "Да.",
            "",
            "## Что прямо следует из норм закона",
            "Статья 1.",
            "",
            "## Что подтверждается судебными прецедентами",
            "Подтверждённые прецеденты не использовались.",
            "",
            "## Вывод / интерпретация",
            "Интерпретация.",
            "",
            "## Использованные нормы / источники",
            "Гражданский кодекс — статья 1.",
          ].join("\n"),
          proxyKey: "secondary",
          providerKey: "openai_compatible",
          model: "gpt-5.4-mini",
          attemptedProxyKeys: ["primary", "secondary"],
          attempts: [
            {
              proxyKey: "primary",
              providerKey: "openai_compatible",
              model: "gpt-5.4-mini",
              status: "unavailable",
              latency_ms: 900,
              prompt_tokens: null,
              completion_tokens: null,
              total_tokens: null,
              cost_usd: null,
            },
            {
              proxyKey: "secondary",
              providerKey: "openai_compatible",
              model: "gpt-5.4-mini",
              status: "success",
              latency_ms: 700,
              prompt_tokens: 200,
              completion_tokens: 50,
              total_tokens: 250,
              cost_usd: null,
            },
          ],
          responsePayloadJson: {
            choices: [],
          },
        }),
        createAIRequest,
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        responsePayloadJson: expect.objectContaining({
          stage_usage: expect.objectContaining({
            retry: {
              model: "gpt-5.4-mini",
              prompt_tokens: null,
              completion_tokens: null,
              total_tokens: null,
              estimated_cost_usd: null,
              latency_ms: 900,
            },
          }),
        }),
      }),
    );
  });

  it("в internal core_only режиме выполняет legal core без финальной generation и пишет stage_usage", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn();

    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Можно ли задержать человека за маску?",
        internalExecutionMode: "core_only",
        testRunContext: {
          run_kind: "internal_ai_legal_core_test",
          server_id: "server-1",
          server_code: "blackberry",
          test_run_id: "test-run-1",
          test_scenario_id: "scenario-1",
          test_scenario_group: "general_legal_questions",
          test_scenario_title: "Mask",
          law_version_selection: "current_snapshot_only",
        },
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-1",
                lawKey: "administrative_code",
                lawTitle: "Административный кодекс",
                lawVersionId: "law-version-1",
                lawVersionStatus: "current",
                lawBlockId: "law-block-1",
                blockType: "article",
                blockOrder: 1,
                articleNumberNormalized: "18",
                snippet: "Статья 18. Использование маски запрещено.",
                blockText: "Статья 18. Использование маски запрещено.",
                sourceTopicUrl: "https://forum.gta5rp.com/threads/100001/",
                sourcePosts: [],
                metadata: {
                  sourceSnapshotHash: "source-hash",
                  normalizedTextHash: "normalized-hash",
                  corpusSnapshotHash: "snapshot-hash",
                  citation: {
                    source_channel: "citation_target",
                    explicit_citation_raw: "18 АК",
                    citation_resolution_status: "resolved",
                    citation_resolution_reason: null,
                    citation_match_strength: "exact_article",
                  },
                },
              },
            ],
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Можно ли задержать человека за маску?")),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-26T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("core_only");
    expect(requestAssistantProxyCompletion).not.toHaveBeenCalled();
    if (result.status === "core_only") {
      expect(result.metadata.legal_query_plan).toMatchObject({
        normalized_input: "Можно ли задержать человека за маску?",
      });
      expect(result.metadata.selected_norm_roles).toEqual([
        expect.objectContaining({
          law_id: "law-1",
        }),
      ]);
      expect(result.metadata.direct_basis_status).toBe("direct_basis_present");
      expect(result.metadata.applicability_diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            law_id: "law-1",
            source_channel: "citation_target",
            citation_resolution_status: "resolved",
            specificity_rank: expect.any(Number),
            specificity_reasons: expect.any(Array),
            specificity_penalties: expect.any(Array),
          }),
        ]),
      );
      expect(result.metadata.self_assessment).toMatchObject({
        answer_confidence: "medium",
      });
      expect(result.metadata.grounding_diagnostics).toEqual(
        expect.objectContaining({
          specificity_warning_reasons: expect.any(Array),
        }),
      );
    }
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        requestPayloadJson: expect.objectContaining({
          payload_profile: "internal_full",
          branch: expect.anything(),
          legal_query_plan: expect.any(Object),
          selected_norm_roles: expect.any(Array),
          direct_basis_status: "direct_basis_present",
          applicability_diagnostics: expect.any(Array),
          grounding_diagnostics: expect.any(Object),
        }),
        responsePayloadJson: expect.objectContaining({
          payload_profile: "internal_full",
          branch: "core_only",
          output_trace: null,
          stage_usage: expect.objectContaining({
            normalization: expect.objectContaining({
              model: "gpt-5.4-nano",
            }),
          }),
        }),
      }),
    );
  });

  it("в internal compact_generation режиме использует более жёсткий budget и ограничение output tokens", async () => {
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Короткий вывод.",
        "",
        "## Что прямо следует из норм закона",
        "1. Пункт один.\n2. Пункт два.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённые прецеденты не использовались.",
        "",
        "## Вывод / интерпретация",
        "Что делать: действовать по процедуре.",
        "",
        "## Использованные нормы / источники",
        "Кодекс, ст. 18.",
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4-mini",
      responsePayloadJson: {
        choices: [],
      },
    });

    const lawResults = Array.from({ length: 6 }, (_, index) => ({
      serverId: "server-1",
      lawId: `law-${index + 1}`,
      lawKey: index === 0 ? "administrative_code" : `law_key_${index + 1}`,
      lawTitle: index === 0 ? "Административный кодекс" : `Закон ${index + 1}`,
      lawVersionId: "law-version-1",
      lawVersionStatus: "current",
      lawBlockId: `law-block-${index + 1}`,
      blockType: "article",
      blockOrder: index + 1,
      articleNumberNormalized: String(index + 1),
      snippet: `Статья ${index + 1}. Текст.`,
      blockText: `Статья ${index + 1}. ${"Текст нормы ".repeat(40)}`.trim(),
      sourceTopicUrl: `https://forum.gta5rp.com/threads/10000${index + 1}/`,
      sourcePosts: [],
      metadata: {
        sourceSnapshotHash: "source-hash",
        normalizedTextHash: "normalized-hash",
        corpusSnapshotHash: "snapshot-hash",
      },
    }));

    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Можно ли задержать человека за маску?",
        responseModeOverride: "normal",
        internalExecutionMode: "compact_generation",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults,
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Можно ли задержать человека за маску?")),
        requestAssistantProxyCompletion,
        createAIRequest: vi.fn(),
        now: () => new Date("2026-04-26T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("answered");
    if (result.status === "answered") {
      expect(result.metadata.answer_mode_effective_budget).toMatchObject({
        response_mode: "normal",
        execution_mode: "compact_generation",
        max_total_sources: 3,
        max_excerpt_chars_per_source: 420,
        max_total_context_chars: 1400,
        max_output_tokens: 320,
      });
      expect(result.metadata.generation_source_budget).toBe(3);
      expect(result.metadata.generation_excerpt_budget).toBe(420);
      expect(result.metadata.generation_max_output_tokens).toBe(320);
    }

    expect(requestAssistantProxyCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 320,
      }),
    );
    const promptInput = requestAssistantProxyCompletion.mock.calls[0]?.[0]?.userPrompt as string;
    expect((promptInput.match(/Law source \d+/g) ?? []).length).toBeLessThanOrEqual(3);
    expect(promptInput).toContain("Execution mode: compact_generation");
    expect(promptInput).toContain("Режим ответа: compact_generation.");
    expect(promptInput).toContain("2–3 коротких grounded пункта");
    expect(promptInput).toContain("одну короткую строку 'что делать'");
  });

  it("логирует no_corpus без вызова модели, если нет ни current laws, ни usable precedents", async () => {
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
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            hasCurrentLawCorpus: false,
            hasUsablePrecedentCorpus: false,
          }),
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Нужен ли письменный договор?")),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("no_corpus");
    expect(requestAssistantProxyCompletion).not.toHaveBeenCalled();
    if (result.status === "no_corpus") {
      expect(result.metadata.self_assessment).toMatchObject({
        answer_confidence: "low",
        insufficient_data: true,
        answer_risk_level: "high",
      });
    }
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unavailable",
        responsePayloadJson: expect.objectContaining({
          stage_usage: expect.objectContaining({
            normalization: expect.objectContaining({
              model: "gpt-5.4-nano",
            }),
          }),
          output_trace: null,
          queue_for_future_ai_quality_review: true,
          future_review_priority: "high",
          future_review_reason_codes: expect.arrayContaining(["no_usable_corpus"]),
        }),
        requestPayloadJson: expect.objectContaining({
          branch: "no_corpus",
          intent: "situation_analysis",
          actor_context: "general_question",
          response_mode: "normal",
          raw_input: "Нужен ли письменный договор?",
          normalized_input: "Нужен ли письменный договор?",
          input_trace: expect.objectContaining({
            input_kind: "assistant_question",
          }),
        }),
      }),
    );
  });

  it("ограничивает число sources в generation prompt по response_mode", async () => {
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Краткий grounded ответ.",
        "",
        "## Что прямо следует из норм закона",
        "Использована статья 1.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённые прецеденты не использовались.",
        "",
        "## Вывод / интерпретация",
        "Оценка зависит от обстоятельств.",
        "",
        "## Использованные нормы / источники",
        "Кодекс, ст. 1.",
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4-mini",
      responsePayloadJson: {
        choices: [],
      },
    });

    const longLawResults = Array.from({ length: 8 }, (_, index) => ({
      serverId: "server-1",
      lawId: `law-${index + 1}`,
      lawKey: index === 0 ? "administrative_code" : `law_key_${index + 1}`,
      lawTitle: index === 0 ? "Административный кодекс" : `Закон ${index + 1}`,
      lawVersionId: "law-version-1",
      lawVersionStatus: "current",
      lawBlockId: `law-block-${index + 1}`,
      blockType: "article",
      blockOrder: index + 1,
      articleNumberNormalized: String(index + 1),
      snippet: `Статья ${index + 1}. Текст.`,
      blockText: `Статья ${index + 1}. ${"Текст нормы ".repeat(30)}`.trim(),
      sourceTopicUrl: `https://forum.gta5rp.com/threads/10000${index + 1}/`,
      sourcePosts: [],
      metadata: {
        sourceSnapshotHash: "source-hash",
        normalizedTextHash: "normalized-hash",
        corpusSnapshotHash: "snapshot-hash",
      },
    }));

    const precedentResults = Array.from({ length: 4 }, (_, index) => ({
      serverId: "server-1",
      precedentId: `precedent-${index + 1}`,
      precedentKey: `precedent_key_${index + 1}`,
      precedentTitle: `Прецедент ${index + 1}`,
      precedentVersionId: "precedent-version-1",
      precedentVersionStatus: "current",
      precedentBlockId: `precedent-block-${index + 1}`,
      blockType: "holding",
      blockOrder: index + 1,
      snippet: `Вывод ${index + 1}.`,
      blockText: `Прецедент ${index + 1}. ${"Текст прецедента ".repeat(20)}`.trim(),
      validityStatus: "applicable",
      sourceTopicUrl: `https://forum.gta5rp.com/threads/20000${index + 1}/`,
      sourceTopicTitle: "Судебные прецеденты Верховного суда",
      sourcePosts: [],
      metadata: {
        sourceSnapshotHash: "precedent-source-hash",
        normalizedTextHash: "precedent-normalized-hash",
        corpusSnapshotHash: "precedent-snapshot-hash",
      },
    }));

    const runScenario = async (responseMode: "short" | "normal" | "detailed" | "document_ready") => {
      const localRequestAssistantProxyCompletion = vi.fn().mockImplementation(requestAssistantProxyCompletion);

      await generateServerLegalAssistantAnswer(
        {
          serverId: "server-1",
          serverCode: "blackberry",
          serverName: "Blackberry",
          question: "Нужен короткий grounded ответ?",
          responseModeOverride: responseMode,
        },
        {
          searchAssistantCorpus: vi.fn().mockResolvedValue(
            createAssistantRetrieval({
              lawResults: longLawResults,
              precedentResults,
            }),
          ),
          normalizeInputText: vi
            .fn()
            .mockResolvedValue(createNormalizationResult("Нужен короткий grounded ответ?")),
          requestAssistantProxyCompletion: localRequestAssistantProxyCompletion,
          createAIRequest: vi.fn(),
          now: () => new Date("2026-04-21T08:00:00.000Z"),
        },
      );

      return localRequestAssistantProxyCompletion.mock.calls[0]?.[0]?.userPrompt as string;
    };

    const shortPrompt = await runScenario("short");
    const normalPrompt = await runScenario("normal");
    const detailedPrompt = await runScenario("detailed");
    const documentReadyPrompt = await runScenario("document_ready");

    expect((shortPrompt.match(/Law source \d+/g) ?? []).length).toBeLessThanOrEqual(2);
    expect((normalPrompt.match(/Law source \d+/g) ?? []).length).toBeLessThanOrEqual(4);
    expect((detailedPrompt.match(/Law source \d+/g) ?? []).length).toBeLessThanOrEqual(6);
    expect((documentReadyPrompt.match(/Law source \d+/g) ?? []).length).toBeLessThanOrEqual(4);

    expect(shortPrompt).toContain("Режим ответа: short. Дай очень короткий ответ");
    expect(normalPrompt).toContain("Режим ответа: normal. Дай обычный по глубине юридический ответ");
    expect(detailedPrompt).toContain("Режим ответа: detailed. Дай более развёрнутый анализ");
    expect(documentReadyPrompt).toContain("Режим ответа: document_ready. Делай акцент на формулировках");
  });

  it("режет длинные нормы по excerpt budget, но сохраняет primary basis и direct_basis_status", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Да, прямое правило есть.",
        "",
        "## Что прямо следует из норм закона",
        "Административный кодекс, статья 18, прямо регулирует ситуацию.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённые прецеденты не использовались.",
        "",
        "## Вывод / интерпретация",
        "Допустимо при соблюдении порядка.",
        "",
        "## Использованные нормы / источники",
        "Административный кодекс, ст. 18.",
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4-mini",
      responsePayloadJson: {
        choices: [],
      },
    });

    const longBlockText = `Статья 18. ${"Использование маски и средств маскировки запрещено. ".repeat(80)}`.trim();

    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Можно ли задержать человека за маску?",
        responseModeOverride: "short",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-1",
                lawKey: "administrative_code",
                lawTitle: "Административный кодекс",
                lawVersionId: "law-version-1",
                lawVersionStatus: "current",
                lawBlockId: "law-block-1",
                blockType: "article",
                blockOrder: 1,
                articleNumberNormalized: "18",
                snippet: "Статья 18. Использование маски запрещено.",
                blockText: longBlockText,
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
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Можно ли задержать человека за маску?")),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("answered");
    if (result.status === "answered") {
      expect(result.metadata.direct_basis_status).toBe("direct_basis_present");
      expect(result.metadata.selected_norm_roles).toEqual([
        expect.objectContaining({
          law_id: "law-1",
          norm_role: "primary_basis",
        }),
      ]);
      expect(result.metadata.generation_context_trimmed).toBe(true);
      expect(result.metadata.generation_excerpt_budget).toBe(450);
    }

    const promptInput = requestAssistantProxyCompletion.mock.calls[0]?.[0]?.userPrompt as string;
    expect(promptInput).toContain("primary_basis_eligibility: eligible");
    expect(promptInput).toContain("article_number: 18");
    expect(promptInput).not.toContain(longBlockText);
    expect(promptInput).toContain("…");
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestPayloadJson: expect.objectContaining({
          payload_profile: "runtime_compact",
          selected_candidate_diagnostics: expect.any(Array),
          diagnostics_summary: expect.any(Object),
          grounding_diagnostics: expect.any(Object),
          source_ledger: expect.any(Object),
          generation_context_trimmed: true,
          generation_excerpt_budget: 450,
        }),
      }),
    );
  });

  it("в compact_generation выбирает question-aware excerpt и подтягивает срок из глубокой части статьи", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Срок есть.",
        "",
        "## Что прямо следует из норм закона",
        "Статья прямо называет срок.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённые прецеденты не использовались.",
        "",
        "## Вывод / интерпретация",
        "Нужно учитывать срок из нормы.",
        "",
        "## Использованные нормы / источники",
        "Закон об адвокатуре, ст. 5.",
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4-mini",
      responsePayloadJson: {
        choices: [],
      },
    });

    const longAttorneyArticle = [
      "Статья 5. Адвокатский запрос",
      `ч. 1 ${"Адвокат вправе направлять официальный адвокатский запрос по вопросам компетенции органов и организаций. ".repeat(12)}`,
      "ч. 2 Органы и организации, которым направлен адвокатский запрос, должны дать на него ответ в течение одного календарного дня с момента его получения.",
      "ч. 3 В предоставлении запрошенных сведений может быть отказано, если адресат ими не располагает.",
      "ч. 4 Неправомерный отказ и нарушение сроков предоставления сведений влекут ответственность.",
    ].join("\n");

    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "какой срок ответа на адвокатский запрос",
        responseModeOverride: "normal",
        internalExecutionMode: "compact_generation",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-1",
                lawKey: "advocacy_law",
                lawTitle: "Закон об адвокатуре",
                lawVersionId: "law-version-1",
                lawVersionStatus: "current",
                lawBlockId: "law-block-1",
                blockType: "article",
                blockOrder: 1,
                articleNumberNormalized: "5",
                snippet: "Статья 5. Адвокатский запрос.",
                blockText: longAttorneyArticle,
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
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("какой срок ответа на адвокатский запрос")),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-26T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("answered");
    const promptInput = requestAssistantProxyCompletion.mock.calls[0]?.[0]?.userPrompt as string;
    expect(promptInput).toContain("- primary_excerpt:");
    expect(promptInput).not.toContain("companion[procedure_companion]");
    expect(promptInput).toContain("одного календарного дня");
    expect(promptInput).not.toContain("3 рабочих дня");
    expect(promptInput).not.toContain("срок давности");
    expect(promptInput).not.toContain("подлежат уничтожению");
    expect(promptInput).not.toContain(longAttorneyArticle);

    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson.generation_excerpt_strategy).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        strategy: expect.stringMatching(/^issue_targeted_/),
      }),
    ]);
    expect(aiRequestPayload.requestPayloadJson.generation_excerpt_matched_terms).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        matched_terms: expect.arrayContaining(["календарного дня", "ответ"]),
      }),
    ]);
    expect(aiRequestPayload.requestPayloadJson.generation_excerpt_was_targeted).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        was_targeted: true,
      }),
    ]);
    expect(aiRequestPayload.requestPayloadJson.generation_excerpt_trimmed).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        trimmed: expect.any(Boolean),
      }),
    ]);
    expect(aiRequestPayload.requestPayloadJson.norm_bundle_present).toBe(true);
    expect(aiRequestPayload.requestPayloadJson.bundle_primary_count).toBe(1);
    expect(aiRequestPayload.requestPayloadJson.bundle_companion_count).toBe(1);
    expect(aiRequestPayload.requestPayloadJson.companion_relation_types).toEqual([
      "procedure_companion",
    ]);
    expect(aiRequestPayload.requestPayloadJson.included_companions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_id: "law-1",
          law_block_id: "law-block-1",
          marker: "ч. 2",
          relation_type: "procedure_companion",
        }),
      ]),
    );
    expect(aiRequestPayload.requestPayloadJson.bundle_budget_trimmed).toBe(false);
    expect(aiRequestPayload.requestPayloadJson.same_article_part_count).toBe(0);
    expect(aiRequestPayload.requestPayloadJson.article_note_count).toBe(0);
    expect(aiRequestPayload.requestPayloadJson.exception_count).toBe(0);
    expect(aiRequestPayload.requestPayloadJson.sanction_companion_count).toBe(0);
    expect(aiRequestPayload.requestPayloadJson.evidence_companion_count).toBe(0);
    expect(aiRequestPayload.requestPayloadJson.segment_relation_types).toEqual([
      "procedure_companion",
    ]);
    expect(aiRequestPayload.requestPayloadJson.included_article_segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          marker: "ч. 2",
          relation_type: "procedure_companion",
        }),
      ]),
    );
    expect(aiRequestPayload.requestPayloadJson.excluded_article_segments).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason_code: expect.any(String) })]),
    );
    expect(aiRequestPayload.requestPayloadJson.norm_bundle_projection_used).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        used: false,
      }),
    ]);
    expect(aiRequestPayload.requestPayloadJson.bundle_projection_items_count).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        item_count: 1,
      }),
    ]);
    expect(aiRequestPayload.requestPayloadJson.bundle_projection_relation_types).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        relation_types: [],
      }),
    ]);
    expect(aiRequestPayload.requestPayloadJson.bundle_projection_companion_items).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        items: [],
      }),
    ]);
    expect(aiRequestPayload.requestPayloadJson.bundle_projection_excluded_items).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        items: expect.arrayContaining([
          expect.objectContaining({
            marker: "ч. 2",
            relation_type: "procedure_companion",
            reason_code: "duplicate_of_primary_excerpt",
          }),
        ]),
      }),
    ]);
    expect(promptInput).not.toContain("NormBundle");
    expect(JSON.stringify(aiRequestPayload.requestPayloadJson)).not.toContain("Текст нормы");
  });

  it("в compact_generation проецирует same-article companions для no-response без excluded procedural parts", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Нужно учитывать срок, основания отказа и последствия нарушения.",
        "",
        "## Что прямо следует из норм закона",
        "Статья 5 охватывает срок, отказ и последствия.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённые прецеденты не использовались.",
        "",
        "## Вывод / интерпретация",
        "Оценка зависит от соблюдения порядка.",
        "",
        "## Использованные нормы / источники",
        "Закон об адвокатуре, ст. 5.",
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4-mini",
      responsePayloadJson: {
        choices: [],
      },
    });

    const longAttorneyArticle = [
      "Статья 5. Адвокатский запрос",
      "ч. 1 Адвокат вправе направлять официальный адвокатский запрос.",
      "ч. 2 Органы и организации должны дать на него ответ в течение одного календарного дня с момента получения.",
      "ч. 3 Если запрашиваемые материалы имеют срок давности, они не подлежат уничтожению до представления адвокату.",
      "ч. 4 В предоставлении сведений может быть отказано, если адресат не располагает сведениями или информация покрывается тайной.",
      "ч. 5 Неправомерный отказ и нарушение сроков предоставления сведений влекут ответственность.",
      "ч. 6 Руководитель обязан уведомить подчинённого об адвокатском запросе.",
      "ч. 8 Запрос делопроизводств офиса генерального прокурора не может происходить в рамках адвокатского запроса.",
    ].join("\n");

    await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "если руководство не ответило на адвокатский запрос",
        responseModeOverride: "normal",
        internalExecutionMode: "compact_generation",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-1",
                lawKey: "advocacy_law",
                lawTitle: "Закон об адвокатуре",
                lawVersionId: "law-version-1",
                lawVersionStatus: "current",
                lawBlockId: "law-block-1",
                blockType: "article",
                blockOrder: 1,
                articleNumberNormalized: "5",
                snippet: "Статья 5. Адвокатский запрос.",
                blockText: longAttorneyArticle,
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
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(
            createNormalizationResult("если руководство не ответило на адвокатский запрос"),
          ),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-27T09:00:00.000Z"),
      },
    );

    const promptInput = requestAssistantProxyCompletion.mock.calls[0]?.[0]?.userPrompt as string;
    expect(promptInput).toContain("companion[procedure_companion]");
    expect(promptInput).not.toContain("companion[exception]");
    expect(promptInput).toContain("companion[sanction_companion]");
    expect(promptInput).toContain("в течение одного календарного дня");
    expect(promptInput).toContain("может быть отказано");
    expect(promptInput).toContain("Неправомерный отказ");
    expect(promptInput).not.toContain("срок давности");
    expect(promptInput).not.toContain("уведомить подчинённого");
    expect(promptInput).not.toContain("офиса генерального прокурора");

    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson.bundle_projection_relation_types).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        relation_types: ["procedure_companion", "sanction_companion"],
      }),
    ]);
    expect(aiRequestPayload.requestPayloadJson.bundle_projection_companion_items).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        items: expect.arrayContaining([
          expect.objectContaining({
            marker: "ч. 2",
            relation_type: "procedure_companion",
          }),
          expect.objectContaining({
            marker: "ч. 5",
            relation_type: "sanction_companion",
          }),
        ]),
      }),
    ]);
    expect(aiRequestPayload.requestPayloadJson.bundle_projection_excluded_items).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        items: expect.arrayContaining([
          expect.objectContaining({
            marker: "ч. 4",
            relation_type: "exception",
            reason_code: "duplicate_of_primary_excerpt",
          }),
        ]),
      }),
    ]);
  });

  it("подрезает bundle companions по budget и пишет projection diagnostics", async () => {
    const createAIRequest = vi.fn();
    const requestAssistantProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: [
        "## Краткий вывод",
        "Есть несколько релевантных частей статьи.",
        "",
        "## Что прямо следует из норм закона",
        "Нужно учитывать срок, отказ и последствия.",
        "",
        "## Что подтверждается судебными прецедентами",
        "Подтверждённые прецеденты не использовались.",
        "",
        "## Вывод / интерпретация",
        "Ориентируйтесь на прямые части статьи.",
        "",
        "## Использованные нормы / источники",
        "Закон об адвокатуре, ст. 5.",
      ].join("\n"),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4-mini",
      responsePayloadJson: {
        choices: [],
      },
    });

    const longAttorneyArticle = [
      "Статья 5. Адвокатский запрос",
      "ч. 1 Адвокат вправе направлять официальный адвокатский запрос.",
      `ч. 2 ${"Органы и организации должны дать на него ответ в течение одного календарного дня. ".repeat(4)}`,
      `ч. 4 ${"В предоставлении сведений может быть отказано, если адресат не располагает сведениями или информация покрывается тайной. ".repeat(4)}`,
      `ч. 5 ${"Неправомерный отказ и нарушение сроков предоставления сведений влекут ответственность. ".repeat(4)}`,
    ].join("\n");

    await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "если руководство не ответило на адвокатский запрос",
        responseModeOverride: "normal",
        internalExecutionMode: "compact_generation",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-1",
                lawKey: "advocacy_law",
                lawTitle: "Закон об адвокатуре",
                lawVersionId: "law-version-1",
                lawVersionStatus: "current",
                lawBlockId: "law-block-1",
                blockType: "article",
                blockOrder: 1,
                articleNumberNormalized: "5",
                snippet: "Статья 5. Адвокатский запрос.",
                blockText: longAttorneyArticle,
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
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(
            createNormalizationResult("если руководство не ответило на адвокатский запрос"),
          ),
        requestAssistantProxyCompletion,
        createAIRequest,
        now: () => new Date("2026-04-27T09:05:00.000Z"),
      },
    );

    const promptInput = requestAssistantProxyCompletion.mock.calls[0]?.[0]?.userPrompt as string;
    expect(promptInput).toContain("companion[procedure_companion]");
    expect(promptInput).toContain("companion[sanction_companion]");
    expect(promptInput).not.toContain("companion[exception]");

    const aiRequestPayload = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestPayload.requestPayloadJson.bundle_budget_trimmed).toBe(true);
    expect(aiRequestPayload.requestPayloadJson.bundle_projection_companion_items).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        items: expect.arrayContaining([
          expect.objectContaining({
            marker: "ч. 2",
            relation_type: "procedure_companion",
          }),
          expect.objectContaining({
            marker: "ч. 5",
            relation_type: "sanction_companion",
          }),
        ]),
      }),
    ]);
    expect(aiRequestPayload.requestPayloadJson.bundle_projection_excluded_items).toEqual([
      expect.objectContaining({
        law_id: "law-1",
        law_block_id: "law-block-1",
        items: expect.arrayContaining([
          expect.objectContaining({
            marker: "ч. 4",
            relation_type: "exception",
            reason_code: "duplicate_of_primary_excerpt",
          }),
          expect.objectContaining({
            reason_code: expect.stringMatching(/^(projection_|duplicate_of_primary_excerpt)/),
          }),
        ]),
      }),
    ]);
  });

  it("нормализует ответ модели в структурированный markdown даже если precedent section пропущена", async () => {
    const result = await generateServerLegalAssistantAnswer(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        question: "Нужен ли письменный договор?",
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(
          createAssistantRetrieval({
            lawResults: [
              {
                serverId: "server-1",
                lawId: "law-1",
                lawKey: "civil_code",
                lawTitle: "Гражданский кодекс",
                lawVersionId: "law-version-1",
                lawVersionStatus: "current",
                lawBlockId: "law-block-1",
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
        ),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(createNormalizationResult("Нужен ли письменный договор?")),
        requestAssistantProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content:
            "## Краткий вывод\nДа.\n\n## Что прямо следует из норм закона\nСтатья 1.\n\n## Вывод / интерпретация\nИнтерпретация.",
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4",
          responsePayloadJson: {
            choices: [],
          },
        }),
        createAIRequest: vi.fn(),
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.status).toBe("answered");
    if (result.status === "answered") {
      expect(result.answerMarkdown).toContain("## Краткий вывод");
      expect(result.answerMarkdown).toContain("## Что прямо следует из норм закона");
      expect(result.answerMarkdown).toContain("## Что подтверждается судебными прецедентами");
      expect(result.answerMarkdown).toContain("## Вывод / интерпретация");
      expect(result.answerMarkdown).toContain("## Использованные нормы / источники");
      expect(result.sections.precedentAnalysis).toContain("прецедент");
    }
  });
});
