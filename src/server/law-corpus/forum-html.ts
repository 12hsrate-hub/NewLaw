import { createHash } from "node:crypto";

const forumBaseUrl = "https://forum.gta5rp.com";

export type ForumTopicCandidate = {
  topicUrl: string;
  topicExternalId: string;
  title: string;
};

type ForumAnchorMatch = {
  attributes: string;
  href: string;
  innerHtml: string;
};

export type ParsedForumPost = {
  postExternalId: string;
  postUrl: string;
  postOrder: number;
  authorName: string | null;
  postedAt: Date | null;
  rawHtml: string;
  rawText: string;
  normalizedTextFragment: string;
};

function decodeHtmlEntities(input: string) {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, value: string) => {
    const normalizedValue = value.toLowerCase();

    if (normalizedValue === "quot") {
      return '"';
    }

    if (normalizedValue === "amp") {
      return "&";
    }

    if (normalizedValue === "lt") {
      return "<";
    }

    if (normalizedValue === "gt") {
      return ">";
    }

    if (normalizedValue === "nbsp") {
      return " ";
    }

    if (normalizedValue === "#039" || normalizedValue === "#39") {
      return "'";
    }

    if (normalizedValue === "#8203") {
      return "";
    }

    if (normalizedValue.startsWith("#x")) {
      const codePoint = Number.parseInt(normalizedValue.slice(2), 16);

      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    if (normalizedValue.startsWith("#")) {
      const codePoint = Number.parseInt(normalizedValue.slice(1), 10);

      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    return entity;
  });
}

function stripHtmlTags(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|ul|ol|blockquote|section|article|h[1-6])>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n");
}

