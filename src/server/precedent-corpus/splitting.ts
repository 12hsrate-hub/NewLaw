import type { ParsedForumPost } from "@/server/law-corpus/forum-html";
import { buildNormalizedLawText } from "@/server/law-corpus/forum-html";
import { normalizePrecedentKeyCandidate } from "@/schemas/precedent-corpus";

type ExtractedPostFragment = {
  post: ParsedForumPost;
  heading: string | null;
  text: string;
};

export type SplitPrecedentUnit = {
  precedentLocatorKey: string;
  displayTitle: string;
  normalizedFullText: string;
  sourcePosts: Array<{
    postExternalId: string;
    postUrl: string;
    postOrder: number;
    authorName: string | null;
    postedAt: Date | null;
    rawHtml: string;
    rawText: string;
    normalizedTextFragment: string;
  }>;
};

function isPrecedentHeading(line: string) {
  return [
    /^судебн(?:ый|ые)\s+прецедент(?:$|[\s:№#(.-])/iu,
    /^прецедент(?:$|[\s:№#(.-])/iu,
    /^(?:решени[ея]|постановлени[ея]|определени[ея])\s+верховного\s+суда(?:$|[\s:№#(.-])/iu,
  ].some((pattern) => pattern.test(line));
}

function splitPostIntoFragments(post: ParsedForumPost) {
  const lines = post.normalizedTextFragment
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [] as ExtractedPostFragment[];
  }

  const fragments: ExtractedPostFragment[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  const flushCurrent = () => {
    if (currentLines.length === 0) {
      return;
    }

    fragments.push({
      post,
      heading: currentHeading,
      text: currentLines.join("\n").trim(),
    });

    currentHeading = null;
    currentLines = [];
  };

  for (const line of lines) {
    if (isPrecedentHeading(line)) {
      flushCurrent();
      currentHeading = line;
      currentLines = [line];
      continue;
    }

    currentLines.push(line);
  }

  flushCurrent();

  return fragments;
}

function getFirstMeaningfulLine(input: string) {
  return (
    input
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null
  );
}

function buildUnitFromPosts(
  topicTitle: string,
  unitIndex: number,
  unitPosts: ParsedForumPost[],
): SplitPrecedentUnit | null {
  const heading = getFirstMeaningfulLine(unitPosts[0]?.normalizedTextFragment ?? "");
  const normalizedFullText = buildNormalizedLawText(unitPosts);

  if (!normalizedFullText) {
    return null;
  }

  return {
    precedentLocatorKey: `precedent_${unitIndex + 1}`,
    displayTitle: heading ?? `${topicTitle} — прецедент ${unitIndex + 1}`,
    normalizedFullText,
    sourcePosts: unitPosts.map((post) => ({
      postExternalId: post.postExternalId,
      postUrl: post.postUrl,
      postOrder: post.postOrder,
      authorName: post.authorName,
      postedAt: post.postedAt,
      rawHtml: post.rawHtml,
      rawText: post.rawText,
      normalizedTextFragment: post.normalizedTextFragment,
    })),
  };
}

function buildFallbackUnit(topicTitle: string, posts: ParsedForumPost[]): SplitPrecedentUnit[] {
  const normalizedFullText = buildNormalizedLawText(posts);

  if (!normalizedFullText) {
    return [];
  }

  return [
    {
      precedentLocatorKey: "precedent_1",
      displayTitle: topicTitle,
      normalizedFullText,
      sourcePosts: posts.map((post) => ({
        postExternalId: post.postExternalId,
        postUrl: post.postUrl,
        postOrder: post.postOrder,
        authorName: post.authorName,
        postedAt: post.postedAt,
        rawHtml: post.rawHtml,
        rawText: post.rawText,
        normalizedTextFragment: post.normalizedTextFragment,
      })),
    },
  ];
}

export function splitPrecedentSourceTopicIntoUnits(topicTitle: string, posts: ParsedForumPost[]) {
  const headedPostIndexes = posts
    .map((post, index) => ({
      index,
      heading: getFirstMeaningfulLine(post.normalizedTextFragment),
    }))
    .filter((entry) => entry.heading && isPrecedentHeading(entry.heading))
    .map((entry) => entry.index);

  if (headedPostIndexes.length > 1) {
    return headedPostIndexes
      .map((startIndex, unitIndex) => {
        const endIndex = headedPostIndexes[unitIndex + 1] ?? posts.length;

        return buildUnitFromPosts(topicTitle, unitIndex, posts.slice(startIndex, endIndex));
      })
      .filter((unit): unit is SplitPrecedentUnit => unit !== null);
  }

  const fragments = posts.flatMap((post) => splitPostIntoFragments(post));
  const explicitHeadingCount = fragments.filter((fragment) => fragment.heading).length;

  if (posts.length === 0) {
    return [] as SplitPrecedentUnit[];
  }

  if (explicitHeadingCount === 0) {
    return buildFallbackUnit(topicTitle, posts);
  }

  const pendingIntro: ExtractedPostFragment[] = [];
  const groupedUnits: ExtractedPostFragment[][] = [];
  let currentUnit: ExtractedPostFragment[] | null = null;

  const flushCurrent = () => {
    if (currentUnit && currentUnit.length > 0) {
      groupedUnits.push(currentUnit);
    }

    currentUnit = null;
  };

  for (const fragment of fragments) {
    if (fragment.heading) {
      flushCurrent();
      currentUnit = [...pendingIntro.splice(0), fragment];
      continue;
    }

    if (!currentUnit) {
      pendingIntro.push(fragment);
      continue;
    }

    currentUnit.push(fragment);
  }

  flushCurrent();

  if (groupedUnits.length === 0) {
    return buildFallbackUnit(topicTitle, posts);
  }

  if (groupedUnits.length === 1) {
    if (headedPostIndexes.length > 1) {
      return headedPostIndexes
        .map((startIndex, unitIndex) => {
          const endIndex = headedPostIndexes[unitIndex + 1] ?? posts.length;

          return buildUnitFromPosts(topicTitle, unitIndex, posts.slice(startIndex, endIndex));
        })
        .filter((unit): unit is SplitPrecedentUnit => unit !== null);
    }
  }

  const usedLocatorKeys = new Set<string>();

  return groupedUnits
    .map((unitFragments, index) => {
      const titleCandidate =
        unitFragments.find((fragment) => fragment.heading)?.heading ??
        (groupedUnits.length === 1 ? topicTitle : `${topicTitle} — прецедент ${index + 1}`);
      const normalizedLocatorCandidate = normalizePrecedentKeyCandidate(titleCandidate);
      const baseLocatorKey =
        normalizedLocatorCandidate.length >= 2 && /[a-z]/.test(normalizedLocatorCandidate)
          ? normalizedLocatorCandidate
          : `precedent_${index + 1}`;
      let precedentLocatorKey = baseLocatorKey;
      let attempt = 1;

      while (usedLocatorKeys.has(precedentLocatorKey)) {
        attempt += 1;
        precedentLocatorKey = `${baseLocatorKey.slice(0, Math.max(2, 64 - String(attempt).length - 1))}_${attempt}`;
      }

      usedLocatorKeys.add(precedentLocatorKey);

      const sourcePostsMap = new Map<string, SplitPrecedentUnit["sourcePosts"][number]>();

      for (const fragment of unitFragments) {
        const existing = sourcePostsMap.get(fragment.post.postExternalId);

        if (existing) {
          existing.normalizedTextFragment = `${existing.normalizedTextFragment}\n\n${fragment.text}`.trim();
          continue;
        }

        sourcePostsMap.set(fragment.post.postExternalId, {
          postExternalId: fragment.post.postExternalId,
          postUrl: fragment.post.postUrl,
          postOrder: fragment.post.postOrder,
          authorName: fragment.post.authorName,
          postedAt: fragment.post.postedAt,
          rawHtml: fragment.post.rawHtml,
          rawText: fragment.post.rawText,
          normalizedTextFragment: fragment.text,
        });
      }

      const sourcePosts = [...sourcePostsMap.values()].sort((left, right) => left.postOrder - right.postOrder);
      const normalizedFullText = buildNormalizedLawText(sourcePosts);

      if (!normalizedFullText) {
        return null;
      }

      return {
        precedentLocatorKey,
        displayTitle: titleCandidate,
        normalizedFullText,
        sourcePosts,
      } satisfies SplitPrecedentUnit;
    })
    .filter((unit): unit is SplitPrecedentUnit => unit !== null);
}
