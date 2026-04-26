import { classifyLawFamily, type LawFamily, type LegalSelectionCandidate } from "@/server/legal-core/legal-selection";
import type { ExplicitLegalCitation } from "@/server/legal-core/legal-citation-parser";

export const legalCitationResolutionStatuses = [
  "resolved",
  "ambiguous",
  "unresolved",
  "partially_supported",
] as const;

export const legalCitationResolutionReasons = [
  "alias_miss",
  "no_law_candidate",
  "no_article",
  "no_part_metadata",
  "no_point_metadata",
  "cross_family_collision",
  "same_family_multi_law_ambiguous",
] as const;

export type LegalCitationResolutionStatus =
  (typeof legalCitationResolutionStatuses)[number];
export type LegalCitationResolutionReason =
  (typeof legalCitationResolutionReasons)[number];

export type LegalCitationResolverCorpusEntry = {
  lawId: string;
  lawVersionId: string;
  lawBlockId: string;
  lawTitle: string;
  lawKey: string;
  topicUrl: string | null;
  lawKind: "primary" | "supplement" | null;
  relatedPrimaryLawId: string | null;
  classificationOverride: "primary" | "supplement" | null;
  blockType: string;
  blockOrder: number;
  articleNumberNormalized: string | null;
  blockTitle: string | null;
  blockText: string;
};

export type LegalCitationResolverLawBlockLike = {
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
      lawKind?: "primary" | "supplement" | null;
      relatedPrimaryLawId?: string | null;
      classificationOverride?: "primary" | "supplement" | null;
    } | null;
  };
};

export type LegalCitationPartSupport = {
  requestedPart: string | null;
  textualHintFound: boolean;
  diagnosticGap: Extract<LegalCitationResolutionReason, "no_part_metadata"> | null;
};

export type LegalCitationPointSupport = {
  requestedPoint: string | null;
  textualHintFound: boolean;
  diagnosticGap: Extract<LegalCitationResolutionReason, "no_point_metadata"> | null;
};

export type LegalCitationCollisionCandidate = {
  lawId: string;
  lawTitle: string;
  lawFamily: LawFamily;
  articleNumber: string | null;
  lawBlockId: string;
};

export type LegalCitationCompanionCandidate = {
  lawBlockId: string;
  lawId: string;
  lawTitle: string;
  blockTitle: string | null;
  blockType: string;
  blockOrder: number;
  reason:
    | "same_article_number"
    | "neighboring_block"
    | "note_like"
    | "exception_like"
    | "cross_reference_like"
    | "comment_like";
};

export type LegalCitationHeuristicHit = {
  lawBlockId: string;
  lawId: string;
  lawTitle: string;
  markerType: "note" | "exception" | "comment" | "cross_reference";
  blockTitle: string | null;
};

export type LegalCitationResolutionReport = {
  rawCitation: string;
  normalizedCitation: string;
  lawCode: string;
  lawFamily: LawFamily | null;
  resolutionStatus: LegalCitationResolutionStatus;
  resolutionReason: LegalCitationResolutionReason | null;
  resolvedBlockId: string | null;
  resolvedLawSourceId: string | null;
  matchedLawTitle: string | null;
  matchedBlockTitle: string | null;
  matchedArticleNumber: string | null;
  partSupport: LegalCitationPartSupport;
  pointSupport: LegalCitationPointSupport;
  collisionCandidates: LegalCitationCollisionCandidate[];
  sameLawCompanionCandidates: LegalCitationCompanionCandidate[];
  noteExceptionCommentHits: LegalCitationHeuristicHit[];
  crossReferenceHits: LegalCitationHeuristicHit[];
};

export type ResolveExplicitLegalCitationOptions = {
  includeCrossFamilyCollisions?: boolean;
};

type ResolverIndexedEntry = LegalCitationResolverCorpusEntry & {
  lawFamily: LawFamily;
  normalizedSearchText: string;
  normalizedLawTitle: string;
};

