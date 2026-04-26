import { describe, expect, it } from "vitest";

import {
  buildCitationReadinessAuditEntriesFromLawBlocks,
  DEFAULT_CITATION_READINESS_TEST_CITATIONS,
  runCitationReadinessAudit,
  type CitationReadinessAuditCorpusEntry,
} from "@/server/law-corpus/citation-readiness-audit";

function createCorpusEntry(input: {
  lawId: string;
  lawVersionId?: string;
  lawBlockId: string;
  lawTitle: string;
  lawKey: string;
  topicUrl?: string | null;
  blockType?: string;
  blockOrder: number;
  articleNumberNormalized?: string | null;
  blockTitle?: string | null;
  blockText: string;
}): CitationReadinessAuditCorpusEntry {
  return {
    lawId: input.lawId,
    lawVersionId: input.lawVersionId ?? `${input.lawId}-version-1`,
    lawBlockId: input.lawBlockId,
    lawTitle: input.lawTitle,
    lawKey: input.lawKey,
    topicUrl: input.topicUrl ?? "https://forum.gta5rp.com/threads/test/",
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

describe("citation readiness audit", () => {
  it("flatten helper собирает audit entries из repo-shaped law blocks", () => {
    const entries = buildCitationReadinessAuditEntriesFromLawBlocks([
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
        lawKey: "administrative_code",
        articleNumberNormalized: "1",
      }),
    ]);
  });

  it("поддерживает alias resolution и exact article lookup для базового fixed set", () => {
    const report = runCitationReadinessAudit({
      corpusEntries: createSyntheticCorpus(),
      citations: DEFAULT_CITATION_READINESS_TEST_CITATIONS,
    });

    const akDetail = report.details.find((detail) => detail.raw_citation === "АК 22 ч.1");
    const pkDetail = report.details.find((detail) => detail.raw_citation === "23.1 ПК");
    const ukDetail = report.details.find((detail) => detail.raw_citation === "84 УК");
    const advocacyDetail = report.details.find(
      (detail) => detail.raw_citation === "5 ч.4 Закона об адвокатуре",
    );

    expect(akDetail).toEqual(
      expect.objectContaining({
        detected_alias: "АК",
        candidate_law_family: "administrative_code",
        article_number: "22",
        part_number: "1",
        article_found: true,
        status: "resolved",
      }),
    );
    expect(pkDetail).toEqual(
      expect.objectContaining({
        detected_alias: "ПК",
        candidate_law_family: "procedural_code",
        article_number: "23.1",
        article_found: true,
        status: "resolved",
      }),
    );
    expect(ukDetail).toEqual(
      expect.objectContaining({
        detected_alias: "УК",
        candidate_law_family: "criminal_code",
        article_number: "84",
        article_found: true,
        status: "resolved",
      }),
    );
    expect(advocacyDetail).toEqual(
      expect.objectContaining({
        detected_alias: "Закон об адвокатуре",
        candidate_law_family: "advocacy_law",
        article_number: "5",
        part_number: "4",
        article_found: true,
        status: "resolved",
      }),
    );
  });

  it("отмечает unresolved citation для несуществующей статьи", () => {
    const report = runCitationReadinessAudit({
      corpusEntries: createSyntheticCorpus(),
      citations: ["999 УК"],
    });

    expect(report.details).toEqual([
      expect.objectContaining({
        raw_citation: "999 УК",
        detected_alias: "УК",
        candidate_law_family: "criminal_code",
        article_number: "999",
        article_found: false,
        status: "unresolved",
        unresolved_reason: "no_article",
      }),
    ]);
  });

  it("не делает cross-family substitution для 22 ч.1 АК и фиксирует collision candidates", () => {
    const report = runCitationReadinessAudit({
      corpusEntries: createSyntheticCorpus(),
      citations: ["22 ч.1 АК"],
    });

    expect(report.details[0]).toEqual(
      expect.objectContaining({
        raw_citation: "22 ч.1 АК",
        candidate_law_family: "administrative_code",
        article_found: true,
        status: "resolved",
      }),
    );
    expect(report.details[0]?.matched_blocks.map((block) => block.law_id)).toEqual(["law-ak"]);
    expect(report.details[0]?.collision_candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_id: "law-pk",
          law_family: "procedural_code",
          article_number: "22",
        }),
        expect.objectContaining({
          law_id: "law-uk",
          law_family: "criminal_code",
          article_number: "22",
        }),
      ]),
    );
  });

  it("не считает citation fully resolved, если часть или пункт не подтверждены метаданными текста", () => {
    const corpusEntries = createSyntheticCorpus().map((entry) => {
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

    const report = runCitationReadinessAudit({
      corpusEntries,
      citations: ["5 ч.4 Закона об адвокатуре", "ст. 23 ч.1 п. «в» ПК"],
    });

    expect(report.details).toEqual([
      expect.objectContaining({
        raw_citation: "5 ч.4 Закона об адвокатуре",
        status: "partially_supported",
        unresolved_reason: "no_part_metadata",
      }),
      expect.objectContaining({
        raw_citation: "ст. 23 ч.1 п. «в» ПК",
        status: "partially_supported",
        unresolved_reason: "no_point_metadata",
      }),
    ]);
  });

  it("собирает heuristic readiness hits для note/exception/cross-reference и companion candidates", () => {
    const report = runCitationReadinessAudit({
      corpusEntries: createSyntheticCorpus(),
      citations: ["АК 22 ч.1"],
    });

    expect(report.details[0]?.note_exception_comment_hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ marker_type: "note", law_block_id: "ak-22" }),
        expect.objectContaining({ marker_type: "exception", law_block_id: "ak-22" }),
        expect.objectContaining({ marker_type: "comment", law_block_id: "ak-22-note" }),
      ]),
    );
    expect(report.details[0]?.cross_reference_hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ marker_type: "cross_reference", law_block_id: "ak-22" }),
      ]),
    );
    expect(report.details[0]?.same_article_companion_candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_block_id: "ak-22-note",
          reason: "same_article_number",
        }),
      ]),
    );
  });

  it("помечает ambiguous, если в одной law family у статьи несколько конкурирующих законов", () => {
    const report = runCitationReadinessAudit({
      corpusEntries: [
        ...createSyntheticCorpus(),
        createCorpusEntry({
          lawId: "law-ak-2",
          lawBlockId: "ak2-22",
          lawTitle: "Административный кодекс округа",
          lawKey: "administrative_code_secondary",
          blockOrder: 50,
          articleNumberNormalized: "22",
          blockTitle: "Статья 22. Альтернативная норма",
          blockText: "Статья 22. Альтернативная норма административного характера.",
        }),
      ],
      citations: ["22 ч.1 АК"],
    });

    expect(report.details[0]).toEqual(
      expect.objectContaining({
        status: "ambiguous",
        article_found: true,
      }),
    );
  });
});
