import { describe, expect, it } from "vitest";

import { buildAssistantRetrievalQuery } from "@/server/legal-core/assistant-retrieval-query";

describe("assistant retrieval query", () => {
  it("добавляет правовые якоря для вопроса про маску и задержание", () => {
    const query = buildAssistantRetrievalQuery({
      normalizedQuestion: "Можно ли задержать человека за ношение маски?",
      intent: "situation_analysis",
    });

    expect(query).toContain("административный кодекс");
    expect(query).toContain("процессуальный кодекс");
    expect(query).toContain("скрытие личности");
    expect(query).toContain("тикет");
  });

  it("добавляет видеозапись и процессуальные якоря для body-cam вопроса", () => {
    const query = buildAssistantRetrievalQuery({
      normalizedQuestion: "если сотрудник не вел бодикам это нарушение",
      intent: "evidence_check",
    });

    expect(query).toContain("процессуальный кодекс");
    expect(query).toContain("видеозапись задержания");
    expect(query).toContain("body-cam");
  });

  it("добавляет адвокатский запрос и уголовно-правовой якорь", () => {
    const query = buildAssistantRetrievalQuery({
      normalizedQuestion: "если руководство не ответило на адвокатский запрос",
      intent: "law_explanation",
    });

    expect(query).toContain("официальный адвокатский запрос");
    expect(query).toContain("уголовный кодекс");
    expect(query).toContain("неисполнение правовых актов");
  });
});
