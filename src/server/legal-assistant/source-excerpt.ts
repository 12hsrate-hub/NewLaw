import type { LegalAnchor, LegalIssueType } from "@/server/legal-core/legal-query-plan";
import type { LawFamily, NormRole } from "@/server/legal-core/legal-selection";

export type AssistantSourceExcerptInput = {
  blockText: string;
  primaryLegalIssueType: LegalIssueType;
  normalizedInput: string;
  legalAnchors: LegalAnchor[];
  lawFamily: LawFamily | null;
  normRole: NormRole | null;
  articleNumber: string | null;
  maxChars: number;
};

export type AssistantSourceExcerptResult = {
  text: string;
  strategy: "front_excerpt" | "issue_targeted_segment" | "issue_targeted_window";
  matchedTerms: string[];
  wasTargeted: boolean;
  trimmed: boolean;
  excerptStart: number;
  excerptEnd: number;
};

type TextSegment = {
  text: string;
  start: number;
  end: number;
};

const issueTargetTerms: Partial<Record<LegalIssueType, string[]>> = {
  deadline_question: [
    "срок ответа",
    "в течение",
    "календарного дня",
    "рабочих дней",
    "должны дать",
    "обязан",
    "ответ",
  ],
  refusal_question: [
    "отказ",
    "отказано",
    "может быть отказано",
    "основания отказа",
    "не располагает",
    "государственная или служебная тайна",
    "служебной тайной",
    "неправомерный отказ",
    "нарушение сроков",
  ],
  sanction_question: [
    "ответственность",
    "влечет ответственность",
    "влекут ответственность",
    "неисполнение",
    "ненадлежащее исполнение",
    "воспрепятствование",
    "наказание",
  ],
  evidence_question: [
    "доказательства",
    "видеозапись",
    "видеофиксация",
    "видео",
    "аудиозаписи",
    "запись",
    "предоставить запись",
    "бремя доказывания",
  ],
  right_question: [
    "право",
    "имеет право",
    "задержанный",
    "адвокат",
    "защитник",
    "звонок",
  ],
  duty_question: ["обязан", "обязанность", "должен", "должны", "порядок"],
  procedure_question: ["порядок", "процедура", "ходатайство", "заявлять ходатайство"],
};

const attorneyRequestSubjectTerms = ["адвокатский запрос", "официальный адвокатский запрос"];

function normalizeExcerptText(value: string) {
  return value.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ");
}

function clampFrontExcerpt(value: string, limit: number) {
  const normalized = normalizeExcerptText(value);

  if (normalized.length <= limit) {
    return {
      text: normalized,
      trimmed: false,
      excerptStart: 0,
      excerptEnd: normalized.length,
    };
  }

  const safeLimit = Math.max(1, limit - 1);

  return {
    text: `${normalized.slice(0, safeLimit).trimEnd()}…`,
    trimmed: true,
    excerptStart: 0,
    excerptEnd: safeLimit,
  };
}

function collectIssueTerms(input: AssistantSourceExcerptInput) {
  const directTerms = issueTargetTerms[input.primaryLegalIssueType] ?? [];
  const terms = [...directTerms];

  if (input.legalAnchors.includes("attorney_request")) {
    terms.push(...attorneyRequestSubjectTerms);
  }

  return Array.from(new Set(terms.map((term) => term.toLowerCase())));
}

function splitIntoSegments(value: string) {
  const normalized = normalizeExcerptText(value);

  if (!normalized) {
    return {
      heading: null as TextSegment | null,
      segments: [] as TextSegment[],
      normalized,
    };
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      heading: null as TextSegment | null,
      segments: [] as TextSegment[],
      normalized,
    };
  }

  const headingLine = /^статья\b/i.test(lines[0]) ? lines[0] : null;
  const heading =
    headingLine === null
      ? null
      : ({
          text: headingLine,
          start: normalized.indexOf(headingLine),
          end: normalized.indexOf(headingLine) + headingLine.length,
        } satisfies TextSegment);
  const contentLines = headingLine === null ? lines : lines.slice(1);
  const segments: Array<{ lines: string[] }> = [];
  let currentSegment: { lines: string[] } | null = null;

  for (const line of contentLines) {
    if (/^ч\.\s*\d+/i.test(line)) {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = {
        lines: [line],
      };
      continue;
    }

    if (!currentSegment) {
      currentSegment = {
        lines: [line],
      };
      continue;
    }

    currentSegment.lines.push(line);
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  let searchIndex = heading ? heading.end : 0;

  return {
    heading,
    normalized,
    segments: segments
      .map((segment) => segment.lines.join("\n"))
      .map((text) => {
        const start = normalized.indexOf(text, searchIndex);
        const safeStart = start >= 0 ? start : searchIndex;
        const end = safeStart + text.length;
        searchIndex = end;

        return {
          text,
          start: safeStart,
          end,
        } satisfies TextSegment;
      }),
  };
}

