import type { LawFamily } from "@/server/legal-core/legal-selection";

export const citationResolutionStatuses = ["not_attempted"] as const;

export const citationConfidenceLevels = ["high", "medium", "low"] as const;

export const citationDiagnosticLawFamilyHints = [
  "traffic_code",
  "labor_code",
  "prosecutor_office_scope",
] as const;

export type CitationResolutionStatus = (typeof citationResolutionStatuses)[number];
export type CitationConfidence = (typeof citationConfidenceLevels)[number];
export type CitationDiagnosticLawFamilyHint =
  (typeof citationDiagnosticLawFamilyHints)[number];

export type ExplicitLegalCitation = {
  raw: string;
  normalized: string;
  lawCode: string;
  lawFamily: LawFamily | null;
  lawTitleHint: string | null;
  lawFamilyDiagnosticHint: CitationDiagnosticLawFamilyHint | null;
  articleNumber: string;
  partNumber: string | null;
  pointNumber: string | null;
  confidence: CitationConfidence;
  resolutionStatus: CitationResolutionStatus;
};

export type CitationConstraints = {
  restrictToExplicitLawFamily: boolean;
  restrictToExplicitArticle: boolean;
  restrictToExplicitPart: boolean;
  allowCompanionContext: boolean;
  semanticRetrievalAllowedAsCompanionOnly: boolean;
};

export type CitationDiagnostics = {
  citation_resolved: boolean;
  citation_unresolved: boolean;
  citation_ambiguous: boolean;
  semantic_retrieval_overrode_explicit_citation: boolean;
};

type CitationAliasDefinition = {
  canonicalLawCode: string;
  aliasPatterns: string[];
  lawFamily: LawFamily | null;
  lawTitleHint: string | null;
  lawFamilyDiagnosticHint: CitationDiagnosticLawFamilyHint | null;
};

type CitationPatternMatch = {
  raw: string;
  start: number;
  end: number;
  articleNumber: string;
  partNumber: string | null;
  pointNumber: string | null;
};

const citationAliasDefinitions: CitationAliasDefinition[] = [
  {
    canonicalLawCode: "АК",
    aliasPatterns: ["ак"],
    lawFamily: "administrative_code",
    lawTitleHint: "Административный кодекс",
    lawFamilyDiagnosticHint: null,
  },
  {
    canonicalLawCode: "ПК",
    aliasPatterns: ["пк"],
    lawFamily: "procedural_code",
    lawTitleHint: "Процессуальный кодекс",
    lawFamilyDiagnosticHint: null,
  },
  {
    canonicalLawCode: "УК",
    aliasPatterns: ["ук"],
    lawFamily: "criminal_code",
    lawTitleHint: "Уголовный кодекс",
    lawFamilyDiagnosticHint: null,
  },
  {
    canonicalLawCode: "ЭК",
    aliasPatterns: ["эк"],
    lawFamily: "ethics_code",
    lawTitleHint: "Этический кодекс",
    lawFamilyDiagnosticHint: null,
  },
  {
    canonicalLawCode: "ЗоА",
    aliasPatterns: [
      "зоа",
      "закона?\\s+[\"«»]?об\\s+адвокатуре(?:\\s+и\\s+адвокатской\\s+деятельности)?[\"«»]?",
      "закон[а-я\\s\"«»]+об\\s+адвокатуре(?:\\s+и\\s+адвокатской\\s+деятельности)?",
    ],
    lawFamily: "advocacy_law",
    lawTitleHint: "Закон об адвокатуре",
    lawFamilyDiagnosticHint: null,
  },
  {
    canonicalLawCode: "ОГП",
    aliasPatterns: [
      "огп",
      "закона?\\s+[\"«»]?об\\s+огп[\"«»]?",
      "закона?\\s+[\"«»]?об\\s+офисе\\s+генерального\\s+прокурора[\"«»]?",
    ],
    lawFamily: "government_code",
    lawTitleHint: "Закон об ОГП",
    lawFamilyDiagnosticHint: "prosecutor_office_scope",
  },
  {
    canonicalLawCode: "ДК",
    aliasPatterns: ["дк"],
    lawFamily: null,
    lawTitleHint: "Дорожный кодекс",
    lawFamilyDiagnosticHint: "traffic_code",
  },
  {
    canonicalLawCode: "ТК",
    aliasPatterns: ["тк"],
    lawFamily: null,
    lawTitleHint: "Трудовой кодекс",
    lawFamilyDiagnosticHint: "labor_code",
  },
];

const articleNumberPattern = String.raw`(?<article>\d+(?:\.\d+)?)`;
const partPattern = String.raw`(?:\s*(?:ч\.?|част(?:ь|и))\s*(?<part>\d+))?`;
const pointPattern =
  String.raw`(?:\s*(?:п\.?|пункт)\s*[«"']?(?<point>[а-яa-z0-9]+)[»"']?)?`;