function normalizeLines(input: string) {
  return input
    .replace(/\u200b/g, "")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForumText(input: string) {
  return normalizeLines(decodeHtmlEntities(stripHtmlTags(input)));
}

function toAbsoluteForumUrl(input: string) {
  return new URL(input, forumBaseUrl).toString();
}

function normalizeForumPageUrl(input: string) {
  const url = new URL(input, forumBaseUrl);

  url.hash = "";

  return url.toString();
}

export function extractTopicExternalIdFromUrl(topicUrl: string) {
  const match = topicUrl.match(/\.([0-9]+)\/?$/);

  if (match?.[1]) {
    return match[1];
  }

  throw new Error("Не удалось извлечь topic_external_id из URL темы.");
}

function extractForumAnchors(html: string) {
  const anchorPattern = /<a\b([^>]*)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi;

  return [...html.matchAll(anchorPattern)].map(
    (match): ForumAnchorMatch => ({
      attributes: `${match[1] ?? ""} ${match[3] ?? ""}`.trim(),
      href: match[2] ?? "",
      innerHtml: match[4] ?? "",
    }),
  );
}

function findBalancedDivFragment(html: string, startIndex: number) {
  let cursor = startIndex;
  let depth = 0;

  while (cursor < html.length) {
    const nextOpen = html.indexOf("<div", cursor);
    const nextClose = html.indexOf("</div>", cursor);

    if (nextClose === -1) {
      return null;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + 4;
      continue;
    }

    depth -= 1;
    cursor = nextClose + 6;

    if (depth === 0) {
      return html.slice(startIndex, cursor);
    }
  }

  return null;
}

function extractBbWrapperHtml(articleChunk: string) {
  const wrapperIndex = articleChunk.indexOf('<div class="bbWrapper">');

  if (wrapperIndex === -1) {
    return "";
  }

  return findBalancedDivFragment(articleChunk, wrapperIndex) ?? "";
}

function splitForumArticles(threadHtml: string) {
  const articleStartPattern = /<article class="message message--post[\s\S]*?data-content="post-[0-9]+"/g;
  const starts = [...threadHtml.matchAll(articleStartPattern)];

  return starts.map((match, index) => {
    const startIndex = match.index ?? 0;
    const endIndex =
      index + 1 < starts.length ? (starts[index + 1]?.index ?? threadHtml.length) : threadHtml.length;

    return threadHtml.slice(startIndex, endIndex);
  });
}

export function parseForumIndexCandidates(indexHtml: string) {
  const candidatesByTopicId = new Map<string, ForumTopicCandidate>();

  for (const anchor of extractForumAnchors(indexHtml)) {
    if (!anchor.href.startsWith("/threads/")) {
      continue;
    }

    if (!/data-tp-primary="on"/i.test(anchor.attributes)) {
      continue;
    }

    const href = anchor.href;
    const rawTitle = anchor.innerHtml;

    if (!href || !rawTitle) {
      continue;
    }

    const topicUrl = toAbsoluteForumUrl(href);
    const topicExternalId = extractTopicExternalIdFromUrl(topicUrl);
    const title = normalizeLines(decodeHtmlEntities(stripHtmlTags(rawTitle)));

    if (!title) {
      continue;
    }

    candidatesByTopicId.set(topicExternalId, {
      topicUrl,
      topicExternalId,
      title,
    });
  }

  return [...candidatesByTopicId.values()];
}

export function parseForumIndexPaginationUrls(indexHtml: string, indexUrl: string) {
  const rootUrl = new URL(indexUrl, forumBaseUrl);
  const normalizedRootPath = rootUrl.pathname.replace(/\/+$/, "");
  const pageUrls = new Set<string>();

  for (const anchor of extractForumAnchors(indexHtml)) {
    if (
      !/pageNav-page|pageNav-jump--next|rel="next"/i.test(anchor.attributes) &&
      !/pageNav-page|pageNav-jump--next/i.test(anchor.innerHtml)
    ) {
      continue;
    }

    const nextUrl = new URL(anchor.href, rootUrl);
    const normalizedNextPath = nextUrl.pathname.replace(/\/+$/, "");

    if (nextUrl.origin !== rootUrl.origin) {
      continue;
    }

    if (!normalizedNextPath.startsWith(normalizedRootPath)) {
      continue;
    }

    pageUrls.add(normalizeForumPageUrl(nextUrl.toString()));
  }

  pageUrls.delete(normalizeForumPageUrl(rootUrl.toString()));

  return [...pageUrls.values()].sort((left, right) => left.localeCompare(right));
}

export function parseForumTopicPosts(threadHtml: string, topicUrl: string) {
  const articleChunks = splitForumArticles(threadHtml);

  return articleChunks
    .map((articleChunk, postOrder): ParsedForumPost | null => {
      const postExternalId =
        articleChunk.match(/data-content="post-([0-9]+)"/)?.[1] ??
        articleChunk.match(/js-post-([0-9]+)/)?.[1];

      if (!postExternalId) {
        return null;
      }

      const relativePostUrl =
        articleChunk.match(/href="([^"]*\/post-[0-9]+)"/)?.[1] ?? `${topicUrl}post-${postExternalId}`;
      const authorName = decodeHtmlEntities(articleChunk.match(/data-author="([^"]+)"/)?.[1] ?? "").trim();
      const postedAtRaw = articleChunk.match(/<time\b[^>]*datetime="([^"]+)"/)?.[1] ?? null;
      const rawHtml = extractBbWrapperHtml(articleChunk);
      const rawText = normalizeForumText(rawHtml);

      return {
        postExternalId,
        postUrl: toAbsoluteForumUrl(relativePostUrl),
        postOrder,
        authorName: authorName || null,
        postedAt: postedAtRaw ? new Date(postedAtRaw) : null,
        rawHtml,
        rawText,
        normalizedTextFragment: rawText,
      };
    })
    .filter((post): post is ParsedForumPost => post !== null);
}

export function buildNormalizedLawText(posts: Pick<ParsedForumPost, "normalizedTextFragment">[]) {
  return posts
    .map((post) => normalizeLines(post.normalizedTextFragment))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function buildSourceSnapshotHash(posts: Pick<ParsedForumPost, "postExternalId" | "normalizedTextFragment">[]) {
  const payload = posts
    .map((post) => `${post.postExternalId}:${normalizeLines(post.normalizedTextFragment)}`)
    .join("\n---\n");

  return createHash("sha256").update(payload).digest("hex");
}

export function buildNormalizedTextHash(normalizedFullText: string) {
  return createHash("sha256").update(normalizedFullText.trim()).digest("hex");
}
