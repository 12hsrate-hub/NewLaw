import type { CreateLawBlockInput } from "@/schemas/law-corpus";

type SegmentationContext = {
  blockType: CreateLawBlockInput["blockType"];
  blockTitle: string | null;
  articleNumberNormalized: string | null;
  lines: string[];
};

function isSectionHeading(line: string) {
  return /^раздел\s+[ivxlcdm0-9]+(?:[.\s-]|$)/iu.test(line);
}

function isChapterHeading(line: string) {
  return /^глава\s+[ivxlcdm0-9]+(?:[.\s-]|$)/iu.test(line);
}

function isAppendixHeading(line: string) {
  return /^приложени[ея]\b/iu.test(line);
}

function extractArticleNumber(line: string) {
  const match = line.match(/^статья\s+([a-zа-яё0-9._-]+)/iu);

  if (!match?.[1]) {
    return null;
  }

  const normalized = match[1].toLowerCase().replace(/[^a-z0-9._-]+/g, "").replace(/[._-]+$/g, "");

  return normalized || null;
}

function buildBlockInput(context: SegmentationContext, blockOrder: number): CreateLawBlockInput | null {
  const blockText = context.lines.join("\n").trim();

  if (!blockText) {
    return null;
  }

  return {
    blockType: context.blockType,
    blockOrder,
    blockTitle: context.blockTitle,
    blockText,
    parentBlockId: null,
    articleNumberNormalized: context.articleNumberNormalized,
  };
}

export function segmentLawTextIntoBlocks(normalizedFullText: string) {
  const lines = normalizedFullText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const blocks: CreateLawBlockInput[] = [];
  let current: SegmentationContext | null = null;

  const flushCurrent = () => {
    if (!current) {
      return;
    }

    const nextBlock = buildBlockInput(current, blocks.length);

    if (nextBlock) {
      blocks.push(nextBlock);
    }

    current = null;
  };

  for (const line of lines) {
    if (isSectionHeading(line)) {
      flushCurrent();
      current = {
        blockType: "section",
        blockTitle: line,
        articleNumberNormalized: null,
        lines: [line],
      };
      continue;
    }

    if (isChapterHeading(line)) {
      flushCurrent();
      current = {
        blockType: "chapter",
        blockTitle: line,
        articleNumberNormalized: null,
        lines: [line],
      };
      continue;
    }

    if (isAppendixHeading(line)) {
      flushCurrent();
      current = {
        blockType: "appendix",
        blockTitle: line,
        articleNumberNormalized: null,
        lines: [line],
      };
      continue;
    }

    const articleNumberNormalized = extractArticleNumber(line);

    if (articleNumberNormalized) {
      flushCurrent();
      current = {
        blockType: "article",
        blockTitle: line,
        articleNumberNormalized,
        lines: [line],
      };
      continue;
    }

    if (!current) {
      current = {
        blockType: "unstructured",
        blockTitle: null,
        articleNumberNormalized: null,
        lines: [line],
      };
      continue;
    }

    current.lines.push(line);
  }

  flushCurrent();

  if (blocks.length === 0 && normalizedFullText.trim()) {
    return [
      {
        blockType: "unstructured",
        blockOrder: 0,
        blockTitle: null,
        blockText: normalizedFullText.trim(),
        parentBlockId: null,
        articleNumberNormalized: null,
      } satisfies CreateLawBlockInput,
    ];
  }

  return blocks;
}