function normalizeInput(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCitationText(input: string) {
  return normalizeInput(input).replace(/\s*([.,;:!?])/g, "$1");
}

function buildAliasMatcher(aliasPatterns: string[]) {
  return `(?:${aliasPatterns.join("|")})`;
}

function createAliasLastPattern(aliasPatterns: string[]) {
  return new RegExp(
    String.raw`(?:ст\.?\s*)?${articleNumberPattern}${partPattern}${pointPattern}\s*(?<law>${buildAliasMatcher(aliasPatterns)})(?![\p{L}\p{N}_])`,
    "giu",
  );
}

function createAliasFirstPattern(aliasPatterns: string[]) {
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}_])(?<law>${buildAliasMatcher(aliasPatterns)})\s*(?:ст\.?\s*)?${articleNumberPattern}${partPattern}${pointPattern}`,
    "giu",
  );
}

function collectPatternMatches(input: string, pattern: RegExp): CitationPatternMatch[] {
  const matches: CitationPatternMatch[] = [];

  for (const match of input.matchAll(pattern)) {
    const groups = match.groups;
    const raw = match[0]?.trim();
    const articleNumber = groups?.article?.trim();

    if (!groups || !raw || !articleNumber) {
      continue;
    }

    matches.push({
      raw,
      start: match.index ?? 0,
      end: (match.index ?? 0) + raw.length,
      articleNumber,
      partNumber: groups.part?.trim() ?? null,
      pointNumber: groups.point?.trim().toLowerCase() ?? null,
    });
  }

  return matches;
}

function dedupeMatches(matches: ExplicitLegalCitation[]) {
  const deduped = new Map<string, ExplicitLegalCitation>();

  for (const match of matches) {
    const key = [
      match.raw,
      match.lawCode,
      match.articleNumber,
      match.partNumber ?? "",
      match.pointNumber ?? "",
    ].join("|");

    if (!deduped.has(key)) {
      deduped.set(key, match);
    }
  }

  return Array.from(deduped.values());
}

function buildCitationConfidence(citation: {
  lawFamily: LawFamily | null;
  lawFamilyDiagnosticHint: CitationDiagnosticLawFamilyHint | null;
  partNumber: string | null;
  pointNumber: string | null;
}): CitationConfidence {
  if (citation.lawFamily && (citation.partNumber || citation.pointNumber)) {
    return "high";
  }

  if (citation.lawFamily) {
    return "high";
  }

  if (citation.lawFamilyDiagnosticHint) {
    return "medium";
  }

  return "low";
}

export function parseExplicitLegalCitations(input: string): ExplicitLegalCitation[] {
  const normalizedInput = normalizeInput(input);
  const citations: ExplicitLegalCitation[] = [];

  for (const aliasDefinition of citationAliasDefinitions) {
    const matches = [
      ...collectPatternMatches(
        normalizedInput,
        createAliasLastPattern(aliasDefinition.aliasPatterns),
      ),
      ...collectPatternMatches(
        normalizedInput,
        createAliasFirstPattern(aliasDefinition.aliasPatterns),
      ),
    ];

    for (const match of matches) {
      citations.push({
        raw: match.raw,
        normalized: normalizeCitationText(match.raw),
        lawCode: aliasDefinition.canonicalLawCode,
        lawFamily: aliasDefinition.lawFamily,
        lawTitleHint: aliasDefinition.lawTitleHint,
        lawFamilyDiagnosticHint: aliasDefinition.lawFamilyDiagnosticHint,
        articleNumber: match.articleNumber,
        partNumber: match.partNumber,
        pointNumber: match.pointNumber,
        confidence: buildCitationConfidence({
          lawFamily: aliasDefinition.lawFamily,
          lawFamilyDiagnosticHint: aliasDefinition.lawFamilyDiagnosticHint,
          partNumber: match.partNumber,
          pointNumber: match.pointNumber,
        }),
        resolutionStatus: "not_attempted",
      });
    }
  }

  return dedupeMatches(citations);
}

export function buildCitationConstraints(
  citations: ExplicitLegalCitation[],
): CitationConstraints {
  return {
    restrictToExplicitLawFamily: citations.some((citation) => citation.lawFamily !== null),
    restrictToExplicitArticle: citations.length > 0,
    restrictToExplicitPart: citations.some(
      (citation) => citation.partNumber !== null || citation.pointNumber !== null,
    ),
    allowCompanionContext: citations.length > 0,
    semanticRetrievalAllowedAsCompanionOnly: false,
  };
}

export function buildCitationDiagnostics(
  citations: ExplicitLegalCitation[],
): CitationDiagnostics {
  void citations;
  return {
    citation_resolved: false,
    citation_unresolved: false,
    citation_ambiguous: false,
    semantic_retrieval_overrode_explicit_citation: false,
  };
}
