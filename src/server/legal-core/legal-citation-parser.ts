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
  raw_citation_count?: number;
  normalized_citation_count?: number;
  merged_citation_count?: number;
  normalized_citations_discarded_count?: number;
  citation_merge_strategy?: "raw_preferred";
  citation_normalization_drift_detected?: boolean;
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

export type ExplicitLegalCitationMergeResult = {
  mergedCitations: ExplicitLegalCitation[];
  rawCitationCount: number;
  normalizedCitationCount: number;
  mergedCitationCount: number;
  normalizedCitationsDiscardedCount: number;
  citationNormalizationDriftDetected: boolean;
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
const citationSeparatorPattern = String.raw`(?:\s*,?\s*)`;
const articleLabelPattern = String.raw`(?:ст\.?|стать(?:я|и|е))`;
const partPattern =
  String.raw`(?:${citationSeparatorPattern}(?:ч\.?|част(?:ь|и))\s*(?<part>\d+))?`;
const pointPattern =
  String.raw`(?:${citationSeparatorPattern}(?:п\.?|пункт)\s*[«"']?(?<point>[а-яa-z0-9]+)[»"']?)?`;
const citationLeadInPattern = String.raw`(?:по${citationSeparatorPattern})?`;

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
    String.raw`${citationLeadInPattern}(?:${articleLabelPattern}${citationSeparatorPattern})?${articleNumberPattern}${partPattern}${pointPattern}${citationSeparatorPattern}(?<law>${buildAliasMatcher(aliasPatterns)})(?![\p{L}\p{N}_])`,
    "giu",
  );
}

function createAliasFirstPattern(aliasPatterns: string[]) {
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}_])(?<law>${buildAliasMatcher(aliasPatterns)})${citationSeparatorPattern}(?:${articleLabelPattern}${citationSeparatorPattern})?${articleNumberPattern}${partPattern}${pointPattern}`,
    "giu",
  );
}

function createSubunitBeforeArticlePattern(aliasPatterns: string[]) {
  return new RegExp(
    String.raw`${citationLeadInPattern}(?:пункт)\s*[«"']?(?<preSubunit>[а-яa-z0-9]+)[»"']?${citationSeparatorPattern}(?:${articleLabelPattern})${citationSeparatorPattern}${articleNumberPattern}${citationSeparatorPattern}(?<law>${buildAliasMatcher(aliasPatterns)})(?![\p{L}\p{N}_])`,
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
      partNumber:
        groups.part?.trim() ??
        (groups.preSubunit?.trim() && /^\d+$/.test(groups.preSubunit.trim())
          ? groups.preSubunit.trim()
          : null),
      pointNumber:
        groups.point?.trim().toLowerCase() ??
        (groups.preSubunit?.trim() && !/^\d+$/.test(groups.preSubunit.trim())
          ? groups.preSubunit.trim().toLowerCase()
          : null),
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

  const exactDeduped = Array.from(deduped.values());

  return exactDeduped.filter(
    (citation) =>
      !exactDeduped.some(
        (otherCitation) =>
          otherCitation !== citation &&
          buildCitationBaseKey(otherCitation) === buildCitationBaseKey(citation) &&
          buildCitationSpecificityScore(otherCitation) > buildCitationSpecificityScore(citation),
      ),
  );
}

function buildCitationIdentityKey(citation: ExplicitLegalCitation) {
  return [
    citation.lawCode,
    citation.lawFamily ?? "",
    citation.lawFamilyDiagnosticHint ?? "",
    citation.articleNumber,
    citation.partNumber ?? "",
    citation.pointNumber ?? "",
  ].join("|");
}

function buildCitationBaseKey(citation: ExplicitLegalCitation) {
  return [
    citation.articleNumber,
    citation.lawCode,
    citation.lawFamily ?? "",
    citation.lawFamilyDiagnosticHint ?? "",
  ].join("|");
}

function buildCitationSpecificityScore(citation: ExplicitLegalCitation) {
  return Number(citation.partNumber !== null) + Number(citation.pointNumber !== null);
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
      ...collectPatternMatches(
        normalizedInput,
        createSubunitBeforeArticlePattern(aliasDefinition.aliasPatterns),
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

export function mergeExplicitLegalCitations(input: {
  rawCitations: ExplicitLegalCitation[];
  normalizedCitations: ExplicitLegalCitation[];
}): ExplicitLegalCitationMergeResult {
  const rawCitations = dedupeMatches(input.rawCitations);
  const normalizedCitations = dedupeMatches(input.normalizedCitations);

  if (rawCitations.length === 0) {
    return {
      mergedCitations: normalizedCitations,
      rawCitationCount: 0,
      normalizedCitationCount: normalizedCitations.length,
      mergedCitationCount: normalizedCitations.length,
      normalizedCitationsDiscardedCount: 0,
      citationNormalizationDriftDetected: false,
    };
  }

  const mergedCitations = [...rawCitations];
  const rawIdentityKeys = new Set(rawCitations.map(buildCitationIdentityKey));
  const rawBaseKeys = new Set(rawCitations.map(buildCitationBaseKey));
  let normalizedCitationsDiscardedCount = 0;

  for (const normalizedCitation of normalizedCitations) {
    const normalizedIdentityKey = buildCitationIdentityKey(normalizedCitation);

    if (rawIdentityKeys.has(normalizedIdentityKey)) {
      continue;
    }

    if (rawBaseKeys.has(buildCitationBaseKey(normalizedCitation))) {
      normalizedCitationsDiscardedCount += 1;
      continue;
    }

    mergedCitations.push(normalizedCitation);
  }

  const normalizedIdentityKeys = new Set(normalizedCitations.map(buildCitationIdentityKey));
  const citationNormalizationDriftDetected =
    rawCitations.some((citation) => !normalizedIdentityKeys.has(buildCitationIdentityKey(citation))) ||
    normalizedCitationsDiscardedCount > 0;

  return {
    mergedCitations: dedupeMatches(mergedCitations),
    rawCitationCount: rawCitations.length,
    normalizedCitationCount: normalizedCitations.length,
    mergedCitationCount: dedupeMatches(mergedCitations).length,
    normalizedCitationsDiscardedCount,
    citationNormalizationDriftDetected,
  };
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

export function buildCitationDiagnostics(input: ExplicitLegalCitationMergeResult): CitationDiagnostics {
  return {
    citation_resolved: false,
    citation_unresolved: false,
    citation_ambiguous: false,
    semantic_retrieval_overrode_explicit_citation: false,
    raw_citation_count: input.rawCitationCount,
    normalized_citation_count: input.normalizedCitationCount,
    merged_citation_count: input.mergedCitationCount,
    normalized_citations_discarded_count: input.normalizedCitationsDiscardedCount,
    citation_merge_strategy: "raw_preferred",
    citation_normalization_drift_detected: input.citationNormalizationDriftDetected,
  };
}
