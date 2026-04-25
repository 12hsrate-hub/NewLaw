import { describe, expect, it, vi } from "vitest";

import { runInternalDocumentTextImprovementScenario } from "@/server/legal-core/internal-document-text-improvement";

function createNormalizationResult(rawInput: string, normalizedInput = rawInput) {
  return {
    raw_input: rawInput,
    normalized_input: normalizedInput,
    normalization_model: "gpt-5.4-nano",
    normalization_prompt_version: "legal_input_normalization_v1",
    normalization_changed: normalizedInput !== rawInput,
  };
}

function createRetrievalResult() {
  return {
    query: "query",
    serverId: "server-1",
    generatedAt: "2026-04-25T18:00:00.000Z",
    hasCurrentLawCorpus: true,
    hasUsablePrecedentCorpus: true,
    hasAnyUsableCorpus: true,
    lawRetrieval: {
      resultCount: 1,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-25T18:00:00.000Z",
        currentVersionIds: ["law-version-1"],
        corpusSnapshotHash: "law-hash",
      },
      results: [
        {
          serverId: "server-1",
          lawId: "law-1",
          lawKey: "criminal_code",
          lawTitle: "УК сервера",
          lawVersionId: "law-version-1",
          lawVersionStatus: "current",
          lawBlockId: "law-block-1",
          blockType: "article",
          blockOrder: 1,
          articleNumberNormalized: "5.1",
          snippet: "Норма о порядке задержания.",
          blockText: "Статья 5.1. Порядок задержания и фиксации действий сотрудника.",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/law.1/",
          sourcePosts: [],
          metadata: {},
        },
      ],
    },
    precedentRetrieval: {
      resultCount: 0,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-25T18:00:00.000Z",
        currentVersionIds: ["precedent-version-1"],
        corpusSnapshotHash: "precedent-hash",
      },
      results: [],
    },
    resultCount: 1,
    results: [
      {
        serverId: "server-1",
        lawId: "law-1",
        lawKey: "criminal_code",
        lawTitle: "УК сервера",
        lawVersionId: "law-version-1",
        lawVersionStatus: "current",
        lawBlockId: "law-block-1",
        blockType: "article",
        blockOrder: 1,
        articleNumberNormalized: "5.1",
        snippet: "Норма о порядке задержания.",
        blockText: "Статья 5.1. Порядок задержания и фиксации действий сотрудника.",
        sourceTopicUrl: "https://forum.gta5rp.com/threads/law.1/",
        sourcePosts: [],
        metadata: {},
        sourceKind: "law" as const,
      },
    ],
    lawCorpusSnapshot: {
      serverId: "server-1",
      generatedAt: "2026-04-25T18:00:00.000Z",
      currentVersionIds: ["law-version-1"],
      corpusSnapshotHash: "law-hash",
    },
    precedentCorpusSnapshot: {
      serverId: "server-1",
      generatedAt: "2026-04-25T18:00:00.000Z",
      currentVersionIds: ["precedent-version-1"],
      corpusSnapshotHash: "precedent-hash",
    },
    combinedRetrievalRevision: {
      serverId: "server-1",
      generatedAt: "2026-04-25T18:00:00.000Z",
      lawCorpusSnapshotHash: "law-hash",
      precedentCorpusSnapshotHash: "precedent-hash",
      combinedCorpusSnapshotHash: "combined-hash",
      lawCurrentVersionIds: ["law-version-1"],
      precedentCurrentVersionIds: ["precedent-version-1"],
    },
  };
}

describe("internal document text improvement runner", () => {
  it("переписывает текст сценария и логирует legal-core metadata", async () => {
    const createAIRequest = vi.fn();

    const result = await runInternalDocumentTextImprovementScenario(
      {
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        sourceText: "меня кароче приняли ни за что",
        actorContext: "self",
        responseMode: "document_ready",
        accountId: "account-1",
        testRunContext: {
          run_kind: "internal_ai_legal_core_test",
          test_run_id: "test-run-1",
          test_scenario_id: "rewrite-1",
          test_scenario_group: "document_text_improvement",
          test_scenario_title: "Rewrite 1",
          law_version_selection: "current_snapshot_only",
        },
      },
      {
        searchAssistantCorpus: vi.fn().mockResolvedValue(createRetrievalResult()),
        normalizeInputText: vi
          .fn()
          .mockResolvedValue(
            createNormalizationResult(
              "меня кароче приняли ни за что",
              "Меня задержали без объяснения причин.",
            ),
          ),
        requestProxyCompletion: vi.fn().mockResolvedValue({
          status: "success",
          content:
            "Меня задержали без объяснения причин, после чего дальнейшие действия сотрудника не были разъяснены.",
          proxyKey: "primary",
          providerKey: "openai_compatible",
          model: "gpt-5.4",
          responsePayloadJson: {
            usage: {
              prompt_tokens: 230,
              completion_tokens: 110,
              total_tokens: 340,
              cost_usd: 0.011,
            },
          },
        }),
        createAIRequest,
        now: vi
          .fn()
          .mockReturnValueOnce(new Date("2026-04-25T18:00:00.000Z"))
          .mockReturnValueOnce(new Date("2026-04-25T18:00:00.250Z")),
      },
    );

    expect(result.status).toBe("rewritten");
    if (result.status === "rewritten") {
      expect(result.suggestionText).toContain("Меня задержали");
      expect(result.metadata).toMatchObject({
        intent: "document_text_improvement",
        actor_context: "self",
        response_mode: "document_ready",
        normalized_input: "Меня задержали без объяснения причин.",
        law_version_ids: ["law-version-1"],
        used_sources: [expect.objectContaining({ source_kind: "law" })],
      });
    }

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "document_field_rewrite",
        requestPayloadJson: expect.objectContaining({
          test_run_context: expect.objectContaining({
            test_run_id: "test-run-1",
          }),
          fact_ledger: expect.objectContaining({
            event: expect.any(String),
          }),
        }),
        responsePayloadJson: expect.objectContaining({
          prompt_tokens: 230,
          completion_tokens: 110,
          total_tokens: 340,
          cost_usd: 0.011,
          output_trace: expect.objectContaining({
            output_kind: "internal_document_text_improvement_plain_text",
          }),
        }),
      }),
    );
  });
});