function getMatchedTerms(value: string, terms: string[]) {
  const haystack = value.toLowerCase();

  return terms.filter((term) => haystack.includes(term));
}

function scoreSegment(segment: TextSegment, input: AssistantSourceExcerptInput, terms: string[]) {
  const matchedTerms = getMatchedTerms(segment.text, terms);
  const questionScopedTerms = terms.filter((term) => input.normalizedInput.toLowerCase().includes(term));
  const matchedQuestionTerms = matchedTerms.filter((term) => questionScopedTerms.includes(term));

  let score = 0;

  for (const term of matchedTerms) {
    if (attorneyRequestSubjectTerms.includes(term)) {
      score += 1;
      continue;
    }

    score += term.includes(" ") ? 3 : 2;
  }

  score += matchedQuestionTerms.length * 2;

  if (input.legalAnchors.includes("attorney_request")) {
    if (
      matchedTerms.some((term) => attorneyRequestSubjectTerms.includes(term)) &&
      matchedTerms.some((term) => !attorneyRequestSubjectTerms.includes(term))
    ) {
      score += 4;
    }
  }

  return {
    matchedTerms: Array.from(new Set([...matchedTerms, ...matchedQuestionTerms])),
    score,
  };
}

function clampSegmentWindow(input: {
  heading: TextSegment | null;
  segment: TextSegment;
  matchedTerms: string[];
  maxChars: number;
}) {
  const headingPrefix = input.heading ? `${input.heading.text}\n` : "";
  const availableChars = Math.max(1, input.maxChars - headingPrefix.length);
  const segmentLower = input.segment.text.toLowerCase();
  const firstMatchPosition = input.matchedTerms.reduce<number>((best, term) => {
    const index = segmentLower.indexOf(term.toLowerCase());

    if (index < 0) {
      return best;
    }

    if (best < 0 || index < best) {
      return index;
    }

    return best;
  }, -1);

  const anchorPosition = firstMatchPosition >= 0 ? firstMatchPosition : 0;
  const rawStart = Math.max(0, anchorPosition - Math.floor(availableChars * 0.25));
  let start = rawStart;
  const end = Math.min(input.segment.text.length, start + availableChars);

  if (end - start < availableChars) {
    start = Math.max(0, end - availableChars);
  }

  const prefixEllipsis = start > 0 ? "…" : "";
  const suffixEllipsis = end < input.segment.text.length ? "…" : "";
  const core = input.segment.text.slice(start, end).trim();
  const text = `${headingPrefix}${prefixEllipsis}${core}${suffixEllipsis}`;

  return {
    text,
    trimmed: prefixEllipsis.length > 0 || suffixEllipsis.length > 0,
    excerptStart: input.segment.start + start,
    excerptEnd: input.segment.start + end,
  };
}

export function selectQuestionAwareSourceExcerpt(
  input: AssistantSourceExcerptInput,
): AssistantSourceExcerptResult {
  const frontExcerpt = clampFrontExcerpt(input.blockText, input.maxChars);
  const terms = collectIssueTerms(input);

  if (terms.length === 0) {
    return {
      ...frontExcerpt,
      strategy: "front_excerpt",
      matchedTerms: [],
      wasTargeted: false,
    };
  }

  const { heading, segments } = splitIntoSegments(input.blockText);

  if (segments.length === 0) {
    return {
      ...frontExcerpt,
      strategy: "front_excerpt",
      matchedTerms: [],
      wasTargeted: false,
    };
  }

  const scoredSegments = segments
    .map((segment) => ({
      segment,
      ...scoreSegment(segment, input, terms),
    }))
    .sort((left, right) => right.score - left.score);
  const bestMatch = scoredSegments[0];

  if (!bestMatch || bestMatch.score <= 0) {
    return {
      ...frontExcerpt,
      strategy: "front_excerpt",
      matchedTerms: [],
      wasTargeted: false,
    };
  }

  const headingPrefix = heading ? `${heading.text}\n` : "";
  const targetedSegmentText = `${headingPrefix}${bestMatch.segment.text}`;

  if (targetedSegmentText.length <= input.maxChars) {
    return {
      text: targetedSegmentText,
      strategy: "issue_targeted_segment",
      matchedTerms: bestMatch.matchedTerms,
      wasTargeted: true,
      trimmed: false,
      excerptStart: bestMatch.segment.start,
      excerptEnd: bestMatch.segment.end,
    };
  }

  const targetedWindow = clampSegmentWindow({
    heading,
    segment: bestMatch.segment,
    matchedTerms: bestMatch.matchedTerms,
    maxChars: input.maxChars,
  });

  return {
    ...targetedWindow,
    strategy: "issue_targeted_window",
    matchedTerms: bestMatch.matchedTerms,
    wasTargeted: true,
  };
}
