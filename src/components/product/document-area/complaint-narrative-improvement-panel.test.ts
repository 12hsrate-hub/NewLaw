import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComplaintNarrativeImprovementPanel } from "@/components/product/document-area/complaint-narrative-improvement-panel";

describe("ComplaintNarrativeImprovementPanel", () => {
  it("рендерит preview, замечания и использованные нормы", () => {
    const html = renderToStaticMarkup(
      createElement(ComplaintNarrativeImprovementPanel, {
        suggestion: {
          sourceText: "Исходное описание ситуации",
          improvedText: "Улучшенный связный текст для жалобы.",
          basedOnUpdatedAt: "2026-04-27T10:00:00.000Z",
          legalBasisUsed: [
            {
              law_name: "АК",
              article: "22",
              part: "1",
              reason: "Норма описывает состав вменяемого деяния.",
            },
          ],
          usedFacts: ["Сотрудник не разъяснил причину задержания"],
          missingFacts: ["Уточнить, кто именно составлял материалы"],
          reviewNotes: ["Проверить, относится ли дата ко времени задержания."],
          riskFlags: ["ambiguous_date_time", "possible_overclaiming"],
          shouldSendToReview: true,
          usageMeta: {
            featureKey: "complaint_narrative_improvement",
            providerKey: "openai",
            proxyKey: "primary",
            model: "gpt-5.4-mini",
            latencyMs: 1200,
            finishReason: "stop",
            attemptedProxyKeys: ["primary"],
            improvedTextLength: 1280,
            lengthMode: "normal",
          },
        },
        onApply: () => {},
        onDismiss: () => {},
        onCopy: () => {},
      }),
    );

    expect(html).toContain("Предложенный улучшенный текст");
    expect(html).toContain("Текст уже можно использовать как основу, но перед подачей лучше проверить замечания ниже.");
    expect(html).toContain("Что ещё стоит уточнить");
    expect(html).toContain("Что стоит проверить перед подачей");
    expect(html).toContain("На что обратить внимание");
    expect(html).toContain("Использованные нормы");
    expect(html).toContain("АК, ст. 22, ч. 1");
    expect(html).toContain("Улучшенный связный текст для жалобы.");
    expect(html).toContain("Уточните назначение даты/времени");
    expect(html).toContain("Проверьте категоричность формулировок");
    expect(html).toContain("Применить текст");
    expect(html).toContain("Закрыть");
  });

  it("не показывает пустой legal basis block, если нормы не использовались", () => {
    const html = renderToStaticMarkup(
      createElement(ComplaintNarrativeImprovementPanel, {
        suggestion: {
          sourceText: "Исходное описание ситуации",
          improvedText: "Улучшенный текст без ссылок на нормы.",
          basedOnUpdatedAt: "2026-04-27T10:00:00.000Z",
          legalBasisUsed: [],
          usedFacts: ["Факт 1"],
          missingFacts: ["Уточнить хронологию"],
          reviewNotes: ["Проверить точную дату процессуального действия."],
          riskFlags: ["insufficient_facts"],
          shouldSendToReview: false,
          usageMeta: {
            featureKey: "complaint_narrative_improvement",
            providerKey: "openai",
            proxyKey: "primary",
            model: "gpt-5.4-mini",
            latencyMs: 900,
            finishReason: "stop",
            attemptedProxyKeys: ["primary"],
            improvedTextLength: 980,
            lengthMode: "normal",
          },
        },
        onApply: () => {},
        onDismiss: () => {},
        onCopy: () => {},
      }),
    );

    expect(html).toContain("Что ещё стоит уточнить");
    expect(html).toContain("Что стоит проверить перед подачей");
    expect(html).not.toContain("Использованные нормы");
    expect(html).not.toContain("Нормы не добавлялись");
  });
});
