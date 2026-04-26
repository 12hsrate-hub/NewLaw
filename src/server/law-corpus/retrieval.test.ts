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
            blockTitle: "Статья 5. Адвокатский запрос",
            blockText:
              "Официальный адвокатский запрос подлежит обязательному рассмотрению. Органы и организации должны дать ответ в течение одного календарного дня. Неправомерный отказ в предоставлении сведений, нарушение сроков предоставления сведений, запрашиваемые сведения, видеозаписи для ОГП, упоминание департамента и неприкосновенное лицо указываются в исключениях статьи.",
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
    expect(
      result.retrievalDebug?.candidate_pool_after_filters.some(
        (entry) => entry.law_key === "advocacy_law" && entry.article_number === "5",
      ),
    ).toBe(true);
    expect(result.retrievalDebug?.filter_reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_block_id: "block-advocacy",
          reasons: expect.arrayContaining([
            "department_specific_for_general_question_softened_for_attorney_request",
            "immunity_without_scope_softened_for_attorney_request",
          ]),
        }),
      ]),
    );
  });

  it("для срока ответа на адвокатский запрос поднимает advocacy_law выше government и ethics", async () => {
    const context = createRetrievalContext({
      normalizedInput: "какой срок ответа на адвокатский запрос",
      intent: "law_explanation",
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
            blockTitle: "Статья 5. Адвокатский запрос",
            blockText:
              "Адвокатский запрос подлежит рассмотрению. Официальный адвокатский запрос, ответ на запрос, должны дать ответ в течение одного календарного дня. Отказ в предоставлении сведений, основания отказа, нарушение сроков, предоставление сведений, видеозаписи, ОГП, департамент и неприкосновенное лицо перечислены в тексте статьи.",
            articleNumberNormalized: "5",
          }),
          createLawBlock({
            id: "block-ethics",
            lawId: "law-ethics",
            lawKey: "ethics_code",
            lawTitle: "Этический кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/ethics/",
            blockText: "Сотрудник обязан устранить нарушение в установленный срок.",
            articleNumberNormalized: "28",
          }),
          createLawBlock({
            id: "block-gov",
            lawId: "law-gov",
            lawKey: "government_code",
            lawTitle: "Кодекс о деятельности Правительства",
            topicUrl: "https://forum.gta5rp.com/threads/gov/",
            blockText: "Должностные лица обязаны исполнять служебные обязанности и давать отчеты.",
            articleNumberNormalized: "68",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results[0]?.lawKey).toBe("advocacy_law");
    expect(result.results.map((entry) => entry.lawKey)).toEqual(
      expect.arrayContaining(["advocacy_law", "ethics_code"]),
    );
    expect(
      result.retrievalDebug?.candidate_pool_after_filters.some(
        (entry) => entry.law_key === "advocacy_law" && entry.article_number === "5",
      ),
    ).toBe(true);
    expect(result.retrievalDebug?.filter_reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_block_id: "block-advocacy",
          reasons: expect.arrayContaining([
            "department_specific_for_general_question_softened_for_attorney_request",
            "immunity_without_scope_softened_for_attorney_request",
          ]),
        }),
      ]),
    );
    const advocacyIndex = result.results.findIndex((entry) => entry.lawKey === "advocacy_law");
    const ethicsIndex = result.results.findIndex((entry) => entry.lawKey === "ethics_code");
    const governmentIndex = result.results.findIndex((entry) => entry.lawKey === "government_code");

    expect(advocacyIndex).toBeGreaterThanOrEqual(0);
    expect(ethicsIndex).toBeGreaterThanOrEqual(0);
    if (governmentIndex >= 0) {
      expect(advocacyIndex).toBeLessThan(governmentIndex);
    }
    expect(advocacyIndex).toBeLessThan(ethicsIndex);
  });

  it("для неисполненного адвокатского запроса держит advocacy_law выше criminal sanction companion", async () => {
    const context = createRetrievalContext({
      normalizedInput: "официальный адвокатский запрос не исполнен",
      intent: "law_explanation",
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
            blockTitle: "Статья 5. Адвокатский запрос",
            blockText:
              "Статья 5. Адвокатский запрос. Официальный адвокатский запрос подлежит обязательному рассмотрению. Должны дать ответ в течение одного календарного дня. Отказ в предоставлении сведений и нарушение сроков, предоставление сведений, запрашиваемые сведения, видеозаписи, ОГП, департамент и неприкосновенное лицо упоминаются в тексте статьи.",
            articleNumberNormalized: "5",
          }),
          createLawBlock({
            id: "block-uk-84",
            lawId: "law-uk",
            lawKey: "criminal_code",
            lawTitle: "Уголовный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/uk/",
            blockText: "Статья 84. Неисполнение обязательных правовых актов.",
            articleNumberNormalized: "84",
          }),
          createLawBlock({
            id: "block-gov",
            lawId: "law-gov",
            lawKey: "government_code",
            lawTitle: "Кодекс о деятельности Правительства",
            topicUrl: "https://forum.gta5rp.com/threads/gov/",
            blockText: "Должностные лица обязаны исполнять служебные обязанности.",
            articleNumberNormalized: "67",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results[0]?.lawKey).toBe("advocacy_law");
    expect(result.results.map((entry) => entry.lawKey)).toEqual(
      expect.arrayContaining(["advocacy_law", "criminal_code"]),
    );
    expect(
      result.retrievalDebug?.candidate_pool_after_filters.some(
        (entry) => entry.law_key === "advocacy_law" && entry.article_number === "5",
      ),
    ).toBe(true);
    expect(result.retrievalDebug?.candidate_pool_after_filters[0]).toEqual(
      expect.objectContaining({
        law_key: "advocacy_law",
        article_number: "5",
      }),
    );
  });

  it("не смягчает government и department_specific candidates только из-за похожих attorney_request terms", async () => {
    const context = createRetrievalContext({
      normalizedInput: "какой срок ответа на адвокатский запрос",
      intent: "law_explanation",
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
            blockTitle: "Статья 5. Адвокатский запрос",
            blockText:
              "Адвокатский запрос. Должны дать ответ в течение одного календарного дня. Отказ в предоставлении сведений, видеозаписи, ОГП и неприкосновенное лицо указаны в статье.",
            articleNumberNormalized: "5",
          }),
          createLawBlock({
            id: "block-gov-like",
            lawId: "law-gov",
            lawKey: "government_code",
            lawTitle: "Кодекс о деятельности Правительства",
            topicUrl: "https://forum.gta5rp.com/threads/gov/",
            blockText:
              "Официальный запрос рассматривается должностным лицом. Срок ответа и предоставление сведений определяются служебным регламентом ОГП.",
            articleNumberNormalized: "68",
          }),
          createLawBlock({
            id: "block-dept-like",
            lawId: "law-dept",
            lawKey: "national_guard",
            lawTitle: "Закон о Национальной Гвардии штата Сан-Андреас",
            topicUrl: "https://forum.gta5rp.com/threads/guard/",
            blockText:
              "Подразделение рассматривает запросы и предоставляет сведения по внутреннему регламенту и служебной отчетности.",
            articleNumberNormalized: "25",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results[0]?.lawKey).toBe("advocacy_law");
    expect(result.retrievalDebug?.filter_reasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_block_id: "block-gov-like",
          reasons: expect.arrayContaining([
            "department_specific_for_general_question_softened_for_attorney_request",
          ]),
        }),
      ]),
    );
    expect(result.retrievalDebug?.filter_reasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_block_id: "block-dept-like",
          reasons: expect.arrayContaining([
            "department_specific_for_general_question_softened_for_attorney_request",
          ]),
        }),
      ]),
    );
  });

  it("не включает attorney_request filter safety для non-attorney_request query", async () => {
    const context = createRetrievalContext({
      normalizedInput: "если сотрудник не вёл бодикам, это нарушение?",
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
            id: "block-advocacy-noisy",
            lawId: "law-advocacy",
            lawKey: "advocacy_law",
            lawTitle: "Закон об адвокатуре и адвокатской деятельности",
            topicUrl: "https://forum.gta5rp.com/threads/advocacy/",
            blockTitle: "Статья 5. Адвокатский запрос",
            blockText:
              "Официальный адвокатский запрос. Должны дать ответ в течение одного календарного дня. Отказ в предоставлении сведений, видеозаписи, ОГП и неприкосновенное лицо указаны в тексте.",
            articleNumberNormalized: "5",
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
    expect(result.retrievalDebug?.filter_reasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_block_id: "block-advocacy-noisy",
          reasons: expect.arrayContaining([
            "department_specific_for_general_question_softened_for_attorney_request",
            "immunity_without_scope_softened_for_attorney_request",
          ]),
        }),
      ]),
    );
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

  it("для 22 ч.1 АК добавляет citation_target первым и не подменяет его cross-family статьями", async () => {
    const context = createRetrievalContext({
      normalizedInput: "22 ч.1 АК",
      intent: "law_explanation",
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
            id: "block-ak-22",
            lawId: "law-ak",
            lawKey: "administrative_code",
            lawTitle: "Административный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/ak/",
            blockText: "Статья 22. ч. 1 Нарушение порядка и административная ответственность.",
            articleNumberNormalized: "22",
          }),
          createLawBlock({
            id: "block-ak-22-note",
            lawId: "law-ak",
            lawKey: "administrative_code",
            lawTitle: "Административный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/ak/",
            blockType: "unstructured",
            blockOrder: 2,
            blockTitle: "Примечание",
            blockText: "Примечание к статье 22: за исключением особых случаев.",
          }),
          createLawBlock({
            id: "block-pk-22",
            lawId: "law-pk",
            lawKey: "procedural_code",
            lawTitle: "Процессуальный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/pk/",
            blockText: "Статья 22. Процедурное действие.",
            articleNumberNormalized: "22",
          }),
          createLawBlock({
            id: "block-uk-22",
            lawId: "law-uk",
            lawKey: "criminal_code",
            lawTitle: "Уголовный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/uk/",
            blockText: "Статья 22. Уголовный состав.",
            articleNumberNormalized: "22",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        lawKey: "administrative_code",
        lawBlockId: "block-ak-22",
        metadata: expect.objectContaining({
          citation: expect.objectContaining({
            source_channel: "citation_target",
            citation_resolution_status: "resolved",
          }),
        }),
      }),
    );
    expect(
      result.results.filter((entry) => entry.metadata.citation?.source_channel === "citation_target"),
    ).toHaveLength(1);
    expect(
      result.results.some(
        (entry) =>
          entry.lawBlockId !== "block-ak-22" &&
          entry.metadata.citation?.source_channel === "citation_target",
      ),
    ).toBe(false);
    expect(result.retrievalDebug?.citation_target_count).toBe(1);
    expect(result.retrievalDebug?.citation_resolution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          raw_citation: "22 ч.1 ак",
          resolution_status: "resolved",
          resolved_block_id: "block-ak-22",
        }),
      ]),
    );
  });

  it("для 23.1 ПК ставит citation_target выше semantic hits", async () => {
    const context = createRetrievalContext({
      normalizedInput: "23.1 ПК",
      intent: "law_explanation",
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
            id: "block-pk-23-1",
            lawId: "law-pk",
            lawKey: "procedural_code",
            lawTitle: "Процессуальный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/pk/",
            blockText: "Статья 23.1 Порядок наложения штрафа.",
            articleNumberNormalized: "23.1",
          }),
          createLawBlock({
            id: "block-pk-ticket",
            lawId: "law-pk",
            lawKey: "procedural_code",
            lawTitle: "Процессуальный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/pk/",
            blockText: "Статья 19. При тикете применяется процессуальный порядок.",
            articleNumberNormalized: "19",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results[0]?.lawBlockId).toBe("block-pk-23-1");
    expect(result.results[0]?.metadata.citation?.source_channel).toBe("citation_target");
  });

  it("для 999 УК оставляет citation unresolved и не маркирует semantic hits как citation_target", async () => {
    const context = createRetrievalContext({
      normalizedInput: "999 УК",
      intent: "law_explanation",
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
            id: "block-uk-84",
            lawId: "law-uk",
            lawKey: "criminal_code",
            lawTitle: "Уголовный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/uk/",
            blockText: "Статья 84. Неисполнение обязательных правовых актов.",
            articleNumberNormalized: "84",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.retrievalDebug?.citation_resolution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          raw_citation: "999 ук",
          resolution_status: "unresolved",
          resolution_reason: "no_article",
        }),
      ]),
    );
    expect(result.retrievalDebug?.citation_target_count).toBe(0);
    expect(
      result.results.some((entry) => entry.metadata.citation?.source_channel === "citation_target"),
    ).toBe(false);
  });

  it("для ст. 23 ч.1 п. «в» ПК сохраняет citation_target и point gap в diagnostics", async () => {
    const context = createRetrievalContext({
      normalizedInput: "ст. 23 ч.1 п. «в» ПК",
      intent: "law_explanation",
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
            id: "block-pk-23",
            lawId: "law-pk",
            lawKey: "procedural_code",
            lawTitle: "Процессуальный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/pk/",
            blockText: "Статья 23. ч. 1 Обязанности сотрудника, выполняющего задержание.",
            articleNumberNormalized: "23",
          }),
          createLawBlock({
            id: "block-fbr-23",
            lawId: "law-fbr",
            lawKey: "government_code",
            lawTitle: "Закон о Федеральном бюро",
            topicUrl: "https://forum.gta5rp.com/threads/fbr/",
            blockText: "Статья 23. Полномочия подразделения.",
            articleNumberNormalized: "23",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results[0]?.lawBlockId).toBe("block-pk-23");
    expect(result.results[0]?.metadata.citation).toMatchObject({
      source_channel: "citation_target",
      citation_resolution_status: "partially_supported",
      citation_resolution_reason: "no_point_metadata",
      citation_match_strength: "article_with_gap",
    });
    expect(result.retrievalDebug?.citation_partially_supported_count).toBe(1);
    expect(result.retrievalDebug?.citation_resolution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          raw_citation: "ст. 23 ч.1 п. «в» пк",
          resolution_status: "partially_supported",
          resolution_reason: "no_point_metadata",
        }),
      ]),
    );
  });

  it("не меняет non-citation поведение и оставляет citation diagnostics пустыми", async () => {
    const context = createRetrievalContext({
      normalizedInput: "Можно ли задержать человека за маску?",
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
            id: "block-admin",
            lawId: "law-admin",
            lawKey: "administrative_code",
            lawTitle: "Административный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/admin/",
            blockText: "Статья 18. Использование масок запрещено и влечёт штраф.",
            articleNumberNormalized: "18",
          }),
          createLawBlock({
            id: "block-procedure",
            lawId: "law-procedure",
            lawKey: "procedural_code",
            lawTitle: "Процессуальный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/procedure/",
            blockText: "Статья 23.1. Допускается задержание и идентификация личности.",
            articleNumberNormalized: "23.1",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results[0]?.lawKey).toBe("administrative_code");
    expect(result.retrievalDebug?.citation_target_count).toBe(0);
    expect(result.retrievalDebug?.citation_resolution).toEqual([]);
  });

  it("дедуплицирует exact target и сохраняет source_channel citation_target", async () => {
    const context = createRetrievalContext({
      normalizedInput: "84 УК",
      intent: "law_explanation",
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
            id: "block-uk-84",
            lawId: "law-uk",
            lawKey: "criminal_code",
            lawTitle: "Уголовный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/uk/",
            blockText: "Статья 84. Неисполнение обязательных правовых актов.",
            articleNumberNormalized: "84",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results.filter((entry) => entry.lawBlockId === "block-uk-84")).toHaveLength(1);
    expect(result.results[0]?.metadata.citation?.source_channel).toBe("citation_target");
  });

  it("добавляет same-law companions после citation_target и не выводит companions из другого закона", async () => {
    const context = createRetrievalContext({
      normalizedInput: "22 ч.1 АК",
      intent: "law_explanation",
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
            id: "block-ak-22",
            lawId: "law-ak",
            lawKey: "administrative_code",
            lawTitle: "Административный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/ak/",
            blockText: "Статья 22. ч. 1 Нарушение порядка.",
            articleNumberNormalized: "22",
          }),
          createLawBlock({
            id: "block-ak-next",
            lawId: "law-ak",
            lawKey: "administrative_code",
            lawTitle: "Административный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/ak/",
            blockType: "unstructured",
            blockOrder: 2,
            blockTitle: "Комментарий",
            blockText: "Комментарий к статье 22 и порядок применения.",
          }),
          createLawBlock({
            id: "block-pk-22",
            lawId: "law-pk",
            lawKey: "procedural_code",
            lawTitle: "Процессуальный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/pk/",
            blockText: "Статья 22. Другая статья другого закона.",
            articleNumberNormalized: "22",
          }),
        ]),
        now: () => new Date("2026-04-20T12:00:00.000Z"),
      },
    );

    expect(result.results[0]?.metadata.citation?.source_channel).toBe("citation_target");
    expect(result.results[1]?.metadata.citation?.source_channel).toBe("citation_companion");
    expect(result.results[1]?.lawId).toBe("law-ak");
    expect(
      result.results.some(
        (entry) =>
          entry.metadata.citation?.source_channel === "citation_companion" && entry.lawId !== "law-ak",
      ),
    ).toBe(false);
  });
});
