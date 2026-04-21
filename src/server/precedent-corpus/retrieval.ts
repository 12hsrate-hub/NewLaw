import { createHash } from "node:crypto";

import { listCurrentPrecedentBlocksByServer } from "@/db/repositories/precedent.repository";
import { searchCurrentPrecedentCorpusInputSchema } from "@/schemas/precedent-corpus";

type RetrievalDependencies = {
  listCurrentPrecedentBlocksByServer: typeof listCurrentPrecedentBlocksByServer;
  now: () => Date;
};

const defaultDependencies: RetrievalDependencies = {
  listCurrentPrecedentBlocksByServer,
  now: () => new Date(),
};

function normalizeSearchText(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenizeQuery(input: string) {
  return Array.from(new Set(normalizeSearchText(input).match(/[\p{L}\p{N}._-]+/gu) ?? [])).filter(
    (token) => token.length >= 2,
  );
}

function buildSnippet(blockText: string, queryTokens: string[]) {
  const normalizedBlockText = normalizeSearchText(blockText);
  const firstMatchToken = queryTokens.find((token) => normalizedBlockText.includes(token));

  if (!firstMatchToken) {
    return blockText.slice(0, 280).trim();
  }

  const startIndex = normalizedBlockText.indexOf(firstMatchToken);
  const snippetStart = Math.max(0, startIndex - 120);
  const snippetEnd = Math.min(blockText.length, startIndex + 220);
  const prefix = snippetStart > 0 ? "..." : "";
  const suffix = snippetEnd < blockText.length ? "..." : "";

  return `${prefix}${blockText.slice(snippetStart, snippetEnd).trim()}${suffix}`;
}

function getPrecedentBlockTypePriority(
  blockType: "facts" | "issue" | "holding" | "reasoning" | "resolution" | "unstructured",
) {
  switch (blockType) {
    case "holding":
      return 0;
    case "resolution":
      return 1;
    case "reasoning":
      return 2;
    case "issue":
      return 3;
    case "facts":
      return 4;
    default:
      return 5;
  }
}

function scorePrecedentBlock(
  input: {
    blockType: "facts" | "issue" | "holding" | "reasoning" | "resolution" | "unstructured";
    blockTitle: string | null;
    blockText: string;
    precedentTitle: string;
  },
  query: string,
  queryTokens: string[],
) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedPrecedentTitle = normalizeSearchText(input.precedentTitle);
  const normalizedBlockTitle = normalizeSearchText(input.blockTitle ?? "");
  const normalizedBlockText = normalizeSearchText(input.blockText);
  let score = 0;
  let hasDirectMatch = false;

  if (normalizedPrecedentTitle.includes(normalizedQuery) || normalizedBlockTitle.includes(normalizedQuery)) {
    score += 24;
    hasDirectMatch = true;
  }

  if (normalizedBlockText.includes(normalizedQuery)) {
    score += 18;
    hasDirectMatch = true;
  }

  for (const token of queryTokens) {
    if (normalizedPrecedentTitle.includes(token)) {
      score += 10;
      hasDirectMatch = true;
    }

    if (normalizedBlockTitle.includes(token)) {
      score += 9;
      hasDirectMatch = true;
    }

    if (normalizedBlockText.includes(token)) {
      score += 7;
      hasDirectMatch = true;
    }
  }

  if (hasDirectMatch) {
    switch (input.blockType) {
      case "holding":
        score += 12;
        break;
      case "resolution":
        score += 10;
        break;
      case "reasoning":
        score += 8;
        break;
      case "issue":
        score += 4;
        break;
      default:
        score += 0;
    }
  }

  return score;
}

