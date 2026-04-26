import { describe, expect, it } from "vitest";

import { parseExplicitLegalCitations } from "@/server/legal-core/legal-citation-parser";
import {
  buildLegalCitationResolutionReport,
  buildLegalCitationResolverEntriesFromLawBlocks,
  resolveExplicitLegalCitation,
  type LegalCitationResolverCorpusEntry,
} from "@/server/law-corpus/legal-citation-resolver";

function createCorpusEntry(input: {
  lawId: string;
  lawVersionId?: string;
  lawBlockId: string;
  lawTitle: string;
  lawKey: string;
  topicUrl?: string | null;
  lawKind?: "primary" | "supplement" | null;
  relatedPrimaryLawId?: string | null;
  classificationOverride?: "primary" | "supplement" | null;
  blockType?: string;
  blockOrder: number;
  articleNumberNormalized?: string | null;
  blockTitle?: string | null;
  blockText: string;
}): LegalCitationResolverCorpusEntry {
  return {
    lawId: input.lawId,
    lawVersionId: input.lawVersionId ?? `${input.lawId}-version-1`,
    lawBlockId: input.lawBlockId,
    lawTitle: input.lawTitle,
    lawKey: input.lawKey,
    topicUrl: input.topicUrl ?? "https://forum.gta5rp.com/threads/test/",
    lawKind: input.lawKind ?? "primary",
    relatedPrimaryLawId: input.relatedPrimaryLawId ?? null,
    classificationOverride: input.classificationOverride ?? null,
    blockType: input.blockType ?? "article",
    blockOrder: input.blockOrder,
    articleNumberNormalized: input.articleNumberNormalized ?? null,
    blockTitle: input.blockTitle ?? null,
    blockText: input.blockText,
  };
}

function createSyntheticCorpus() {
  return [
    createCorpusEntry({
      lawId: "law-ak",
      lawBlockId: "ak-22",
      lawTitle: "Административный кодекс",
      lawKey: "administrative_code",
      blockOrder: 10,
      articleNumberNormalized: "22",
      blockTitle: "Статья 22. Нарушение порядка",
      blockText:
        "Статья 22. ч. 1 Сотрудник обязан оформить нарушение. Примечание: допускается ссылка на материалы дела. За исключением случаев, предусмотренных ст. 23. В соответствии со ст. 23 применяются дополнительные меры.",
    }),
    createCorpusEntry({
      lawId: "law-ak",
      lawBlockId: "ak-22-note",
      lawTitle: "Административный кодекс",
      lawKey: "administrative_code",
      blockType: "unstructured",
      blockOrder: 11,
      articleNumberNormalized: "22",
      blockTitle: "Примечание к статье 22",
      blockText: "Комментарий к статье 22 и соседним частям.",
    }),
    createCorpusEntry({
      lawId: "law-ak",
      lawBlockId: "ak-23",
      lawTitle: "Административный кодекс",
      lawKey: "administrative_code",
      blockOrder: 12,
      articleNumberNormalized: "23",
      blockTitle: "Статья 23. Дополнительные меры",
      blockText: "Статья 23. Дополнительные меры по делу.",
    }),
    createCorpusEntry({
      lawId: "law-pk",
      lawBlockId: "pk-23",
      lawTitle: "Процессуальный кодекс",
      lawKey: "procedural_code",
      blockOrder: 20,
      articleNumberNormalized: "23",
      blockTitle: "Статья 23. Порядок фиксации",
      blockText:
        "Статья 23. ч. 1 п. «в» При задержании допускается фиксация процессуальных действий.",
    }),
    createCorpusEntry({
      lawId: "law-pk",
      lawBlockId: "pk-22",
      lawTitle: "Процессуальный кодекс",
      lawKey: "procedural_code",
      blockOrder: 21,
      articleNumberNormalized: "22",
      blockTitle: "Статья 22. Процедура уведомления",
      blockText: "Статья 22. Процедура уведомления участников.",
    }),
    createCorpusEntry({
      lawId: "law-pk",
      lawBlockId: "pk-23-1",
      lawTitle: "Процессуальный кодекс",
      lawKey: "procedural_code",
      blockOrder: 22,
      articleNumberNormalized: "23.1",
      blockTitle: "Статья 23.1. Порядок фиксации",
      blockText:
        "Статья 23.1. ч. 1 п. «в» При задержании допускается фиксация процессуальных действий.",
    }),
    createCorpusEntry({
      lawId: "law-uk",
      lawBlockId: "uk-22",
      lawTitle: "Уголовный кодекс",
      lawKey: "criminal_code",
      blockOrder: 30,
      articleNumberNormalized: "22",
      blockTitle: "Статья 22. Общие положения ответственности",
      blockText: "Статья 22. Общие положения ответственности.",
    }),
    createCorpusEntry({
      lawId: "law-uk",
      lawBlockId: "uk-84",
      lawTitle: "Уголовный кодекс",
      lawKey: "criminal_code",
      blockOrder: 31,
      articleNumberNormalized: "84",
      blockTitle: "Статья 84. Отдельный состав",
      blockText: "Статья 84. Уголовная ответственность за воспрепятствование.",
    }),
    createCorpusEntry({
      lawId: "law-advocacy",
      lawBlockId: "adv-5",
      lawTitle: "Закон об адвокатуре и адвокатской деятельности",
      lawKey: "advocacy_law",
      blockOrder: 40,
      articleNumberNormalized: "5",
      blockTitle: "Статья 5. Официальный адвокатский запрос",
      blockText: "Статья 5. ч. 4 Ответ на официальный адвокатский запрос дается в установленный срок.",
    }),
  ];
}

