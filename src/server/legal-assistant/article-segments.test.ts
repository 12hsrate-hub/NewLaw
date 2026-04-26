import { describe, expect, it } from "vitest";

import { parseArticleSegments } from "@/server/legal-assistant/article-segments";

describe("article segments", () => {
  it("разбивает article 5-like текст на heading, note и части", () => {
    const segments = parseArticleSegments(
      [
        "Статья 5. Адвокатский запрос",
        "ч. 1 Адвокат вправе направлять официальный адвокатский запрос (далее - адвокатский запрос).",
        "Примечание: Перед направлением адвокатского запроса его необходимо опубликовать в установленном порядке.",
        "ч. 2 Органы и организации должны дать на него ответ в течение одного календарного дня.",
        "ч. 4 В предоставлении сведений может быть отказано, если адресат не располагает сведениями или информация покрывается тайной.",
        "ч. 5 Неправомерный отказ и нарушение сроков влекут ответственность.",
      ].join("\n"),
    );

    expect(segments.map((segment) => segment.segmentType)).toEqual([
      "article_heading",
      "part",
      "note",
      "part",
      "part",
      "part",
    ]);
    expect(segments.map((segment) => segment.marker)).toEqual([
      null,
      "ч. 1",
      "Примечание",
      "ч. 2",
      "ч. 4",
      "ч. 5",
    ]);
  });

  it("не бросает исключение на malformed markers", () => {
    expect(() =>
      parseArticleSegments(
        [
          "Статья 10. Особый порядок",
          "ч. Основной порядок описан без номера части.",
          "Примечание к статье без двоеточия",
        ].join("\n"),
      ),
    ).not.toThrow();
  });

  it("для короткой неструктурированной статьи возвращает fallback unstructured segment", () => {
    const segments = parseArticleSegments("Настоящий закон регулирует общие положения.");

    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual(
      expect.objectContaining({
        segmentType: "unstructured",
        marker: null,
        partNumber: null,
      }),
    );
  });

  it("парсит marker, partNumber, segmentType и offsets корректно", () => {
    const blockText = [
      "Статья 8. Основания",
      "ч. 2 Органы должны дать ответ в течение срока.",
      "ч. 3 В предоставлении сведений может быть отказано.",
    ].join("\n");
    const segments = parseArticleSegments(blockText);
    const partTwo = segments.find((segment) => segment.marker === "ч. 2");
    const partThree = segments.find((segment) => segment.marker === "ч. 3");

    expect(partTwo).toEqual(
      expect.objectContaining({
        segmentType: "part",
        marker: "ч. 2",
        partNumber: "2",
      }),
    );
    expect(partTwo?.startOffset).toBeGreaterThanOrEqual(0);
    expect(partTwo?.endOffset).toBeGreaterThan(partTwo?.startOffset ?? 0);
    expect(partThree?.text).toContain("может быть отказано");
  });

  it("определяет relationHints для deadline, exception, sanction и note", () => {
    const segments = parseArticleSegments(
      [
        "Статья 5. Адвокатский запрос",
        "Примечание: необходимо соблюдать порядок публикации.",
        "ч. 2 Органы должны дать ответ в течение одного календарного дня.",
        "ч. 4 В предоставлении сведений может быть отказано, если адресат не располагает сведениями.",
        "ч. 5 Неправомерный отказ и нарушение сроков влекут ответственность.",
      ].join("\n"),
    );

    expect(segments.find((segment) => segment.marker === "Примечание")?.relationHints).toContain("note");
    expect(segments.find((segment) => segment.marker === "ч. 2")?.relationHints).toEqual(
      expect.arrayContaining(["deadline", "procedure"]),
    );
    expect(segments.find((segment) => segment.marker === "ч. 4")?.relationHints).toContain("exception");
    expect(segments.find((segment) => segment.marker === "ч. 5")?.relationHints).toContain("sanction");
  });
});
