import { describe, expect, it, vi } from "vitest";

import { buildAssistantPrecedentRetrievalQuery } from "@/server/legal-core/assistant-retrieval-query";
import { buildLegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import { searchAssistantCorpus } from "@/server/legal-assistant/retrieval";

describe("assistant retrieval envelope", () => {
  it("объединяет law и precedent providers только на уровне typed envelope", async () => {
    const result = await searchAssistantCorpus(
      {
        serverId: "server-1",
        query: "договор",
      },
      {
        searchCurrentLawCorpus: vi.fn().mockResolvedValue({
          query: "договор",
          serverId: "server-1",
          resultCount: 1,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-21T08:00:00.000Z",
            currentVersionIds: ["law-version-1"],
            corpusSnapshotHash: "law-snapshot-hash",
          },
          results: [
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
              snippet: "Статья 1.",
              blockText: "Статья 1.",
              sourceTopicUrl: "https://forum.gta5rp.com/threads/100001/",
              sourcePosts: [],
              metadata: {
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
                corpusSnapshotHash: "law-snapshot-hash",
              },
            },
          ],
        }),
        searchCurrentLawCorpusWithContext: vi.fn(),
        searchCurrentPrecedentCorpus: vi.fn().mockResolvedValue({
          query: "договор",
          serverId: "server-1",
          resultCount: 1,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-21T08:00:00.000Z",
            currentVersionIds: ["precedent-version-1"],
            corpusSnapshotHash: "precedent-snapshot-hash",
          },
          results: [
            {
              serverId: "server-1",
              precedentId: "precedent-1",
              precedentKey: "precedent_contract_case",
              precedentTitle: "О договоре",
              precedentVersionId: "precedent-version-1",
              precedentVersionStatus: "current",
              precedentBlockId: "precedent-block-1",
              blockType: "holding",
              blockOrder: 2,
              snippet: "Суд указал...",
              blockText: "Суд указал...",
              validityStatus: "applicable",
              sourceTopicUrl: "https://forum.gta5rp.com/threads/200001/",
              sourceTopicTitle: "Судебные прецеденты",
              sourcePosts: [],
              metadata: {
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
                corpusSnapshotHash: "precedent-snapshot-hash",
              },
            },
          ],
        }),
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.resultCount).toBe(2);
    expect(result.hasCurrentLawCorpus).toBe(true);
    expect(result.hasUsablePrecedentCorpus).toBe(true);
    expect(result.hasAnyUsableCorpus).toBe(true);
    expect(result.results[0].sourceKind).toBe("law");
    expect(result.results[1].sourceKind).toBe("precedent");
    expect(result.combinedRetrievalRevision.combinedCorpusSnapshotHash).toBeTruthy();
  });

  it("остаётся usable, если laws нет, но есть valid current precedents", async () => {
    const result = await searchAssistantCorpus(
      {
        serverId: "server-1",
        query: "договор",
      },
      {
        searchCurrentLawCorpus: vi.fn().mockResolvedValue({
          query: "договор",
          serverId: "server-1",
          resultCount: 0,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-21T08:00:00.000Z",
            currentVersionIds: [],
            corpusSnapshotHash: "law-snapshot-hash",
          },
          results: [],
        }),
        searchCurrentLawCorpusWithContext: vi.fn(),
        searchCurrentPrecedentCorpus: vi.fn().mockResolvedValue({
          query: "договор",
          serverId: "server-1",
          resultCount: 1,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-21T08:00:00.000Z",
            currentVersionIds: ["precedent-version-1"],
            corpusSnapshotHash: "precedent-snapshot-hash",
          },
          results: [
            {
              serverId: "server-1",
              precedentId: "precedent-1",
              precedentKey: "precedent_contract_case",
              precedentTitle: "О договоре",
              precedentVersionId: "precedent-version-1",
              precedentVersionStatus: "current",
              precedentBlockId: "precedent-block-1",
              blockType: "holding",
              blockOrder: 1,
              snippet: "Суд указал...",
              blockText: "Суд указал...",
              validityStatus: "limited",
              sourceTopicUrl: "https://forum.gta5rp.com/threads/200001/",
              sourceTopicTitle: "Судебные прецеденты",
              sourcePosts: [],
              metadata: {
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
                corpusSnapshotHash: "precedent-snapshot-hash",
              },
            },
          ],
        }),
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(result.hasCurrentLawCorpus).toBe(false);
    expect(result.hasUsablePrecedentCorpus).toBe(true);
    expect(result.hasAnyUsableCorpus).toBe(true);
    expect(result.resultCount).toBe(1);
    expect(result.results[0].sourceKind).toBe("precedent");
  });

  it("пробрасывает legalQueryPlan в context-aware law retrieval только для assistant path", async () => {
    const legalQueryPlan = buildLegalQueryPlan({
      normalizedInput: "Можно ли задержать человека за ношение маски?",
      intent: "situation_analysis",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const searchCurrentLawCorpusWithContext = vi.fn().mockResolvedValue({
      query: legalQueryPlan.expanded_query,
      serverId: "server-1",
      resultCount: 1,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-21T08:00:00.000Z",
        currentVersionIds: ["law-version-1"],
        corpusSnapshotHash: "law-snapshot-hash",
      },
      results: [
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
          snippet: "Статья 18.",
          blockText: "Статья 18.",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/100001/",
          sourcePosts: [],
          metadata: {
            sourceSnapshotHash: "source-hash",
            normalizedTextHash: "normalized-hash",
            corpusSnapshotHash: "law-snapshot-hash",
          },
        },
      ],
      retrievalDebug: {
        retrieval_query_base_terms: ["можно", "ли", "задержать", "человека", "за", "ношение", "маски"],
        retrieval_query_anchor_terms: ["административный кодекс"],
        retrieval_query_family_terms: ["административное правонарушение"],
        retrieval_runtime_tags: ["material_offense", "detention"],
        candidate_pool_before_filters: [],
        candidate_pool_after_filters: [],
        applied_biases: ["prefer_family:administrative_code"],
        filter_reasons: [],
      },
    });

    const searchCurrentPrecedentCorpus = vi.fn().mockResolvedValue({
      query: legalQueryPlan.expanded_query,
      serverId: "server-1",
      resultCount: 0,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-21T08:00:00.000Z",
        currentVersionIds: [],
        corpusSnapshotHash: "precedent-snapshot-hash",
      },
      results: [],
    });

    const result = await searchAssistantCorpus(
      {
        serverId: "server-1",
        query: legalQueryPlan.expanded_query,
        legalQueryPlan,
      },
      {
        searchCurrentLawCorpus: vi.fn(),
        searchCurrentLawCorpusWithContext,
        searchCurrentPrecedentCorpus,
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    expect(searchCurrentLawCorpusWithContext).toHaveBeenCalledWith(
      expect.objectContaining({
        retrievalContext: expect.objectContaining({
          legalQueryPlan: expect.objectContaining({
            normalized_input: "Можно ли задержать человека за ношение маски?",
          }),
        }),
      }),
    );
    expect(searchCurrentPrecedentCorpus).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.any(String),
      }),
    );
    expect(result.retrievalDebug).toMatchObject({
      applied_biases: ["prefer_family:administrative_code"],
    });
  });

  it("ограничивает precedent query до допустимой длины для длинного assistant retrieval query", async () => {
    const legalQueryPlan = buildLegalQueryPlan({
      normalizedInput: "если руководство не ответило на адвокатский запрос",
      intent: "situation_analysis",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const searchCurrentPrecedentCorpus = vi.fn().mockResolvedValue({
      query: legalQueryPlan.expanded_query,
      serverId: "server-1",
      resultCount: 0,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-21T08:00:00.000Z",
        currentVersionIds: [],
        corpusSnapshotHash: "precedent-snapshot-hash",
      },
      results: [],
    });

    await searchAssistantCorpus(
      {
        serverId: "server-1",
        query: legalQueryPlan.expanded_query,
        legalQueryPlan,
      },
      {
        searchCurrentLawCorpus: vi.fn(),
        searchCurrentLawCorpusWithContext: vi.fn().mockResolvedValue({
          query: legalQueryPlan.expanded_query,
          serverId: "server-1",
          resultCount: 0,
          corpusSnapshot: {
            serverId: "server-1",
            generatedAt: "2026-04-21T08:00:00.000Z",
            currentVersionIds: [],
            corpusSnapshotHash: "law-snapshot-hash",
          },
          results: [],
          retrievalDebug: null,
        }),
        searchCurrentPrecedentCorpus,
        now: () => new Date("2026-04-21T08:00:00.000Z"),
      },
    );

    const precedentQuery = searchCurrentPrecedentCorpus.mock.calls[0]?.[0]?.query;

    expect(precedentQuery).toBe(
      buildAssistantPrecedentRetrievalQuery({
        normalized_input: legalQueryPlan.normalized_input,
        breakdown: {
          expanded_query: legalQueryPlan.expanded_query,
          base_terms: [],
          anchor_terms: [
            "адвокат",
            "защитник",
            "право на защиту",
            "допуск защитника",
            "адвокатский запрос",
            "официальный адвокатский запрос",
            "срок ответа",
            "обязанность ответить",
            "служебные обязанности",
            "обязан",
            "руководство",
            "должностное лицо",
            "санкция",
            "штраф",
            "ответственность",
            "наказание",
          ],
          family_terms: [
            "процессуальный кодекс",
            "процедура задержания",
            "закон об адвокатуре",
            "адвокатская деятельность",
            "государственная служба",
            "служебные обязанности",
            "ведомственный порядок",
            "служебный регламент",
            "административный кодекс",
            "административное правонарушение",
          ],
          runtime_tags: ["attorney", "attorney_request", "official_duty"],
          applied_biases: [],
        },
      }),
    );
    expect(precedentQuery.length).toBeLessThanOrEqual(500);
    expect(precedentQuery).toContain("адвокатский запрос");
  });
});
