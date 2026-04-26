import {
  classifyLawFamily,
  type LawFamily,
  type LegalSelectionCandidate,
} from "@/server/legal-core/legal-selection";

export const DEFAULT_CITATION_READINESS_TEST_CITATIONS = [
  "22 ч.1 АК",
  "ст. 22 ч. 1 АК",
  "АК 22 ч.1",
  "23.1 ПК",
  "84 УК",
  "5 ч.4 Закона об адвокатуре",
  "ст. 23 ч.1 п. «в» ПК",
  "999 УК",
] as const;

export type CitationReadinessAuditCorpusEntry = {
  lawId: string;
  lawVersionId: string;
  lawBlockId: string;
  lawTitle: string;
  lawKey: string;
  topicUrl: string | null;
  blockType: string;
  blockOrder: number;
  articleNumberNormalized: string | null;
  blockTitle: string | null;
  blockText: string;
};

export type CitationReadinessAuditLawBlockLike = {
  id: string;
  blockType: string;
  blockOrder: number;
  blockTitle: string | null;
  blockText: string;
  articleNumberNormalized: string | null;
  lawVersion: {
    id: string;
    lawId?: string;
    currentForLaw?: {
      id: string;
      lawKey: string;
      title: string;
      topicUrl: string | null;
    } | null;
  };
};

export type CitationReadinessAuditAliasHint =
  | LawFamily
  | "unknown_family_hint:traffic_code"
  | "unknown_family_hint:labor_code"
  | "government_code:prosecutor_office_scope";

export type CitationReadinessAuditStatus =
  | "resolved"
  | "ambiguous"
  | "unresolved"
  | "partially_supported";

export type CitationReadinessAuditUnresolvedReason =
  | "alias_miss"
  | "no_law_candidate"
  | "no_article"
  | "no_part_metadata"
  | "no_point_metadata"
  | "cross_family_collision";

export type CitationReadinessAuditHeuristicHit = {
  law_block_id: string;
  law_id: string;
  law_title: string;
  marker_type: "note" | "exception" | "comment" | "cross_reference";
  block_title: string | null;
};

export type CitationReadinessAuditCompanionCandidate = {
  law_block_id: string;
  law_id: string;
  law_title: string;
  block_title: string | null;
  block_type: string;
  block_order: number;
  reason:
    | "same_article_number"
    | "neighboring_block"
    | "note_like"
    | "exception_like"
    | "cross_reference_like";
};

export type CitationReadinessAuditCollisionCandidate = {
  law_id: string;
  law_title: string;
  law_family: LawFamily;
  article_number: string | null;
  law_block_id: string;
};

export type CitationReadinessAuditMatchedBlock = {
  law_block_id: string;
  law_id: string;
  law_title: string;
  block_title: string | null;
};

export type CitationReadinessAuditDetail = {
  raw_citation: string;
  detected_alias: string | null;
  candidate_law_family: CitationReadinessAuditAliasHint | null;
  article_number: string | null;
  part_number: string | null;
  point_number: string | null;
  article_found: boolean;
  part_textual_hint_found: boolean;
  point_textual_hint_found: boolean;
  status: CitationReadinessAuditStatus;
  unresolved_reason: CitationReadinessAuditUnresolvedReason | null;
  collision_candidates: CitationReadinessAuditCollisionCandidate[];
  matched_blocks: CitationReadinessAuditMatchedBlock[];
  note_exception_comment_hits: CitationReadinessAuditHeuristicHit[];
  cross_reference_hits: CitationReadinessAuditHeuristicHit[];
  same_article_companion_candidates: CitationReadinessAuditCompanionCandidate[];
};

export type CitationReadinessAuditSummary = {
  total_citations: number;
  resolved: number;
  ambiguous: number;
  unresolved: number;
  partially_supported: number;
  cross_family_collisions: number;
  part_point_metadata_gaps: number;
  same_article_companion_candidates: number;
  note_exception_comment_hits: number;
  cross_reference_hits: number;
};

export type CitationReadinessAuditReport = {
  summary: CitationReadinessAuditSummary;
  details: CitationReadinessAuditDetail[];
};

type CitationReadinessAliasDefinition = {
  alias: string;
  patterns: RegExp[];
  familyHint: CitationReadinessAuditAliasHint;
  runtimeFamily: LawFamily | null;
};

