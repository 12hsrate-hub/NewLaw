import { createHash } from "node:crypto";

import { listCurrentLawBlocksByServer } from "@/db/repositories/law.repository";
import { searchCurrentLawCorpusInputSchema } from "@/schemas/law-corpus";

type RetrievalDependencies = {
  listCurrentLawBlocksByServer: typeof listCurrentLawBlocksByServer;
  now: () => Date;
};

const defaultDependencies: RetrievalDependencies = {
  listCurrentLawBlocksByServer,
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

function scoreLawBlock(
  input: {
    blockType: "section" | "chapter" | "article" | "appendix" | "unstructured";
    blockTitle: string | null;
    blockText: string;
    articleNumberNormalized: string | null;
    lawTitle: string;
  },
  query: string,
  queryTokens: string[],
) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedLawTitle = normalizeSearchText(input.lawTitle);
  const normalizedBlockTitle = normalizeSearchText(input.blockTitle ?? "");
  const normalizedBlockText = normalizeSearchText(input.blockText);
  const normalizedArticleNumber = normalizeSearchText(input.articleNumberNormalized ?? "");
  let score = input.blockType === "article" ? 12 : 0;

  if (normalizedArticleNumber && normalizedQuery === normalizedArticleNumber) {
    score += 80;
  }

  if (normalizedBlockTitle.includes(normalizedQuery) || normalizedLawTitle.includes(normalizedQuery)) {
    score += 28;
  }

  if (normalizedBlockText.includes(normalizedQuery)) {
    score += 20;
  }

  for (const token of queryTokens) {
    if (normalizedArticleNumber && normalizedArticleNumber === token) {
      score += 36;
    }

    if (normalizedLawTitle.includes(token)) {
      score += 10;
    }

    if (normalizedBlockTitle.includes(token)) {
      score += 12;
    }

    if (normalizedBlockText.includes(token)) {
      score += 8;
    }
  }

  return score;
}

function getBlockTypePriority(blockType: "section" | "chapter" | "article" | "appendix" | "unstructured") {
  switch (blockType) {
    case "article":
      return 0;
    case "chapter":
      return 1;
    case "section":
      return 2;
    case "appendix":
      return 3;
    default:
      return 4;
  }
}

function buildCorpusSnapshotMetadata(
  blocks: Awaited<ReturnType<typeof listCurrentLawBlocksByServer>>,
  serverId: string,
  generatedAt: Date,
) {
  const currentVersionEntries = Array.from(
    new Map(
      blocks.map((block) => [
        block.lawVersion.id,
        {
          lawId: block.lawVersion.currentForLaw?.id ?? block.lawVersion.lawId,
          lawVersionId: block.lawVersion.id,
          normalizedTextHash: block.lawVersion.normalizedTextHash,
        },
      ]),
    ).values(),
  ).sort((left, right) => left.lawVersionId.localeCompare(right.lawVersionId));
  const snapshotInput = currentVersionEntries
    .map((entry) => `${entry.lawId}:${entry.lawVersionId}:${entry.normalizedTextHash}`)
    .join("|");

  return {
    serverId,
    generatedAt: generatedAt.toISOString(),
    currentVersionIds: currentVersionEntries.map((entry) => entry.lawVersionId),
    corpusSnapshotHash: createHash("sha256").update(snapshotInput).digest("hex"),
  };
}

export async function searchCurrentLawCorpus(
  input: {
    serverId: string;
    query: string;
    limit?: number;
    includeSupplements?: boolean;
  },
  dependencies: RetrievalDependencies = defaultDependencies,
) {
  const parsed = searchCurrentLawCorpusInputSchema.parse(input);
  const queryTokens = tokenizeQuery(parsed.query);
  const candidateBlocks = await dependencies.listCurrentLawBlocksByServer({
    serverId: parsed.serverId,
    includeSupplements: parsed.includeSupplements,
  });
  const generatedAt = dependencies.now();
  const corpusSnapshot = buildCorpusSnapshotMetadata(candidateBlocks, parsed.serverId, generatedAt);

  const scoredResults = candidateBlocks
    .map((block) => {
      const law = block.lawVersion.currentForLaw;

      if (!law) {
        return null;
      }

      const score = scoreLawBlock(
        {
          blockType: block.blockType,
          blockTitle: block.blockTitle,
          blockText: block.blockText,
          articleNumberNormalized: block.articleNumberNormalized,
          lawTitle: law.title,
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
        lawId: law.id,
        lawKey: law.lawKey,
        lawTitle: law.title,
        lawVersionId: block.lawVersion.id,
        lawVersionStatus: block.lawVersion.status,
        lawBlockId: block.id,
        blockType: block.blockType,
        blockOrder: block.blockOrder,
        articleNumberNormalized: block.articleNumberNormalized,
        snippet: buildSnippet(block.blockText, queryTokens),
        blockText: block.blockText,
        sourceTopicUrl: law.topicUrl,
        sourcePosts: block.lawVersion.sourcePosts.map((sourcePost) => ({
          postExternalId: sourcePost.postExternalId,
          postUrl: sourcePost.postUrl,
          postOrder: sourcePost.postOrder,
        })),
        metadata: {
          sourceSnapshotHash: block.lawVersion.sourceSnapshotHash,
          normalizedTextHash: block.lawVersion.normalizedTextHash,
          corpusSnapshotHash: corpusSnapshot.corpusSnapshotHash,
        },
      };
    })
    .filter((result) => result !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const blockTypeDelta = getBlockTypePriority(left.blockType) - getBlockTypePriority(right.blockType);

      if (blockTypeDelta !== 0) {
        return blockTypeDelta;
      }

      return left.blockOrder - right.blockOrder;
    });
  const articleResults = scoredResults.filter((result) => result.blockType === "article");
  const selectedResults = (articleResults.length > 0 ? articleResults : scoredResults).slice(0, parsed.limit);

  return {
    query: parsed.query,
    serverId: parsed.serverId,
    resultCount: selectedResults.length,
    corpusSnapshot,
    results: selectedResults,
  };
}
