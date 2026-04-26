import { describe, expect, it } from "vitest";

import { selectQuestionAwareSourceExcerpt } from "@/server/legal-assistant/source-excerpt";

const longAttorneyRequestArticle = [
  "Статья 5. Адвокатский запрос",
  "ч. 1 Адвокат вправе направлять официальный адвокатский запрос в органы и организации по вопросам их компетенции.",
  "ч. 2 Органы и организации, которым направлен адвокатский запрос, должны дать на него ответ в течение одного календарного дня с момента его получения.",
  "ч. 3 В предоставлении адвокату запрошенных сведений может быть отказано, если адресат не располагает сведениями или информация покрывается государственной либо служебной тайной.",
  "ч. 4 Неправомерный отказ и нарушение сроков предоставления сведений влекут ответственность, установленную законодательством.",
].join("\n");

describe("source excerpt", () => {
  it("для deadline_question вытаскивает фрагмент со сроком ответа", () => {
    const excerpt = selectQuestionAwareSourceExcerpt({
      blockText: [
        "Статья 5. Адвокатский запрос",
        `ч. 1 ${"Адвокат вправе направлять официальный адвокатский запрос по вопросам компетенции органов и организаций. ".repeat(12)}`,
        "ч. 2 Органы и организации, которым направлен адвокатский запрос, должны дать на него ответ в течение одного календарного дня с момента его получения.",
        "ч. 3 В предоставлении адвокату запрошенных сведений может быть отказано.",
      ].join("\n"),
      primaryLegalIssueType: "deadline_question",
      normalizedInput: "какой срок ответа на адвокатский запрос",
      legalAnchors: ["attorney_request"],
      lawFamily: "advocacy_law",
      normRole: "primary_basis",
      articleNumber: "5",
      maxChars: 420,
    });

    expect(excerpt.wasTargeted).toBe(true);
    expect(excerpt.text).toContain("одного календарного дня");
    expect(excerpt.text.length).toBeLessThanOrEqual(420);
  });

  it("для refusal_question вытаскивает фрагмент с основаниями отказа", () => {
    const excerpt = selectQuestionAwareSourceExcerpt({
      blockText: longAttorneyRequestArticle,
      primaryLegalIssueType: "refusal_question",
      normalizedInput: "отказали в адвокатском запросе",
      legalAnchors: ["attorney_request"],
      lawFamily: "advocacy_law",
      normRole: "primary_basis",
      articleNumber: "5",
      maxChars: 420,
    });

    expect(excerpt.wasTargeted).toBe(true);
    expect(excerpt.text).toContain("может быть отказано");
    expect(excerpt.text).toContain("не располагает");
  });

  it("для sanction_question вытаскивает фрагмент с ответственностью", () => {
    const excerpt = selectQuestionAwareSourceExcerpt({
      blockText: longAttorneyRequestArticle,
      primaryLegalIssueType: "sanction_question",
      normalizedInput: "что грозит за неисполнение адвокатского запроса",
      legalAnchors: ["attorney_request", "sanction"],
      lawFamily: "advocacy_law",
      normRole: "primary_basis",
      articleNumber: "5",
      maxChars: 420,
    });

    expect(excerpt.wasTargeted).toBe(true);
    expect(excerpt.text).toContain("влекут ответственность");
  });

  it("использует fallback, если релевантных terms нет", () => {
    const excerpt = selectQuestionAwareSourceExcerpt({
      blockText: "Статья 1. Общие положения\nч. 1 Настоящий закон регулирует общие вопросы.",
      primaryLegalIssueType: "evidence_question",
      normalizedInput: "где видеозапись",
      legalAnchors: ["evidence"],
      lawFamily: "other",
      normRole: "background_only",
      articleNumber: "1",
      maxChars: 80,
    });

    expect(excerpt.wasTargeted).toBe(false);
    expect(excerpt.strategy).toBe("front_excerpt");
  });

  it("соблюдает budget на длинном сегменте", () => {
    const excerpt = selectQuestionAwareSourceExcerpt({
      blockText: [
        "Статья 8. Основания отказа",
        `ч. 1 ${"Отказ возможен при наличии оснований. ".repeat(30)}`,
      ].join("\n"),
      primaryLegalIssueType: "refusal_question",
      normalizedInput: "основания отказа",
      legalAnchors: ["exception"],
      lawFamily: "other",
      normRole: "exception",
      articleNumber: "8",
      maxChars: 160,
    });

    expect(excerpt.text.length).toBeLessThanOrEqual(160);
    expect(excerpt.wasTargeted).toBe(true);
  });
});