describe("legal citation resolver", () => {
  it("flatten helper собирает resolver entries из repo-shaped current law blocks", () => {
    const entries = buildLegalCitationResolverEntriesFromLawBlocks([
      {
        id: "block-1",
        blockType: "article",
        blockOrder: 1,
        blockTitle: "Статья 1",
        blockText: "Текст статьи.",
        articleNumberNormalized: "1",
        lawVersion: {
          id: "version-1",
          currentForLaw: {
            id: "law-1",
            lawKey: "administrative_code",
            title: "Административный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/ak/",
            lawKind: "primary",
            relatedPrimaryLawId: null,
            classificationOverride: null,
          },
        },
      },
    ]);

    expect(entries).toEqual([
      expect.objectContaining({
        lawId: "law-1",
        lawVersionId: "version-1",
        lawBlockId: "block-1",
        lawTitle: "Административный кодекс",
        lawKind: "primary",
      }),
    ]);
  });

  it("резолвит 22 ч.1 АК только в administrative_code и пишет cross-family collisions в diagnostics", () => {
    const citation = parseExplicitLegalCitations("22 ч.1 АК")[0]!;
    const report = resolveExplicitLegalCitation({
      citation,
      corpusEntries: createSyntheticCorpus(),
    });

    expect(report).toEqual(
      expect.objectContaining({
        resolutionStatus: "resolved",
        resolutionReason: null,
        resolvedLawSourceId: "law-ak",
        resolvedBlockId: "ak-22",
        matchedLawTitle: "Административный кодекс",
        matchedArticleNumber: "22",
      }),
    );
    expect(report.partSupport).toEqual({
      requestedPart: "1",
      textualHintFound: true,
      diagnosticGap: null,
    });
    expect(report.collisionCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lawId: "law-pk",
          lawFamily: "procedural_code",
          articleNumber: "22",
        }),
        expect.objectContaining({
          lawId: "law-uk",
          lawFamily: "criminal_code",
          articleNumber: "22",
        }),
      ]),
    );
  });

  it("резолвит 23.1 ПК в procedural_code", () => {
    const report = resolveExplicitLegalCitation({
      citation: parseExplicitLegalCitations("23.1 ПК")[0]!,
      corpusEntries: createSyntheticCorpus(),
    });

    expect(report).toEqual(
      expect.objectContaining({
        resolutionStatus: "resolved",
        resolvedLawSourceId: "law-pk",
        resolvedBlockId: "pk-23-1",
        matchedArticleNumber: "23.1",
      }),
    );
  });

  it("резолвит 84 УК в criminal_code", () => {
    const report = resolveExplicitLegalCitation({
      citation: parseExplicitLegalCitations("84 УК")[0]!,
      corpusEntries: createSyntheticCorpus(),
    });

    expect(report).toEqual(
      expect.objectContaining({
        resolutionStatus: "resolved",
        resolvedLawSourceId: "law-uk",
        resolvedBlockId: "uk-84",
        matchedArticleNumber: "84",
      }),
    );
  });

  it("резолвит Закон об адвокатуре ст. 5 ч.4 при наличии textual ч.4", () => {
    const report = resolveExplicitLegalCitation({
      citation: parseExplicitLegalCitations("5 ч.4 Закона об адвокатуре")[0]!,
      corpusEntries: createSyntheticCorpus(),
    });

    expect(report).toEqual(
      expect.objectContaining({
        resolutionStatus: "resolved",
        resolvedLawSourceId: "law-advocacy",
        resolvedBlockId: "adv-5",
        matchedArticleNumber: "5",
      }),
    );
    expect(report.partSupport).toEqual({
      requestedPart: "4",
      textualHintFound: true,
      diagnosticGap: null,
    });
  });

  it("возвращает unresolved no_article для 999 УК", () => {
    const report = resolveExplicitLegalCitation({
      citation: parseExplicitLegalCitations("999 УК")[0]!,
      corpusEntries: createSyntheticCorpus(),
    });

    expect(report).toEqual(
      expect.objectContaining({
        resolutionStatus: "unresolved",
        resolutionReason: "no_article",
        resolvedLawSourceId: null,
      }),
    );
  });

  it("для ст. 23 ч.1 п. «в» ПК не подменяет family и сохраняет collision diagnostics", () => {
    const report = resolveExplicitLegalCitation({
      citation: parseExplicitLegalCitations("ст. 23 ч.1 п. «в» ПК")[0]!,
      corpusEntries: createSyntheticCorpus(),
    });

    expect(report).toEqual(
      expect.objectContaining({
        resolutionStatus: "resolved",
        resolutionReason: null,
        resolvedLawSourceId: "law-pk",
        resolvedBlockId: "pk-23",
        matchedArticleNumber: "23",
      }),
    );
    expect(report.pointSupport.textualHintFound).toBe(true);
    expect(report.collisionCandidates.some((candidate) => candidate.lawFamily === "administrative_code")).toBe(true);
  });

  it("возвращает same_family_multi_law_ambiguous для нескольких законов той же family", () => {
    const report = resolveExplicitLegalCitation({
      citation: {
        ...parseExplicitLegalCitations("22 ч.1 АК")[0]!,
        lawTitleHint: null,
      },
      corpusEntries: [
        ...createSyntheticCorpus(),
        createCorpusEntry({
          lawId: "law-ak-2",
          lawBlockId: "ak2-22",
          lawTitle: "Альтернативный административный кодекс",
          lawKey: "administrative_code_secondary",
          blockOrder: 50,
          articleNumberNormalized: "22",
          blockTitle: "Статья 22. Альтернативная норма",
          blockText: "Статья 22. ч. 1 Альтернативная норма административного характера.",
          lawKind: "primary",
        }),
      ],
    });

    expect(report).toEqual(
      expect.objectContaining({
        resolutionStatus: "ambiguous",
        resolutionReason: "same_family_multi_law_ambiguous",
        matchedArticleNumber: "22",
      }),
    );
  });

  it("предпочитает primary law над supplement, если article совпадает", () => {
    const citation = parseExplicitLegalCitations("22 ч.1 АК")[0]!;
    const report = resolveExplicitLegalCitation({
      citation: {
        ...citation,
        lawTitleHint: "Административный кодекс",
      },
      corpusEntries: [
        createCorpusEntry({
          lawId: "law-primary",
          lawBlockId: "primary-22",
          lawTitle: "Административный кодекс",
          lawKey: "administrative_code",
          blockOrder: 10,
          articleNumberNormalized: "22",
          blockTitle: "Статья 22. Основная норма",
          blockText: "Статья 22. ч. 1 Основная норма.",
          lawKind: "primary",
          relatedPrimaryLawId: null,
        }),
        createCorpusEntry({
          lawId: "law-supplement",
          lawBlockId: "supp-22",
          lawTitle: "Дополнение к Административному кодексу",
          lawKey: "administrative_code_supplement",
          blockOrder: 20,
          articleNumberNormalized: "22",
          blockTitle: "Статья 22. Дополнительная норма",
          blockText: "Статья 22. ч. 1 Дополнительная норма.",
          lawKind: "supplement",
          relatedPrimaryLawId: "law-primary",
        }),
      ],
    });

    expect(report).toEqual(
      expect.objectContaining({
        resolutionStatus: "resolved",
        resolvedLawSourceId: "law-primary",
      }),
    );
  });

  it("допускает supplement только при явном lawTitleHint advantage", () => {
    const citation = parseExplicitLegalCitations("22 ч.1 АК")[0]!;
    const report = resolveExplicitLegalCitation({
      citation: {
        ...citation,
        lawTitleHint: "Специальное дополнение к Административному кодексу",
      },
      corpusEntries: [
        createCorpusEntry({
          lawId: "law-primary",
          lawBlockId: "primary-22",
          lawTitle: "Административный кодекс",
          lawKey: "administrative_code",
          blockOrder: 10,
          articleNumberNormalized: "22",
          blockTitle: "Статья 22. Основная норма",
          blockText: "Статья 22. ч. 1 Основная норма.",
          lawKind: "primary",
          relatedPrimaryLawId: null,
        }),
        createCorpusEntry({
          lawId: "law-supplement",
          lawBlockId: "supp-22",
          lawTitle: "Специальное дополнение к Административному кодексу",
          lawKey: "administrative_code_supplement",
          blockOrder: 20,
          articleNumberNormalized: "22",
          blockTitle: "Статья 22. Специальная норма",
          blockText: "Статья 22. ч. 1 Специальная норма.",
          lawKind: "supplement",
          relatedPrimaryLawId: "law-primary",
        }),
      ],
    });

    expect(report).toEqual(
      expect.objectContaining({
        resolutionStatus: "resolved",
        resolvedLawSourceId: "law-supplement",
      }),
    );
  });

  it("возвращает partially_supported, если part или point не подтверждены textually", () => {
    const corpus = createSyntheticCorpus().map((entry) => {
      if (entry.lawBlockId === "adv-5") {
        return {
          ...entry,
          blockText: "Статья 5. Ответ на официальный адвокатский запрос дается в установленный срок.",
        };
      }

      if (entry.lawBlockId === "pk-23") {
        return {
          ...entry,
          blockText: "Статья 23. ч. 1 При задержании допускается фиксация процессуальных действий.",
        };
      }

      return entry;
    });

    const partReport = resolveExplicitLegalCitation({
      citation: parseExplicitLegalCitations("5 ч.4 Закона об адвокатуре")[0]!,
      corpusEntries: corpus,
    });
    const pointReport = resolveExplicitLegalCitation({
      citation: parseExplicitLegalCitations("ст. 23 ч.1 п. «в» ПК")[0]!,
      corpusEntries: corpus,
    });

    expect(partReport).toEqual(
      expect.objectContaining({
        resolutionStatus: "partially_supported",
        resolutionReason: "no_part_metadata",
      }),
    );
    expect(pointReport).toEqual(
      expect.objectContaining({
        resolutionStatus: "partially_supported",
        resolutionReason: "no_point_metadata",
      }),
    );
  });

  it("собирает heuristic hits и same-law companion candidates", () => {
    const report = resolveExplicitLegalCitation({
      citation: parseExplicitLegalCitations("АК 22 ч.1")[0]!,
      corpusEntries: createSyntheticCorpus(),
    });

    expect(report.noteExceptionCommentHits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ markerType: "note", lawBlockId: "ak-22" }),
        expect.objectContaining({ markerType: "comment", lawBlockId: "ak-22-note" }),
        expect.objectContaining({ markerType: "exception", lawBlockId: "ak-22" }),
      ]),
    );
    expect(report.crossReferenceHits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ markerType: "cross_reference", lawBlockId: "ak-22" }),
      ]),
    );
    expect(report.sameLawCompanionCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lawBlockId: "ak-22-note",
          reason: "same_article_number",
        }),
        expect.objectContaining({
          lawBlockId: "ak-22-note",
          reason: "neighboring_block",
        }),
      ]),
    );
    expect(report.sameLawCompanionCandidates.every((candidate) => candidate.lawId === "law-ak")).toBe(true);
  });

  it("integration-level helper contract работает с parser output", () => {
    const citation = parseExplicitLegalCitations("что значит 84 УК")[0]!;
    const report = buildLegalCitationResolutionReport({
      citation,
      corpusEntries: createSyntheticCorpus(),
    });

    expect(report).toEqual(
      expect.objectContaining({
        rawCitation: "84 ук",
        lawCode: "УК",
        lawFamily: "criminal_code",
        resolutionStatus: "resolved",
        resolvedLawSourceId: "law-uk",
      }),
    );
  });
});