type CitationReadinessParsedCitation = {
  rawCitation: string;
  detectedAlias: string | null;
  aliasDefinition: CitationReadinessAliasDefinition | null;
  articleNumber: string | null;
  partNumber: string | null;
  pointNumber: string | null;
};

type CitationReadinessIndex = {
  entries: CitationReadinessIndexedEntry[];
};

type CitationReadinessIndexedEntry = CitationReadinessAuditCorpusEntry & {
  lawFamily: LawFamily;
  normalizedSearchText: string;
};

const CITATION_ALIAS_DEFINITIONS: CitationReadinessAliasDefinition[] = [
  {
    alias: "Закон об адвокатуре",
    patterns: [/закон(?:а)?\s+об\s+адвокатуре/u, /(^|\s)зоа($|\s)/u],
    familyHint: "advocacy_law",
    runtimeFamily: "advocacy_law",
  },
  {
    alias: "ОГП",
    patterns: [/(^|\s)огп($|\s)/u, /офис(?:а)?\s+генерального\s+прокурора/u],
    familyHint: "government_code:prosecutor_office_scope",
    runtimeFamily: "government_code",
  },
  {
    alias: "АК",
    patterns: [/(^|\s)ак($|\s)/u, /административн(?:ый|ого)?\s+кодекс/u],
    familyHint: "administrative_code",
    runtimeFamily: "administrative_code",
  },
  {
    alias: "ПК",
    patterns: [/(^|\s)пк($|\s)/u, /процессуальн(?:ый|ого)?\s+кодекс/u],
    familyHint: "procedural_code",
    runtimeFamily: "procedural_code",
  },
  {
    alias: "УК",
    patterns: [/(^|\s)ук($|\s)/u, /уголовн(?:ый|ого)?\s+кодекс/u],
    familyHint: "criminal_code",
    runtimeFamily: "criminal_code",
  },
  {
    alias: "ДК",
    patterns: [/(^|\s)дк($|\s)/u, /дорожн(?:ый|ого)?\s+кодекс/u],
    familyHint: "unknown_family_hint:traffic_code",
    runtimeFamily: null,
  },
  {
    alias: "ТК",
    patterns: [/(^|\s)тк($|\s)/u, /трудов(?:ый|ого)?\s+кодекс/u],
    familyHint: "unknown_family_hint:labor_code",
    runtimeFamily: null,
  },
  {
    alias: "ЭК",
    patterns: [/(^|\s)эк($|\s)/u, /этическ(?:ий|ого)?\s+кодекс/u],
    familyHint: "ethics_code",
    runtimeFamily: "ethics_code",
  },
];

const PART_PATTERNS = [/ч\.?\s*(\d+)/u, /част(?:ь|и)\s*(\d+)/u];
const POINT_PATTERNS = [
  /п\.\s*[«"]?([а-яa-z0-9]+)[»"]?/u,
  /пункт\s*[«"]?([а-яa-z0-9]+)[»"]?/u,
];
const ARTICLE_PATTERNS = [/ст\.?\s*(\d+(?:\.\d+)?)/u];
const COMMENT_PATTERN = /комментари/u;
const NOTE_PATTERN = /примечани/u;
const EXCEPTION_PATTERNS = [/за исключением/u, /кроме случаев/u];
const CROSS_REFERENCE_PATTERNS = [
  /в соответствии со ст\./u,
  /согласно ст\./u,
  /предусмотрено ст\./u,
];

function normalizeText(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ");
}

function buildSelectionCandidate(entry: CitationReadinessAuditCorpusEntry): LegalSelectionCandidate {
  return {
    serverId: "audit-server",
    lawId: entry.lawId,
    lawKey: entry.lawKey,
    lawTitle: entry.lawTitle,
    lawVersionId: entry.lawVersionId,
    lawBlockId: entry.lawBlockId,
    blockType: entry.blockType,
    blockText: [entry.blockTitle ?? "", entry.blockText].join(" ").trim(),
    articleNumberNormalized: entry.articleNumberNormalized,
    sourceTopicUrl: entry.topicUrl ?? "",
  };
}

function buildCitationReadinessIndexedEntry(
  entry: CitationReadinessAuditCorpusEntry,
): CitationReadinessIndexedEntry {
  return {
    ...entry,
    lawFamily: classifyLawFamily(buildSelectionCandidate(entry)),
    normalizedSearchText: normalizeText([entry.blockTitle ?? "", entry.blockText].join(" ")),
  };
}

