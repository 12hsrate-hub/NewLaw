import { describe, expect, it } from "vitest";

import {
  formatComplaintNarrativeUnavailableMessage,
  formatDocumentRewriteBlockedMessage,
  formatDocumentRewriteUnavailableMessage,
  formatGroundedRewriteInsufficientCorpusMessage,
  resolveComplaintNarrativeReviewStatus,
} from "@/components/product/document-area/document-ai-review-copy";

describe("document ai review copy helpers", () => {
  it("собирает user-safe copy для blocked standard rewrite", () => {
    expect(formatDocumentRewriteBlockedMessage("standard", ["В этой секции пока нет текста для улучшения."]))
      .toBe("Сначала заполните этот фрагмент текста, чтобы улучшить формулировку.");

    expect(formatDocumentRewriteBlockedMessage("standard", ["Для этой секции AI rewrite в v1 не поддерживается."]))
      .toBe(
        "Исходный текст сохранён. Не удалось подготовить новый вариант — проверьте содержание раздела и повторите попытку.",
      );
  });

  it("собирает user-safe copy для grounded rewrite", () => {
    expect(formatDocumentRewriteBlockedMessage("grounded", ["В этой секции пока нет текста для grounded улучшения."]))
      .toBe("Сначала заполните этот фрагмент текста, чтобы проверить его с опорой на нормы.");

    expect(formatDocumentRewriteUnavailableMessage("grounded")).toBe(
      "Проверка с опорой на нормы временно недоступна. Исходный текст сохранён, можно попробовать ещё раз позже.",
    );
    expect(formatGroundedRewriteInsufficientCorpusMessage()).toBe(
      "Для этого фрагмента пока недостаточно подтверждённых правовых оснований. Проверьте формулировку и при необходимости добавьте нормы вручную.",
    );
  });

  it("собирает user-safe copy для complaint narrative fallback branches", () => {
    expect(formatComplaintNarrativeUnavailableMessage("unavailable")).toBe(
      "Не удалось улучшить описание. Исходный текст сохранён, можно попробовать ещё раз.",
    );
    expect(formatComplaintNarrativeUnavailableMessage("invalid-output")).toBe(
      "Не удалось проверить предложенный текст. Исходное описание сохранено, можно повторить попытку позже.",
    );
  });

  it("определяет уровни review для complaint narrative", () => {
    expect(
      resolveComplaintNarrativeReviewStatus({
        riskFlags: [],
        shouldSendToReview: false,
      }),
    ).toEqual({
      title: "Текст можно использовать как основу",
      description:
        "Существенных замечаний по этому варианту нет. Перед использованием достаточно обычной проверки.",
      tone: "ready",
    });

    expect(
      resolveComplaintNarrativeReviewStatus({
        riskFlags: ["possible_overclaiming"],
        shouldSendToReview: true,
      }),
    ).toEqual({
      title: "Текст нужно проверить перед использованием",
      description:
        "Текст можно использовать как основу, но перед подачей лучше проверить замечания ниже.",
      tone: "review",
    });

    expect(
      resolveComplaintNarrativeReviewStatus({
        riskFlags: ["insufficient_facts"],
        shouldSendToReview: false,
      }),
    ).toEqual({
      title: "Перед использованием текст нужно доработать",
      description:
        "В тексте пока не хватает важных фактов или точной правовой опоры. Сначала лучше уточнить замечания ниже.",
      tone: "rework",
    });
  });
});
