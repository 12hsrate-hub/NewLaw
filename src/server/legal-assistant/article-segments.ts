export const articleSegmentTypes = [
  "article_heading",
  "part",
  "note",
  "unstructured",
] as const;

export type ArticleSegmentType = (typeof articleSegmentTypes)[number];

export const articleSegmentRelationHints = [
  "definition",
  "deadline",
  "exception",
  "sanction",
  "procedure",
  "evidence",
  "note",
] as const;

export type ArticleSegmentRelationHint = (typeof articleSegmentRelationHints)[number];

export type ArticleSegment = {
  segmentType: ArticleSegmentType;
  marker: string | null;
  partNumber: string | null;
  text: string;
  startOffset: number;
  endOffset: number;
  relationHints: ArticleSegmentRelationHint[];
};

const definitionTerms = [
  "далее -",
  "далее —",
  "определяется как",
  "вправе направлять",
  "вправе обратиться",
] as const;

const deadlineTerms = [
  "должны дать",
  "обязан",
  "обязаны",
  "в течение",
  "календарного дня",
  "срок",
] as const;

const exceptionTerms = [
  "может быть отказано",
  "не располагает",
  "тайна",
  "основания отказа",
  "отказано",
] as const;

const sanctionTerms = [
  "влекут ответственность",
  "влечет ответственность",
  "нарушение сроков",
  "неправомерный отказ",
  "ответственность",
] as const;

const procedureTerms = [
  "порядок",
  "процедура",
  "необходимо",
  "обязан",
  "должны дать",
] as const;

const evidenceTerms = [
  "видеозаписи",
  "аудиозаписи",
  "видеофиксац",
  "не вправе уничтожать",
  "срок давности",
] as const;

function normalizeArticleText(value: string) {
  return value.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

function includesKeyword(source: string, keywords: readonly string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function inferRelationHints(input: {
  segmentType: ArticleSegmentType;
  text: string;
}): ArticleSegmentRelationHint[] {
  const normalized = input.text.toLowerCase();
  const hints = new Set<ArticleSegmentRelationHint>();

  if (input.segmentType === "note") {
    hints.add("note");
  }

  if (includesKeyword(normalized, definitionTerms)) {
    hints.add("definition");
  }

  if (includesKeyword(normalized, deadlineTerms)) {
    hints.add("deadline");
    hints.add("procedure");
  }

  if (includesKeyword(normalized, exceptionTerms)) {
    hints.add("exception");
  }

  if (includesKeyword(normalized, sanctionTerms)) {
    hints.add("sanction");
  }

  if (includesKeyword(normalized, procedureTerms)) {
    hints.add("procedure");
  }

  if (includesKeyword(normalized, evidenceTerms)) {
    hints.add("evidence");
  }

  return Array.from(hints);
}

type RawSegment = {
  segmentType: Exclude<ArticleSegmentType, "article_heading">;
  marker: string | null;
  partNumber: string | null;
  lines: string[];
};

function buildSegment(input: {
  segmentType: ArticleSegmentType;
  marker: string | null;
  partNumber: string | null;
  text: string;
  startOffset: number;
  endOffset: number;
}): ArticleSegment {
  return {
    segmentType: input.segmentType,
    marker: input.marker,
    partNumber: input.partNumber,
    text: input.text,
    startOffset: input.startOffset,
    endOffset: input.endOffset,
    relationHints: inferRelationHints({
      segmentType: input.segmentType,
      text: input.text,
    }),
  };
}

export function parseArticleSegments(blockText: string): ArticleSegment[] {
  const normalized = normalizeArticleText(blockText);

  if (!normalized) {
    return [
      buildSegment({
        segmentType: "unstructured",
        marker: null,
        partNumber: null,
        text: "",
        startOffset: 0,
        endOffset: 0,
      }),
    ];
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [
      buildSegment({
        segmentType: "unstructured",
        marker: null,
        partNumber: null,
        text: normalized,
        startOffset: 0,
        endOffset: normalized.length,
      }),
    ];
  }

  const headingLine = /^статья(?:\s|$)/i.test(lines[0]) ? lines[0] : null;
  const contentLines = headingLine === null ? lines : lines.slice(1);
  const rawSegments: RawSegment[] = [];
  let currentSegment: RawSegment | null = null;

  for (const line of contentLines) {
    const partMatch = line.match(/^(ч\.\s*(\d+))\b/i);

    if (partMatch) {
      if (currentSegment) {
        rawSegments.push(currentSegment);
      }

      currentSegment = {
        segmentType: "part",
        marker: partMatch[1],
        partNumber: partMatch[2],
        lines: [line],
      };
      continue;
    }

    if (/^примечание(?::|\s|$)/i.test(line)) {
      if (currentSegment) {
        rawSegments.push(currentSegment);
      }

      currentSegment = {
        segmentType: "note",
        marker: "Примечание",
        partNumber: null,
        lines: [line],
      };
      continue;
    }

    if (!currentSegment) {
      currentSegment = {
        segmentType: "unstructured",
        marker: null,
        partNumber: null,
        lines: [line],
      };
      continue;
    }

    currentSegment.lines.push(line);
  }

  if (currentSegment) {
    rawSegments.push(currentSegment);
  }

  const hasStructuredMarkers = rawSegments.some(
    (segment) => segment.segmentType === "part" || segment.segmentType === "note",
  );

  if (!hasStructuredMarkers) {
    return [
      buildSegment({
        segmentType: "unstructured",
        marker: null,
        partNumber: null,
        text: normalized,
        startOffset: 0,
        endOffset: normalized.length,
      }),
    ];
  }

  const segments: ArticleSegment[] = [];

  if (headingLine) {
    const startOffset = normalized.indexOf(headingLine);
    segments.push(
      buildSegment({
        segmentType: "article_heading",
        marker: null,
        partNumber: null,
        text: headingLine,
        startOffset: startOffset >= 0 ? startOffset : 0,
        endOffset: (startOffset >= 0 ? startOffset : 0) + headingLine.length,
      }),
    );
  }

  let searchIndex = headingLine ? normalized.indexOf(headingLine) + headingLine.length : 0;

  for (const rawSegment of rawSegments) {
    const text = rawSegment.lines.join("\n");
    const startOffset = normalized.indexOf(text, Math.max(0, searchIndex));
    const safeStart = startOffset >= 0 ? startOffset : searchIndex;
    const endOffset = safeStart + text.length;
    searchIndex = endOffset;

    segments.push(
      buildSegment({
        segmentType: rawSegment.segmentType,
        marker: rawSegment.marker,
        partNumber: rawSegment.partNumber,
        text,
        startOffset: safeStart,
        endOffset,
      }),
    );
  }

  return segments;
}