export function buildCitationReadinessAuditEntriesFromLawBlocks(
  blocks: CitationReadinessAuditLawBlockLike[],
): CitationReadinessAuditCorpusEntry[] {
  return blocks
    .map((block) => {
      const law = block.lawVersion.currentForLaw;

      if (!law) {
        return null;
      }

      return {
        lawId: law.id,
        lawVersionId: block.lawVersion.id,
        lawBlockId: block.id,
        lawTitle: law.title,
        lawKey: law.lawKey,
        topicUrl: law.topicUrl,
        blockType: block.blockType,
        blockOrder: block.blockOrder,
        articleNumberNormalized: block.articleNumberNormalized,
        blockTitle: block.blockTitle,
        blockText: block.blockText,
      } satisfies CitationReadinessAuditCorpusEntry;
    })
    .filter((entry): entry is CitationReadinessAuditCorpusEntry => Boolean(entry));
}

export function buildCitationReadinessAuditIndex(
  entries: CitationReadinessAuditCorpusEntry[],
): CitationReadinessIndex {
  return {
    entries: entries.map((entry) => buildCitationReadinessIndexedEntry(entry)),
  };
}

function containsPattern(text: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function parseArticleNumber(normalizedCitation: string) {
  for (const pattern of ARTICLE_PATTERNS) {
    const match = normalizedCitation.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  const numericMatches = Array.from(normalizedCitation.matchAll(/\d+(?:\.\d+)?/gu)).map(
    (match) => match[0],
  );

  return numericMatches[0] ?? null;
}

function parsePartNumber(normalizedCitation: string) {
  for (const pattern of PART_PATTERNS) {
    const match = normalizedCitation.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function parsePointNumber(normalizedCitation: string) {
  for (const pattern of POINT_PATTERNS) {
    const match = normalizedCitation.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function parseCitation(rawCitation: string): CitationReadinessParsedCitation {
  const normalizedCitation = normalizeText(rawCitation);
  const aliasDefinition =
    CITATION_ALIAS_DEFINITIONS.find((definition) =>
      definition.patterns.some((pattern) => pattern.test(normalizedCitation)),
    ) ?? null;

  return {
    rawCitation,
    detectedAlias: aliasDefinition?.alias ?? null,
    aliasDefinition,
    articleNumber: parseArticleNumber(normalizedCitation),
    partNumber: parsePartNumber(normalizedCitation),
    pointNumber: parsePointNumber(normalizedCitation),
  };
}

function hasPartTextualHint(entry: CitationReadinessIndexedEntry, partNumber: string) {
  return containsPattern(entry.normalizedSearchText, [
    new RegExp(`ч\\.?\\s*${partNumber}(?:\\b|\\s)`, "u"),
    new RegExp(`част(?:ь|и)\\s*${partNumber}(?:\\b|\\s)`, "u"),
  ]);
}

function hasPointTextualHint(entry: CitationReadinessIndexedEntry, pointNumber: string) {
  const escapedPoint = pointNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return containsPattern(entry.normalizedSearchText, [
    new RegExp(`п\\.?\\s*[«"]?${escapedPoint}[»"]?`, "u"),
    new RegExp(`пункт\\s*[«"]?${escapedPoint}[»"]?`, "u"),
  ]);
}

function deduplicateHits(hits: CitationReadinessAuditHeuristicHit[]) {
  const seen = new Set<string>();

  return hits.filter((hit) => {
    const key = `${hit.law_block_id}:${hit.marker_type}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function deduplicateCompanionCandidates(
  candidates: CitationReadinessAuditCompanionCandidate[],
) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.law_block_id}:${candidate.reason}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildHeuristicHits(
  entries: CitationReadinessIndexedEntry[],
): Pick<
  CitationReadinessAuditDetail,
  "note_exception_comment_hits" | "cross_reference_hits" | "same_article_companion_candidates"
> {
  const noteExceptionCommentHits: CitationReadinessAuditHeuristicHit[] = [];
  const crossReferenceHits: CitationReadinessAuditHeuristicHit[] = [];
  const sameArticleCompanionCandidates: CitationReadinessAuditCompanionCandidate[] = [];

  for (const entry of entries) {
    if (NOTE_PATTERN.test(entry.normalizedSearchText)) {
      noteExceptionCommentHits.push({
        law_block_id: entry.lawBlockId,
        law_id: entry.lawId,
        law_title: entry.lawTitle,
        marker_type: "note",
        block_title: entry.blockTitle,
      });
      sameArticleCompanionCandidates.push({
        law_block_id: entry.lawBlockId,
        law_id: entry.lawId,
        law_title: entry.lawTitle,
        block_title: entry.blockTitle,
        block_type: entry.blockType,
        block_order: entry.blockOrder,
        reason: "note_like",
      });
    }

    if (COMMENT_PATTERN.test(entry.normalizedSearchText)) {
      noteExceptionCommentHits.push({
        law_block_id: entry.lawBlockId,
        law_id: entry.lawId,
        law_title: entry.lawTitle,
        marker_type: "comment",
        block_title: entry.blockTitle,
      });
    }

    if (containsPattern(entry.normalizedSearchText, EXCEPTION_PATTERNS)) {
      noteExceptionCommentHits.push({
        law_block_id: entry.lawBlockId,
        law_id: entry.lawId,
        law_title: entry.lawTitle,
        marker_type: "exception",
        block_title: entry.blockTitle,
      });
      sameArticleCompanionCandidates.push({
        law_block_id: entry.lawBlockId,
        law_id: entry.lawId,
        law_title: entry.lawTitle,
        block_title: entry.blockTitle,
        block_type: entry.blockType,
        block_order: entry.blockOrder,
        reason: "exception_like",
      });
    }

    if (containsPattern(entry.normalizedSearchText, CROSS_REFERENCE_PATTERNS)) {
      crossReferenceHits.push({
        law_block_id: entry.lawBlockId,
        law_id: entry.lawId,
        law_title: entry.lawTitle,
        marker_type: "cross_reference",
        block_title: entry.blockTitle,
      });
      sameArticleCompanionCandidates.push({
        law_block_id: entry.lawBlockId,
        law_id: entry.lawId,
        law_title: entry.lawTitle,
        block_title: entry.blockTitle,
        block_type: entry.blockType,
        block_order: entry.blockOrder,
        reason: "cross_reference_like",
      });
    }
  }

  return {
    note_exception_comment_hits: deduplicateHits(noteExceptionCommentHits),
    cross_reference_hits: deduplicateHits(crossReferenceHits),
    same_article_companion_candidates: deduplicateCompanionCandidates(
      sameArticleCompanionCandidates,
    ),
  };
}

function buildCollisionCandidates(
  entries: CitationReadinessIndexedEntry[],
  articleNumber: string | null,
  runtimeFamily: LawFamily | null,
) {
  if (!articleNumber) {
    return [] satisfies CitationReadinessAuditCollisionCandidate[];
  }

  return entries
    .filter((entry) => entry.articleNumberNormalized === articleNumber)
    .filter((entry) => {
      if (!runtimeFamily) {
        return true;
      }

      return entry.lawFamily !== runtimeFamily;
    })
    .map((entry) => ({
      law_id: entry.lawId,
      law_title: entry.lawTitle,
      law_family: entry.lawFamily,
      article_number: entry.articleNumberNormalized,
      law_block_id: entry.lawBlockId,
    }))
    .filter((candidate, index, array) => {
      return array.findIndex((entry) => entry.law_block_id === candidate.law_block_id) === index;
    });
}

function buildCompanionCandidates(
  matchedEntries: CitationReadinessIndexedEntry[],
  targetArticleEntries: CitationReadinessIndexedEntry[],
) {
  const companions: CitationReadinessAuditCompanionCandidate[] = [];
  const matchedBlockIds = new Set(matchedEntries.map((entry) => entry.lawBlockId));

  for (const targetEntry of targetArticleEntries) {
    if (matchedBlockIds.has(targetEntry.lawBlockId)) {
      continue;
    }

    if (
      Boolean(targetEntry.articleNumberNormalized) &&
      matchedEntries.some(
        (matchedEntry) =>
          matchedEntry.articleNumberNormalized === targetEntry.articleNumberNormalized,
      )
    ) {
      companions.push({
        law_block_id: targetEntry.lawBlockId,
        law_id: targetEntry.lawId,
        law_title: targetEntry.lawTitle,
        block_title: targetEntry.blockTitle,
        block_type: targetEntry.blockType,
        block_order: targetEntry.blockOrder,
        reason: "same_article_number",
      });
    }

    if (
      matchedEntries.some(
        (matchedEntry) =>
          matchedEntry.lawId === targetEntry.lawId &&
          Math.abs(matchedEntry.blockOrder - targetEntry.blockOrder) <= 1,
      )
    ) {
      companions.push({
        law_block_id: targetEntry.lawBlockId,
        law_id: targetEntry.lawId,
        law_title: targetEntry.lawTitle,
        block_title: targetEntry.blockTitle,
        block_type: targetEntry.blockType,
        block_order: targetEntry.blockOrder,
        reason: "neighboring_block",
      });
    }
  }

  return deduplicateCompanionCandidates(companions);
}

function buildMatchedBlocks(entries: CitationReadinessIndexedEntry[]) {
  return entries.map((entry) => ({
    law_block_id: entry.lawBlockId,
    law_id: entry.lawId,
    law_title: entry.lawTitle,
    block_title: entry.blockTitle,
  }));
}

function auditCitation(index: CitationReadinessIndex, rawCitation: string): CitationReadinessAuditDetail {
  const parsed = parseCitation(rawCitation);
  const runtimeFamily = parsed.aliasDefinition?.runtimeFamily ?? null;

  if (!parsed.aliasDefinition) {
    return {
      raw_citation: rawCitation,
      detected_alias: null,
      candidate_law_family: null,
      article_number: parsed.articleNumber,
      part_number: parsed.partNumber,
      point_number: parsed.pointNumber,
      article_found: false,
      part_textual_hint_found: false,
      point_textual_hint_found: false,
      status: "unresolved",
      unresolved_reason: "alias_miss",
      collision_candidates: buildCollisionCandidates(index.entries, parsed.articleNumber, null),
      matched_blocks: [],
      note_exception_comment_hits: [],
      cross_reference_hits: [],
      same_article_companion_candidates: [],
    };
  }

  if (!runtimeFamily) {
    return {
      raw_citation: rawCitation,
      detected_alias: parsed.detectedAlias,
      candidate_law_family: parsed.aliasDefinition.familyHint,
      article_number: parsed.articleNumber,
      part_number: parsed.partNumber,
      point_number: parsed.pointNumber,
      article_found: false,
      part_textual_hint_found: false,
      point_textual_hint_found: false,
      status: "unresolved",
      unresolved_reason: "no_law_candidate",
      collision_candidates: buildCollisionCandidates(index.entries, parsed.articleNumber, null),
      matched_blocks: [],
      note_exception_comment_hits: [],
      cross_reference_hits: [],
      same_article_companion_candidates: [],
    };
  }

  const familyCandidates = index.entries.filter((entry) => entry.lawFamily === runtimeFamily);

  if (familyCandidates.length === 0) {
    return {
      raw_citation: rawCitation,
      detected_alias: parsed.detectedAlias,
      candidate_law_family: parsed.aliasDefinition.familyHint,
      article_number: parsed.articleNumber,
      part_number: parsed.partNumber,
      point_number: parsed.pointNumber,
      article_found: false,
      part_textual_hint_found: false,
      point_textual_hint_found: false,
      status: "unresolved",
      unresolved_reason: "no_law_candidate",
      collision_candidates: [],
      matched_blocks: [],
      note_exception_comment_hits: [],
      cross_reference_hits: [],
      same_article_companion_candidates: [],
    };
  }

  const matchedEntries = familyCandidates.filter(
    (entry) =>
      entry.blockType === "article" && entry.articleNumberNormalized === parsed.articleNumber,
  );
  const collisionCandidates = buildCollisionCandidates(
    index.entries,
    parsed.articleNumber,
    runtimeFamily,
  );

  if (matchedEntries.length === 0) {
    return {
      raw_citation: rawCitation,
      detected_alias: parsed.detectedAlias,
      candidate_law_family: parsed.aliasDefinition.familyHint,
      article_number: parsed.articleNumber,
      part_number: parsed.partNumber,
      point_number: parsed.pointNumber,
      article_found: false,
      part_textual_hint_found: false,
      point_textual_hint_found: false,
      status: "unresolved",
      unresolved_reason: "no_article",
      collision_candidates: collisionCandidates,
      matched_blocks: [],
      note_exception_comment_hits: [],
      cross_reference_hits: [],
      same_article_companion_candidates: [],
    };
  }

  const distinctLawIds = new Set(matchedEntries.map((entry) => entry.lawId));
  const targetArticleEntries = familyCandidates.filter((entry) => entry.lawId === matchedEntries[0]?.lawId);
  const heuristicScopeEntries = targetArticleEntries.filter(
    (entry) =>
      entry.articleNumberNormalized === parsed.articleNumber ||
      matchedEntries.some((matchedEntry) => Math.abs(matchedEntry.blockOrder - entry.blockOrder) <= 1),
  );
  const heuristicHits = buildHeuristicHits(heuristicScopeEntries);
  const sameArticleCompanionCandidates = deduplicateCompanionCandidates([
    ...heuristicHits.same_article_companion_candidates,
    ...buildCompanionCandidates(matchedEntries, targetArticleEntries),
  ]);
  const partTextualHintFound = parsed.partNumber
    ? matchedEntries.some((entry) => hasPartTextualHint(entry, parsed.partNumber ?? ""))
    : false;
  const pointTextualHintFound = parsed.pointNumber
    ? matchedEntries.some((entry) => hasPointTextualHint(entry, parsed.pointNumber ?? ""))
    : false;

  let status: CitationReadinessAuditStatus = "resolved";
  let unresolvedReason: CitationReadinessAuditUnresolvedReason | null = null;

  if (distinctLawIds.size > 1) {
    status = "ambiguous";
  } else if (parsed.pointNumber && !pointTextualHintFound) {
    status = "partially_supported";
    unresolvedReason = "no_point_metadata";
  } else if (parsed.partNumber && !partTextualHintFound) {
    status = "partially_supported";
    unresolvedReason = "no_part_metadata";
  }

  return {
    raw_citation: rawCitation,
    detected_alias: parsed.detectedAlias,
    candidate_law_family: parsed.aliasDefinition.familyHint,
    article_number: parsed.articleNumber,
    part_number: parsed.partNumber,
    point_number: parsed.pointNumber,
    article_found: true,
    part_textual_hint_found: partTextualHintFound,
    point_textual_hint_found: pointTextualHintFound,
    status,
    unresolved_reason: unresolvedReason,
    collision_candidates: collisionCandidates,
    matched_blocks: buildMatchedBlocks(matchedEntries),
    note_exception_comment_hits: heuristicHits.note_exception_comment_hits,
    cross_reference_hits: heuristicHits.cross_reference_hits,
    same_article_companion_candidates: sameArticleCompanionCandidates,
  };
}

function buildSummary(details: CitationReadinessAuditDetail[]): CitationReadinessAuditSummary {
  return {
    total_citations: details.length,
    resolved: details.filter((detail) => detail.status === "resolved").length,
    ambiguous: details.filter((detail) => detail.status === "ambiguous").length,
    unresolved: details.filter((detail) => detail.status === "unresolved").length,
    partially_supported: details.filter((detail) => detail.status === "partially_supported").length,
    cross_family_collisions: details.filter((detail) => detail.collision_candidates.length > 0).length,
    part_point_metadata_gaps: details.filter(
      (detail) =>
        detail.unresolved_reason === "no_part_metadata" ||
        detail.unresolved_reason === "no_point_metadata",
    ).length,
    same_article_companion_candidates: details.reduce(
      (sum, detail) => sum + detail.same_article_companion_candidates.length,
      0,
    ),
    note_exception_comment_hits: details.reduce(
      (sum, detail) => sum + detail.note_exception_comment_hits.length,
      0,
    ),
    cross_reference_hits: details.reduce(
      (sum, detail) => sum + detail.cross_reference_hits.length,
      0,
    ),
  };
}

export function runCitationReadinessAudit(input: {
  corpusEntries: CitationReadinessAuditCorpusEntry[];
  citations?: readonly string[];
}): CitationReadinessAuditReport {
  const citations = input.citations ?? DEFAULT_CITATION_READINESS_TEST_CITATIONS;
  const index = buildCitationReadinessAuditIndex(input.corpusEntries);
  const details = citations.map((citation) => auditCitation(index, citation));

  return {
    summary: buildSummary(details),
    details,
  };
}
