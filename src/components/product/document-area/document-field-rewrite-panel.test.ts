import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DocumentFieldRewritePanel } from "@/components/product/document-area/document-field-rewrite-panel";

describe("DocumentFieldRewritePanel", () => {
  it("показывает user-safe copy без AI/debug wording", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentFieldRewritePanel, {
        sectionLabel: "Правовые основания",
        sourceText: "Исходный текст",
        suggestionText: "Уточнённая формулировка",
        basedOnUpdatedAt: "2026-04-27T10:00:00.000Z",
        onApply: () => {},
        onDismiss: () => {},
        onCopy: () => {},
      }),
    );

    expect(html).toContain("Обновлённая формулировка для раздела");
    expect(html).toContain("Правовые основания");
    expect(html).toContain("Вариант подготовлен по последней сохранённой версии документа");
    expect(html).toContain("Обновлённая формулировка");
    expect(html).toContain("Применить вариант");
    expect(html).toContain("Оставить исходный текст");
    expect(html).toContain("Скопировать вариант");
    expect(html).not.toContain("AI-предложение");
    expect(html).not.toContain("persisted");
  });

  it("показывает grounded summary в юридическом формате", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentFieldRewritePanel, {
        sectionLabel: "Суть нарушения",
        sourceText: "Исходный текст",
        suggestionText: "Формулировка с опорой на нормы",
        basedOnUpdatedAt: "2026-04-27T10:00:00.000Z",
        titlePrefix: "Вариант с опорой на нормы",
        supportingSummary:
          "Правовая опора: подтверждённые нормы закона (2). Проверьте, что формулировка действительно соответствует вашему случаю.",
        onApply: () => {},
        onDismiss: () => {},
        onCopy: () => {},
      }),
    );

    expect(html).toContain("Вариант с опорой на нормы для раздела");
    expect(html).toContain("Правовая опора: подтверждённые нормы закона (2).");
  });
});
