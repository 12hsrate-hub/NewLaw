import { describe, expect, it, vi } from "vitest";

import { generateServerLegalAssistantAnswer } from "@/server/legal-assistant/answer-pipeline";

function createNormalizationResult(rawInput: string, normalizedInput = rawInput) {
  return {
    raw_input: rawInput,
    normalized_input: normalizedInput,
    normalization_model: "gpt-5.4-nano",
    normalization_prompt_version: "legal_input_normalization_v1",
    normalization_changed: normalizedInput !== rawInput,
  };
}

function createAssistantRetrieval(overrides?: Partial<{
  hasCurrentLawCorpus: boolean;
  hasUsablePrecedentCorpus: boolean;
  lawCurrentVersionIds: string[];
  lawResults: Array<Record<string, unknown>>;
  precedentResults: Array<Record<string, unknown>>;
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
          output_trace: expect.objectContaining({
            output_kind: "assistant_markdown",
            section_keys: expect.arrayContaining([
              "summary",
              "normativeAnalysis",
              "precedentAnalysis",
              "interpretation",
              "sources",
            ]),
          }),
          answer_markdown_preview: expect.stringContaining("Краткий вывод"),
          answer_sections: expect.objectContaining({
            summary: expect.any(String),
            normativeAnalysis: expect.any(String),
            precedentAnalysis: expect.any(String),
            interpretation: expect.any(String),
            sources: expect.any(String),
          }),
        }),
      }),
    );
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
          }),
        ]),
      );
      expect(result.metadata.law_version_contract).toMatchObject({
        contract_mode: "current_snapshot_only",
        is_current_snapshot_consistent: true,
      });
      expect(result.metadata.used_sources).toHaveLength(2);
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
    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "server_legal_assistant",
        accountId: "account-1",
        status: "success",
        requestPayloadJson: expect.objectContaining({
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
          retrievalResults: expect.arrayContaining([
            expect.objectContaining({ sourceKind: "law" }),
            expect.objectContaining({ sourceKind: "precedent" }),
          ]),
          source_ledger: expect.objectContaining({
            law_version_ids: ["law-version-1"],
            used_norms: [
              expect.objectContaining({
                law_id: "law-1",
              }),
            ],
          }),
        }),
        responsePayloadJson: expect.objectContaining({
          latencyMs: 0,
          prompt_tokens: 320,
          completion_tokens: 180,
          total_tokens: 500,
          cost_usd: 0.021,
          confidence: "high",
          output_trace: expect.objectContaining({
            output_kind: "assistant_markdown",
            section_keys: expect.arrayContaining([
              "summary",
              "normativeAnalysis",
              "precedentAnalysis",
              "interpretation",
              "sources",
            ]),
          }),
          answer_markdown_preview: expect.stringContaining("Краткий вывод"),
          answer_sections: expect.objectContaining({
            summary: expect.stringContaining("письменная форма"),
            normativeAnalysis: expect.stringContaining("Статья 1"),
          }),
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
          used_sources: expect.arrayContaining([
            expect.objectContaining({ source_kind: "law" }),
            expect.objectContaining({ source_kind: "precedent" }),
          ]),
        }),
      }),
    );
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
            output_kind: "assistant_markdown",
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
            output_kind: "assistant_markdown",
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
          output_trace: null,
        }),
      }),
    );
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