function buildCorpusSnapshotMetadata(
  blocks: Awaited<ReturnType<typeof listCurrentPrecedentBlocksByServer>>,
  serverId: string,
  generatedAt: Date,
) {
  const currentVersionEntries = Array.from(
    new Map(
      blocks.map((block) => [
        block.precedentVersion.id,
        {
          precedentId: block.precedentVersion.currentForPrecedent?.id ?? block.precedentVersion.precedentId,
          precedentVersionId: block.precedentVersion.id,
          normalizedTextHash: block.precedentVersion.normalizedTextHash,
          validityStatus: block.precedentVersion.currentForPrecedent?.validityStatus ?? "applicable",
        },
      ]),
    ).values(),
  ).sort((left, right) => left.precedentVersionId.localeCompare(right.precedentVersionId));
  const snapshotInput = currentVersionEntries
    .map(
      (entry) =>
        `${entry.precedentId}:${entry.precedentVersionId}:${entry.normalizedTextHash}:${entry.validityStatus}`,
    )
    .join("|");

  return {
    serverId,
    generatedAt: generatedAt.toISOString(),
    currentVersionIds: currentVersionEntries.map((entry) => entry.precedentVersionId),
    corpusSnapshotHash: createHash("sha256").update(snapshotInput).digest("hex"),
  };
}

export async function searchCurrentPrecedentCorpus(
  input: {
    serverId: string;
    query: string;
    limit?: number;
    includeValidityStatuses?: Array<"applicable" | "limited" | "obsolete">;
  },
  dependencies: RetrievalDependencies = defaultDependencies,
) {
  const parsed = searchCurrentPrecedentCorpusInputSchema.parse(input);
  const queryTokens = tokenizeQuery(parsed.query);
  const candidateBlocks = await dependencies.listCurrentPrecedentBlocksByServer({
    serverId: parsed.serverId,
    includeValidityStatuses: parsed.includeValidityStatuses,
  });
  const generatedAt = dependencies.now();
  const corpusSnapshot = buildCorpusSnapshotMetadata(candidateBlocks, parsed.serverId, generatedAt);

  const scoredResults = candidateBlocks
    .map((block) => {
      const precedent = block.precedentVersion.currentForPrecedent;

      if (!precedent) {
        return null;
      }

      const score = scorePrecedentBlock(
        {
          blockType: block.blockType,
          blockTitle: block.blockTitle,
          blockText: block.blockText,
          precedentTitle: precedent.displayTitle,
        },
        parsed.query,
        queryTokens,
      );

      if (score <= 0) {
        return null;
      }

      return {
        score,
        serverId: parsed.serverId,
        precedentId: precedent.id,
        precedentKey: precedent.precedentKey,
        precedentTitle: precedent.displayTitle,
        precedentVersionId: block.precedentVersion.id,
        precedentVersionStatus: block.precedentVersion.status,
        precedentBlockId: block.id,
        blockType: block.blockType,
        blockOrder: block.blockOrder,
        snippet: buildSnippet(block.blockText, queryTokens),
        blockText: block.blockText,
        validityStatus: precedent.validityStatus,
        sourceTopicUrl: precedent.sourceTopic.topicUrl,
        sourceTopicTitle: precedent.sourceTopic.title,
        sourcePosts: block.precedentVersion.sourcePosts.map((sourcePost) => ({
          postExternalId: sourcePost.postExternalId,
          postUrl: sourcePost.postUrl,
          postOrder: sourcePost.postOrder,
        })),
        metadata: {
          sourceSnapshotHash: block.precedentVersion.sourceSnapshotHash,
          normalizedTextHash: block.precedentVersion.normalizedTextHash,
          corpusSnapshotHash: corpusSnapshot.corpusSnapshotHash,
        },
      };
    })
    .filter((result) => result !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const blockTypeDelta = getPrecedentBlockTypePriority(left.blockType) - getPrecedentBlockTypePriority(right.blockType);

      if (blockTypeDelta !== 0) {
        return blockTypeDelta;
      }

      return left.blockOrder - right.blockOrder;
    });

  const preferredPools = [
    scoredResults.filter((result) => result.blockType === "holding"),
    scoredResults.filter((result) => result.blockType === "resolution"),
    scoredResults.filter((result) => result.blockType === "reasoning"),
    scoredResults.filter((result) => result.blockType === "issue"),
    scoredResults.filter((result) => result.blockType === "facts"),
    scoredResults.filter((result) => result.blockType === "unstructured"),
  ];
  const selectedPool = preferredPools.find((pool) => pool.length > 0) ?? [];
  const selectedResults = selectedPool.slice(0, parsed.limit);

  return {
    query: parsed.query,
    serverId: parsed.serverId,
    resultCount: selectedResults.length,
    corpusSnapshot,
    results: selectedResults,
  };
}
