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
    expect(html).toContain("Текст сформирован, но перед подачей рекомендуется проверить указанные замечания.");
    expect(html).toContain("Что желательно уточнить");
    expect(html).toContain("Что проверить перед подачей");
    expect(html).toContain("Предупреждения");
    expect(html).toContain("Использованные нормы");
    expect(html).toContain("АК, ст. 22, ч. 1");
    expect(html).toContain("Улучшенный связный текст для жалобы.");
    expect(html).toContain("Неясная дата/время");
    expect(html).toContain("Проверьте категоричность");
    expect(html).toContain("Применить текст");
    expect(html).toContain("Закрыть");
  });
});