type ResolverLawAggregate = {
  lawId: string;
  lawTitle: string;
  titleHintScore: number;
  classificationPrimary: boolean;
  lawKindPrimary: boolean;
  relatedPrimaryNull: boolean;
  entries: ResolverIndexedEntry[];
};

const NOTE_PATTERN = /примечани/u;
const COMMENT_PATTERN = /комментари/u;
const EXCEPTION_PATTERNS = [/за исключением/u, /кроме случаев/u];
const CROSS_REFERENCE_PATTERNS = [
  /в соответствии со ст\./u,
  /согласно ст\./u,
  /предусмотрено ст\./u,
] as const;

function normalizeText(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPattern(text: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function buildSelectionCandidate(
  entry: LegalCitationResolverCorpusEntry,
): LegalSelectionCandidate {
  return {
    serverId: "citation-resolver",
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

function indexEntry(entry: LegalCitationResolverCorpusEntry): ResolverIndexedEntry {
  return {
    ...entry,
    lawFamily: classifyLawFamily(buildSelectionCandidate(entry)),
    normalizedSearchText: normalizeText([entry.blockTitle ?? "", entry.blockText].join(" ")),
    normalizedLawTitle: normalizeText(entry.lawTitle),
  };
}

function buildResolverIndex(
  entries: LegalCitationResolverCorpusEntry[],
): ResolverIndexedEntry[] {
  return entries.map((entry) => indexEntry(entry));
}

function hasPartTextualHint(entry: ResolverIndexedEntry, partNumber: string) {
  return containsPattern(entry.normalizedSearchText, [
    new RegExp(`ч\\.?\\s*${escapeRegExp(partNumber)}(?:\\b|\\s)`, "u"),
    new RegExp(`част(?:ь|и)\\s*${escapeRegExp(partNumber)}(?:\\b|\\s)`, "u"),
  ]);
}

function hasPointTextualHint(entry: ResolverIndexedEntry, pointNumber: string) {
  const escapedPoint = escapeRegExp(pointNumber);

  return containsPattern(entry.normalizedSearchText, [
    new RegExp(`п\\.?\\s*[«"]?${escapedPoint}[»"]?`, "u"),
    new RegExp(`пункт\\s*[«"]?${escapedPoint}[»"]?`, "u"),
  ]);
}

function scoreTitleHint(normalizedLawTitle: string, lawTitleHint: string | null) {
  if (!lawTitleHint) {
    return 0;
  }

  const normalizedHint = normalizeText(lawTitleHint);

  if (normalizedHint.length === 0) {
    return 0;
  }

  if (normalizedLawTitle === normalizedHint) {
    return 5;
  }

  if (normalizedLawTitle.includes(normalizedHint) || normalizedHint.includes(normalizedLawTitle)) {
    return 4;
  }

  const hintTokens = normalizedHint.split(" ").filter((token) => token.length >= 3);

  return hintTokens.filter((token) => normalizedLawTitle.includes(token)).length;
}

function aggregateByLaw(
  entries: ResolverIndexedEntry[],
  lawTitleHint: string | null,
): ResolverLawAggregate[] {
  return Array.from(
    new Map(entries.map((entry) => [entry.lawId, entry])).values(),
  ).map((entry) => {
    const lawEntries = entries.filter((candidate) => candidate.lawId === entry.lawId);

    return {
      lawId: entry.lawId,
      lawTitle: entry.lawTitle,
      titleHintScore: scoreTitleHint(entry.normalizedLawTitle, lawTitleHint),
      classificationPrimary: entry.classificationOverride === "primary",
      lawKindPrimary: entry.lawKind === "primary",
      relatedPrimaryNull: entry.relatedPrimaryLawId === null,
      entries: lawEntries,
    } satisfies ResolverLawAggregate;
  });
}

function compareLawPreference(
  left: ResolverLawAggregate,
  right: ResolverLawAggregate,
) {
  if (left.classificationPrimary !== right.classificationPrimary) {
    return left.classificationPrimary ? -1 : 1;
  }

  if (left.lawKindPrimary !== right.lawKindPrimary) {
    return left.lawKindPrimary ? -1 : 1;
  }

  if (left.relatedPrimaryNull !== right.relatedPrimaryNull) {
    return left.relatedPrimaryNull ? -1 : 1;
  }

  if (right.titleHintScore !== left.titleHintScore) {
    return right.titleHintScore - left.titleHintScore;
  }

  return left.lawTitle.localeCompare(right.lawTitle, "ru");
}

function pickPreferredLawCandidates(
  candidates: ResolverLawAggregate[],
): ResolverLawAggregate[] {
  if (candidates.length <= 1) {
    return candidates;
  }

  const sortedByTitleHint = [...candidates].sort((left, right) => {
    if (right.titleHintScore !== left.titleHintScore) {
      return right.titleHintScore - left.titleHintScore;
    }

    return left.lawTitle.localeCompare(right.lawTitle, "ru");
  });
  const bestTitleHintCandidate = sortedByTitleHint[0];
  const secondTitleHintCandidate = sortedByTitleHint[1] ?? null;

  if (
    bestTitleHintCandidate &&
    bestTitleHintCandidate.titleHintScore > 0 &&
    secondTitleHintCandidate &&
    bestTitleHintCandidate.titleHintScore > secondTitleHintCandidate.titleHintScore
  ) {
    return [bestTitleHintCandidate];
  }

  const sorted = [...candidates].sort(compareLawPreference);
  const best = sorted[0];

  if (!best) {
    return [];
  }

  const bestTuple = [
    best.classificationPrimary,
    best.lawKindPrimary,
    best.relatedPrimaryNull,
  ].join("|");

  const topPrimaryRanked = sorted.filter((candidate) => {
    return [
      candidate.classificationPrimary,
      candidate.lawKindPrimary,
      candidate.relatedPrimaryNull,
    ].join("|") === bestTuple;
  });

  if (topPrimaryRanked.length === 1) {
    return topPrimaryRanked;
  }

  const bestTitleHintScore = Math.max(...topPrimaryRanked.map((candidate) => candidate.titleHintScore));
  const titleHintWinners = topPrimaryRanked.filter(
    (candidate) => candidate.titleHintScore === bestTitleHintScore,
  );

  return titleHintWinners;
}

function dedupeByKey<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildCollisionCandidates(input: {
  entries: ResolverIndexedEntry[];
  articleNumber: string;
  lawFamily: LawFamily;
}) {
  return dedupeByKey(
    input.entries
      .filter((entry) => entry.articleNumberNormalized === input.articleNumber)
      .filter((entry) => entry.lawFamily !== input.lawFamily)
      .map((entry) => ({
        lawId: entry.lawId,
        lawTitle: entry.lawTitle,
        lawFamily: entry.lawFamily,
        articleNumber: entry.articleNumberNormalized,
        lawBlockId: entry.lawBlockId,
      })),
    (candidate) => candidate.lawBlockId,
  );
}

function buildScopedSameLawEntries(input: {
  sameLawEntries: ResolverIndexedEntry[];
  matchedEntries: ResolverIndexedEntry[];
  articleNumber: string;
}) {
  return input.sameLawEntries.filter((entry) => {
    if (entry.articleNumberNormalized === input.articleNumber) {
      return true;
    }

    return input.matchedEntries.some(
      (matchedEntry) => Math.abs(matchedEntry.blockOrder - entry.blockOrder) <= 1,
    );
  });
}

function buildHeuristicHits(scopedEntries: ResolverIndexedEntry[]) {
  const noteExceptionCommentHits: LegalCitationHeuristicHit[] = [];
  const crossReferenceHits: LegalCitationHeuristicHit[] = [];

  for (const entry of scopedEntries) {
    if (NOTE_PATTERN.test(entry.normalizedSearchText)) {
      noteExceptionCommentHits.push({
        lawBlockId: entry.lawBlockId,
        lawId: entry.lawId,
        lawTitle: entry.lawTitle,
        markerType: "note",
        blockTitle: entry.blockTitle,
      });
    }

    if (COMMENT_PATTERN.test(entry.normalizedSearchText)) {
      noteExceptionCommentHits.push({
        lawBlockId: entry.lawBlockId,
        lawId: entry.lawId,
        lawTitle: entry.lawTitle,
        markerType: "comment",
        blockTitle: entry.blockTitle,
      });
    }

    if (containsPattern(entry.normalizedSearchText, EXCEPTION_PATTERNS)) {
      noteExceptionCommentHits.push({
        lawBlockId: entry.lawBlockId,
        lawId: entry.lawId,
        lawTitle: entry.lawTitle,
        markerType: "exception",
        blockTitle: entry.blockTitle,
      });
    }

    if (containsPattern(entry.normalizedSearchText, CROSS_REFERENCE_PATTERNS)) {
      crossReferenceHits.push({
        lawBlockId: entry.lawBlockId,
        lawId: entry.lawId,
        lawTitle: entry.lawTitle,
        markerType: "cross_reference",
        blockTitle: entry.blockTitle,
      });
    }
  }

  return {
    noteExceptionCommentHits: dedupeByKey(
      noteExceptionCommentHits,
      (hit) => `${hit.lawBlockId}:${hit.markerType}`,
    ),
    crossReferenceHits: dedupeByKey(
      crossReferenceHits,
      (hit) => `${hit.lawBlockId}:${hit.markerType}`,
    ),
  };
}

function buildSameLawCompanionCandidates(input: {
  sameLawEntries: ResolverIndexedEntry[];
  matchedEntries: ResolverIndexedEntry[];
  articleNumber: string;
}) {
  const matchedBlockIds = new Set(input.matchedEntries.map((entry) => entry.lawBlockId));
  const companions: LegalCitationCompanionCandidate[] = [];

  for (const entry of input.sameLawEntries) {
    if (matchedBlockIds.has(entry.lawBlockId)) {
      continue;
    }

    if (entry.articleNumberNormalized === input.articleNumber) {
      companions.push({
        lawBlockId: entry.lawBlockId,
        lawId: entry.lawId,
        lawTitle: entry.lawTitle,
        blockTitle: entry.blockTitle,
        blockType: entry.blockType,
        blockOrder: entry.blockOrder,
        reason: "same_article_number",
      });
    }

    if (
      input.matchedEntries.some(
        (matchedEntry) => Math.abs(matchedEntry.blockOrder - entry.blockOrder) <= 1,
      )
    ) {
      companions.push({
        lawBlockId: entry.lawBlockId,
        lawId: entry.lawId,
        lawTitle: entry.lawTitle,
        blockTitle: entry.blockTitle,
        blockType: entry.blockType,
        blockOrder: entry.blockOrder,
        reason: "neighboring_block",
      });
    }

    if (NOTE_PATTERN.test(entry.normalizedSearchText)) {
      companions.push({
        lawBlockId: entry.lawBlockId,
        lawId: entry.lawId,
        lawTitle: entry.lawTitle,
        blockTitle: entry.blockTitle,
        blockType: entry.blockType,
        blockOrder: entry.blockOrder,
        reason: "note_like",
      });
    }

    if (COMMENT_PATTERN.test(entry.normalizedSearchText)) {
      companions.push({
        lawBlockId: entry.lawBlockId,
        lawId: entry.lawId,
        lawTitle: entry.lawTitle,
        blockTitle: entry.blockTitle,
        blockType: entry.blockType,
        blockOrder: entry.blockOrder,
        reason: "comment_like",
      });
    }

    if (containsPattern(entry.normalizedSearchText, EXCEPTION_PATTERNS)) {
      companions.push({
        lawBlockId: entry.lawBlockId,
        lawId: entry.lawId,
        lawTitle: entry.lawTitle,
        blockTitle: entry.blockTitle,
        blockType: entry.blockType,
        blockOrder: entry.blockOrder,
        reason: "exception_like",
      });
    }

    if (containsPattern(entry.normalizedSearchText, CROSS_REFERENCE_PATTERNS)) {
      companions.push({
        lawBlockId: entry.lawBlockId,
        lawId: entry.lawId,
        lawTitle: entry.lawTitle,
        blockTitle: entry.blockTitle,
        blockType: entry.blockType,
        blockOrder: entry.blockOrder,
        reason: "cross_reference_like",
      });
    }
  }

  return dedupeByKey(
    companions,
    (candidate) => `${candidate.lawBlockId}:${candidate.reason}`,
  );
}

function buildBaseReport(input: {
  citation: ExplicitLegalCitation;
  status: LegalCitationResolutionStatus;
  reason: LegalCitationResolutionReason | null;
}): LegalCitationResolutionReport {
  return {
    rawCitation: input.citation.raw,
    normalizedCitation: input.citation.normalized,
    lawCode: input.citation.lawCode,
    lawFamily: input.citation.lawFamily,
    resolutionStatus: input.status,
    resolutionReason: input.reason,
    resolvedBlockId: null,
    resolvedLawSourceId: null,
    matchedLawTitle: null,
    matchedBlockTitle: null,
    matchedArticleNumber: null,
    partSupport: {
      requestedPart: input.citation.partNumber,
      textualHintFound: false,
      diagnosticGap: null,
    },
    pointSupport: {
      requestedPoint: input.citation.pointNumber,
      textualHintFound: false,
      diagnosticGap: null,
    },
    collisionCandidates: [],
    sameLawCompanionCandidates: [],
    noteExceptionCommentHits: [],
    crossReferenceHits: [],
  };
}

export function buildLegalCitationResolverEntriesFromLawBlocks(
  blocks: LegalCitationResolverLawBlockLike[],
): LegalCitationResolverCorpusEntry[] {
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
        lawKind: law.lawKind ?? null,
        relatedPrimaryLawId: law.relatedPrimaryLawId ?? null,
        classificationOverride: law.classificationOverride ?? null,
        blockType: block.blockType,
        blockOrder: block.blockOrder,
        articleNumberNormalized: block.articleNumberNormalized,
        blockTitle: block.blockTitle,
        blockText: block.blockText,
      } satisfies LegalCitationResolverCorpusEntry;
    })
    .filter((entry): entry is LegalCitationResolverCorpusEntry => Boolean(entry));
}

export function resolveExplicitLegalCitation(input: {
  citation: ExplicitLegalCitation;
  corpusEntries: LegalCitationResolverCorpusEntry[];
  options?: ResolveExplicitLegalCitationOptions;
}): LegalCitationResolutionReport {
  const report = buildBaseReport({
    citation: input.citation,
    status: "unresolved",
    reason: null,
  });
  const indexedEntries = buildResolverIndex(input.corpusEntries);

  if (input.citation.lawFamily === null) {
    return {
      ...report,
      resolutionStatus: "unresolved",
      resolutionReason: "no_law_candidate",
    };
  }

  const familyEntries = indexedEntries.filter(
    (entry) => entry.lawFamily === input.citation.lawFamily,
  );

  if (familyEntries.length === 0) {
    return {
      ...report,
      resolutionStatus: "unresolved",
      resolutionReason: "no_law_candidate",
    };
  }

  const matchedArticleEntries = familyEntries.filter(
    (entry) =>
      entry.blockType === "article" &&
      entry.articleNumberNormalized === input.citation.articleNumber,
  );

  const collisionCandidates = input.options?.includeCrossFamilyCollisions === false
    ? []
    : buildCollisionCandidates({
        entries: indexedEntries,
        articleNumber: input.citation.articleNumber,
        lawFamily: input.citation.lawFamily,
      });

  if (matchedArticleEntries.length === 0) {
    return {
      ...report,
      resolutionStatus: "unresolved",
      resolutionReason: "no_article",
      collisionCandidates,
    };
  }

  const preferredLaws = pickPreferredLawCandidates(
    aggregateByLaw(matchedArticleEntries, input.citation.lawTitleHint),
  );

  if (preferredLaws.length !== 1) {
    return {
      ...report,
      resolutionStatus: "ambiguous",
      resolutionReason: "same_family_multi_law_ambiguous",
      collisionCandidates,
      matchedArticleNumber: input.citation.articleNumber,
    };
  }

  const resolvedLaw = preferredLaws[0];
  const resolvedEntries = resolvedLaw.entries.filter(
    (entry) =>
      entry.blockType === "article" &&
      entry.articleNumberNormalized === input.citation.articleNumber,
  );
  const resolvedEntry = resolvedEntries[0] ?? null;

  if (!resolvedEntry) {
    return {
      ...report,
      resolutionStatus: "unresolved",
      resolutionReason: "no_article",
      collisionCandidates,
    };
  }

  const sameLawEntries = familyEntries.filter((entry) => entry.lawId === resolvedLaw.lawId);
  const scopedEntries = buildScopedSameLawEntries({
    sameLawEntries,
    matchedEntries: resolvedEntries,
    articleNumber: input.citation.articleNumber,
  });
  const heuristicHits = buildHeuristicHits(scopedEntries);
  const sameLawCompanionCandidates = buildSameLawCompanionCandidates({
    sameLawEntries: scopedEntries,
    matchedEntries: resolvedEntries,
    articleNumber: input.citation.articleNumber,
  });
  const partTextualHintFound = input.citation.partNumber
    ? resolvedEntries.some((entry) => hasPartTextualHint(entry, input.citation.partNumber ?? ""))
    : false;
  const pointTextualHintFound = input.citation.pointNumber
    ? resolvedEntries.some((entry) => hasPointTextualHint(entry, input.citation.pointNumber ?? ""))
    : false;

  let resolutionStatus: LegalCitationResolutionStatus = "resolved";
  let resolutionReason: LegalCitationResolutionReason | null = null;

  if (input.citation.pointNumber && !pointTextualHintFound) {
    resolutionStatus = "partially_supported";
    resolutionReason = "no_point_metadata";
  } else if (input.citation.partNumber && !partTextualHintFound) {
    resolutionStatus = "partially_supported";
    resolutionReason = "no_part_metadata";
  }

  return {
    ...report,
    resolutionStatus,
    resolutionReason,
    resolvedBlockId: resolvedEntry.lawBlockId,
    resolvedLawSourceId: resolvedEntry.lawId,
    matchedLawTitle: resolvedEntry.lawTitle,
    matchedBlockTitle: resolvedEntry.blockTitle,
    matchedArticleNumber: resolvedEntry.articleNumberNormalized,
    partSupport: {
      requestedPart: input.citation.partNumber,
      textualHintFound: partTextualHintFound,
      diagnosticGap:
        input.citation.partNumber && !partTextualHintFound ? "no_part_metadata" : null,
    },
    pointSupport: {
      requestedPoint: input.citation.pointNumber,
      textualHintFound: pointTextualHintFound,
      diagnosticGap:
        input.citation.pointNumber && !pointTextualHintFound ? "no_point_metadata" : null,
    },
    collisionCandidates,
    sameLawCompanionCandidates,
    noteExceptionCommentHits: heuristicHits.noteExceptionCommentHits,
    crossReferenceHits: heuristicHits.crossReferenceHits,
  };
}

export function buildLegalCitationResolutionReport(input: {
  citation: ExplicitLegalCitation;
  corpusEntries: LegalCitationResolverCorpusEntry[];
  options?: ResolveExplicitLegalCitationOptions;
}) {
  return resolveExplicitLegalCitation(input);
}
