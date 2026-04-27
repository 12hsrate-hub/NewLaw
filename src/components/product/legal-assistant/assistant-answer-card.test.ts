import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantAnswerCard } from "@/components/product/legal-assistant/assistant-answer-card";

describe("AssistantAnswerCard", () => {
  it("скрывает corpus snapshot и показывает человекочитаемую правовую опору", () => {
    const html = renderToStaticMarkup(
      createElement(AssistantAnswerCard, {
        answer: {
          question: "Можно ли оспорить отказ?",
          sections: {
            summary: "Да, при наличии оснований.",
            normativeAnalysis: "Нормы допускают обжалование.",
            precedentAnalysis: "Есть поддерживающие прецеденты.",
            interpretation: "Нужно проверить факты дела.",
          },
          metadata: {
            combinedRetrievalRevision: {
              combinedCorpusSnapshotHash: "hash-123",
            },
            references: [
              {
                sourceKind: "law",
                lawId: "law-1",
                lawKey: "law_key",
                lawTitle: "Закон о заявлениях",
                lawVersionId: "version-1",
                lawBlockId: "law-block-1",
                blockType: "article",
                blockOrder: 2,
                articleNumberNormalized: null,
                snippet: "Закон допускает подачу жалобы.",
                sourceTopicUrl: "https://example.com/law",
                sourcePosts: [],
              },
              {
                sourceKind: "precedent",
                precedentId: "precedent-1",
                precedentKey: "precedent_key",
                precedentTitle: "Прецедент по отказу",
                precedentVersionId: "version-1",
                precedentBlockId: "precedent-block-1",
                blockType: "paragraph",
                blockOrder: 3,
                validityStatus: "limited",
                snippet: "Прецедент подтверждает возможность спора.",
                sourceTopicUrl: "https://example.com/precedent",
                sourceTopicTitle: "Прецедент",
                sourcePosts: [],
              },
            ],
          },
          status: "answered",
        },
      }),
    );

    expect(html).toContain("Ответ основан на найденных правовых источниках");
    expect(html).toContain("Правовые источники");
    expect(html).toContain("Фрагмент закона");
    expect(html).toContain("Нужно применять с оговорками");
    expect(html).toContain("Фрагмент судебного прецедента");
    expect(html).not.toContain("corpus snapshot");
    expect(html).not.toContain("hash-123");
    expect(html).not.toContain("Блок article #2");
  });

  it("показывает мягкое предупреждение, когда подтверждённой опоры не хватает", () => {
    const html = renderToStaticMarkup(
      createElement(AssistantAnswerCard, {
        answer: {
          question: "Какие риски есть?",
          sections: {
            summary: "Ответ требует уточнения.",
            normativeAnalysis: "Прямых норм не найдено.",
            precedentAnalysis: "Прецеденты не подтверждены.",
            interpretation: "Нужна дополнительная проверка.",
          },
          metadata: null,
          status: "no_norms",
        },
      }),
    );

    expect(html).toContain("Проверьте ответ перед использованием");
    expect(html).toContain("Часть выводов не подтверждена прямыми правовыми источниками.");
  });
});
