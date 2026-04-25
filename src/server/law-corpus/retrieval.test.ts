import { describe, expect, it, vi } from "vitest";

import { buildAssistantRetrievalQuery } from "@/server/legal-core/assistant-retrieval-query";
import { buildLegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import {
  searchCurrentLawCorpus,
  searchCurrentLawCorpusWithContext,
} from "@/server/law-corpus/retrieval";

function createLawBlock(input: {
  id: string;
  lawId: string;
  lawKey: string;
  lawTitle: string;
  topicUrl: string;
  blockType?: "section" | "chapter" | "article" | "appendix" | "unstructured";
  blockOrder?: number;
  blockTitle?: string | null;
  blockText: string;
  articleNumberNormalized?: string | null;
}) {
  return {
    id: input.id,
    blockType: input.blockType ?? "article",
    blockOrder: input.blockOrder ?? 1,
    blockTitle: input.blockTitle ?? null,
    blockText: input.blockText,
    articleNumberNormalized: input.articleNumberNormalized ?? null,
    lawVersion: {
      id: `${input.lawId}-version-1`,
      status: "current" as const,
      lawId: input.lawId,
      sourceSnapshotHash: `${input.lawId}-source-hash`,
      normalizedTextHash: `${input.lawId}-normalized-hash`,
      currentForLaw: {
        id: input.lawId,
        lawKey: input.lawKey,
        title: input.lawTitle,
        topicUrl: input.topicUrl,
      },
      sourcePosts: [],
    },
  };
}

function createRetrievalContext(input: {
  normalizedInput: string;
  intent: Parameters<typeof buildLegalQueryPlan>[0]["intent"];
}) {
  const legalQueryPlan = buildLegalQueryPlan({
    normalizedInput: input.normalizedInput,
    intent: input.intent,
    actorContext: "general_question",
    responseMode: "normal",
    serverId: "server-1",
  });

  return {
    legalQueryPlan,
    queryBreakdown: buildAssistantRetrievalQuery({
      normalized_input: legalQueryPlan.normalized_input,
      intent: legalQueryPlan.intent,
      required_law_families: legalQueryPlan.required_law_families,
      preferred_norm_roles: legalQueryPlan.preferred_norm_roles,
      legal_anchors: [...legalQueryPlan.legal_anchors],
      question_scope: legalQueryPlan.question_scope,
      forbidden_scope_markers: legalQueryPlan.forbidden_scope_markers,
    }),
  };
}

describe("law corpus retrieval", () => {
  it("сохраняет базовый article-first contract для обычного поиска", async () => {
    const result = await searchCurrentLawCorpus(
      {
        serverId: "server-1",
        query: "статья 1 общие положения",
      },
      {
        listCurrentLawBlocksByServer: vi.fn().mockResolvedValue([
          createLawBlock({
            id: "block-section",
            lawId: "law-1",
            lawKey: "criminal_code",
            lawTitle: "Уголовный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/1001/",
            blockType: "section",
            blockOrder: 0,
            blockTitle: "Раздел I",
            blockText: "Общие положения и вводная часть.",
          }),
          createLawBlock({
            id: "block-article-1",
            lawId: "law-1",
            lawKey: "criminal_code",
            lawTitle: "Уголовный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/1001/",
            blockText: "Статья 1. Общие положения. Основной текст статьи.",
            articleNumberNormalized: "1",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.resultCount).toBe(1);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        lawKey: "criminal_code",
        lawVersionStatus: "current",
        blockType: "article",
        articleNumberNormalized: "1",
      }),
    );
  });

  it("для кейса про маску поднимает administrative_code и не даёт public_assembly доминировать", async () => {
    const context = createRetrievalContext({
      normalizedInput: "Можно ли задержать человека за ношение маски?",
      intent: "situation_analysis",
    });

    const result = await searchCurrentLawCorpusWithContext(
      {
        serverId: "server-1",
        query: context.queryBreakdown.expanded_query,
        limit: 12,
        retrievalContext: context,
      },
      {
        listCurrentLawBlocksByServer: vi.fn().mockResolvedValue([
          createLawBlock({
            id: "block-assembly",
            lawId: "law-assembly",
            lawKey: "public_assembly_law",
            lawTitle: "Закон о публичных мероприятиях",
            topicUrl: "https://forum.gta5rp.com/threads/assembly/",
            blockText: "Порядок проведения митингов и публичных мероприятий.",
            articleNumberNormalized: "12",
          }),
          createLawBlock({
            id: "block-admin",
            lawId: "law-admin",
            lawKey: "administrative_code",
            lawTitle: "Административный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/admin/",
            blockText:
              "Статья 18. Использование масок запрещено в общественных местах и влечёт штраф.",
            articleNumberNormalized: "18",
          }),
          createLawBlock({
            id: "block-procedure",
            lawId: "law-procedure",
            lawKey: "procedural_code",
            lawTitle: "Процессуальный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/procedure/",
            blockText:
              "Статья 23.1. При отказе оплатить тикет допускается задержание и идентификация личности.",
            articleNumberNormalized: "23.1",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results.map((entry) => entry.lawKey)).toEqual(
      expect.arrayContaining(["administrative_code", "procedural_code"]),
    );
    expect(result.results.map((entry) => entry.lawKey)[0]).toBe("administrative_code");
    expect(result.retrievalDebug?.candidate_pool_after_filters.map((entry) => entry.law_key)).not.toContain(
      "public_assembly_law",
    );
    expect(result.retrievalDebug?.retrieval_query_family_terms).toContain("административный кодекс");
  });

  it("для общего вопроса про bodycam демотирует department_specific нормы", async () => {
    const context = createRetrievalContext({
      normalizedInput: "Если сотрудник не вёл бодикам, это нарушение?",
      intent: "evidence_check",
    });

    const result = await searchCurrentLawCorpusWithContext(
      {
        serverId: "server-1",
        query: context.queryBreakdown.expanded_query,
        limit: 12,
        retrievalContext: context,
      },
      {
        listCurrentLawBlocksByServer: vi.fn().mockResolvedValue([
          createLawBlock({
            id: "block-prison",
            lawId: "law-prison",
            lawKey: "prison_department",
            lawTitle: "Закон об Управлении тюрем штата Сан-Андреас",
            topicUrl: "https://forum.gta5rp.com/threads/prison/",
            blockText: "Сотрудники Управления тюрем используют body-cam при несении службы.",
            articleNumberNormalized: "17.1",
          }),
          createLawBlock({
            id: "block-guard",
            lawId: "law-guard",
            lawKey: "national_guard",
            lawTitle: "Закон о Национальной Гвардии штата Сан-Андреас",
            topicUrl: "https://forum.gta5rp.com/threads/guard/",
            blockText: "Военнослужащий обязан включать body-cam перед применением силы.",
            articleNumberNormalized: "25",
          }),
          createLawBlock({
            id: "block-procedure-video",
            lawId: "law-procedure",
            lawKey: "procedural_code",
            lawTitle: "Процессуальный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/procedure/",
            blockText: "При задержании допускается видеозапись и фиксация процессуальных действий.",
            articleNumberNormalized: "19",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results[0]?.lawKey).toBe("procedural_code");
    expect(result.retrievalDebug?.filter_reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_block_id: "block-prison",
          reasons: expect.arrayContaining(["department_specific_for_general_question"]),
        }),
      ]),
    );
  });

  it("для вопроса про адвоката при задержании поднимает advocacy_law и не даёт immunity доминировать", async () => {
    const context = createRetrievalContext({
      normalizedInput: "Что делать если не дали адвоката при задержании",
      intent: "situation_analysis",
    });

    const result = await searchCurrentLawCorpusWithContext(
      {
        serverId: "server-1",
        query: context.queryBreakdown.expanded_query,
        limit: 12,
        retrievalContext: context,
      },
      {
        listCurrentLawBlocksByServer: vi.fn().mockResolvedValue([
          createLawBlock({
            id: "block-immunity",
            lawId: "law-immunity",
            lawKey: "immunity_law",
            lawTitle: "Закон о неприкосновенности государственных служащих",
            topicUrl: "https://forum.gta5rp.com/threads/immunity/",
            blockText: "Задержание лица с иммунитетом допускается только в особых случаях.",
            articleNumberNormalized: "7",
          }),
          createLawBlock({
            id: "block-advocacy",
            lawId: "law-advocacy",
            lawKey: "advocacy_law",
            lawTitle: "Закон об адвокатуре и адвокатской деятельности",
            topicUrl: "https://forum.gta5rp.com/threads/advocacy/",
            blockText: "Задержанному обеспечивается право на защитника и допуск адвоката.",
            articleNumberNormalized: "5",
          }),
          createLawBlock({
            id: "block-procedure",
            lawId: "law-procedure",
            lawKey: "procedural_code",
            lawTitle: "Процессуальный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/procedure/",
            blockText: "При задержании разъясняются права и обеспечивается их реализация.",
            articleNumberNormalized: "17",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results.map((entry) => entry.lawKey)).toEqual(
      expect.arrayContaining(["advocacy_law", "procedural_code"]),
    );
    expect(result.results.map((entry) => entry.lawKey)[0]).toBe("advocacy_law");
    expect(result.retrievalDebug?.candidate_pool_after_filters.map((entry) => entry.law_key)).not.toContain(
      "immunity_law",
    );
  });

  it("для адвокатского запроса оставляет закон об адвокатуре выше OGP и санкционных норм", async () => {
    const context = createRetrievalContext({
      normalizedInput: "Если руководство не ответило на адвокатский запрос",
      intent: "situation_analysis",
    });

    const result = await searchCurrentLawCorpusWithContext(
      {
        serverId: "server-1",
        query: context.queryBreakdown.expanded_query,
        limit: 12,
        retrievalContext: context,
      },
      {
        listCurrentLawBlocksByServer: vi.fn().mockResolvedValue([
          createLawBlock({
            id: "block-advocacy",
            lawId: "law-advocacy",
            lawKey: "advocacy_law",
            lawTitle: "Закон об адвокатуре и адвокатской деятельности",
            topicUrl: "https://forum.gta5rp.com/threads/advocacy/",
            blockText:
              "Официальный адвокатский запрос подлежит обязательному рассмотрению. Ответ даётся в установленный срок.",
            articleNumberNormalized: "5",
          }),
          createLawBlock({
            id: "block-ogp",
            lawId: "law-ogp",
            lawKey: "ogp_law",
            lawTitle: "Закон «О деятельности офиса Генерального прокурора»",
            topicUrl: "https://forum.gta5rp.com/threads/ogp/",
            blockText:
              "Прокурорская группа контролирует исполнение обязательных актов и может требовать отчёты.",
            articleNumberNormalized: "51",
          }),
          createLawBlock({
            id: "block-ak",
            lawId: "law-ak",
            lawKey: "administrative_code",
            lawTitle: "Административный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/ak/",
            blockText: "Неисполнение служебных обязанностей влечёт штраф.",
            articleNumberNormalized: "23",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results[0]?.lawKey).toBe("advocacy_law");
    expect(result.retrievalDebug?.candidate_pool_after_filters[0]?.law_key).toBe("advocacy_law");
  });

  it("в fallback режиме не оставляет пустой pool и держит budget не больше 12 кандидатов", async () => {
    const context = createRetrievalContext({
      normalizedInput: "Если сотрудник не вёл бодикам, это нарушение?",
      intent: "evidence_check",
    });

    const result = await searchCurrentLawCorpusWithContext(
      {
        serverId: "server-1",
        query: context.queryBreakdown.expanded_query,
        limit: 12,
        retrievalContext: context,
      },
      {
        listCurrentLawBlocksByServer: vi.fn().mockResolvedValue([
          createLawBlock({
            id: "block-only-special",
            lawId: "law-only-special",
            lawKey: "prison_department",
            lawTitle: "Закон об Управлении тюрем штата Сан-Андреас",
            topicUrl: "https://forum.gta5rp.com/threads/prison/",
            blockText: "Сотрудники Управления тюрем используют body-cam при несении службы.",
            articleNumberNormalized: "17.1",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.resultCount).toBe(1);
    expect(result.retrievalDebug?.candidate_pool_after_filters).toHaveLength(1);
    expect(result.retrievalDebug?.candidate_pool_after_filters.length).toBeLessThanOrEqual(12);
  });
});
