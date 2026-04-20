import type { CreatePrecedentBlockInput } from "@/schemas/precedent-corpus";

type SectionContext = {
  blockType: CreatePrecedentBlockInput["blockType"];
  blockTitle: string | null;
  lines: string[];
};

const sectionDetectors: Array<{
  blockType: CreatePrecedentBlockInput["blockType"];
  pattern: RegExp;
}> = [
  {
    blockType: "facts",
    pattern: /^(?:обстоятельства дела|фактические обстоятельства|фабула дела|обстоятельства)(?:$|[\s:№#(.-])/iu,
  },
  {
    blockType: "issue",
    pattern: /^(?:вопрос(?:ы)? права|предмет спора|спорный вопрос|вопрос суда)(?:$|[\s:№#(.-])/iu,
  },
  {
    blockType: "holding",
    pattern: /^(?:правовая позиция|позиция суда|вывод суда|holding)(?:$|[\s:№#(.-])/iu,
  },
  {
    blockType: "reasoning",
    pattern: /^(?:мотивировочная часть|мотивировка|обоснование|мотивы суда|reasoning)(?:$|[\s:№#(.-])/iu,
  },
  {
    blockType: "resolution",
    pattern: /^(?:резолютивная часть|постановил|определил|решение суда|resolution)(?:$|[\s:№#(.-])/iu,
  },
];

function detectSectionType(line: string) {
  return sectionDetectors.find((entry) => entry.pattern.test(line))?.blockType ?? null;
}

function buildBlockInput(context: SectionContext, blockOrder: number): CreatePrecedentBlockInput | null {
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
  };
}

export function segmentPrecedentTextIntoBlocks(normalizedFullText: string) {
  const lines = normalizedFullText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const hasExplicitSections = lines.some((line) => Boolean(detectSectionType(line)));

  if (!hasExplicitSections) {
    return [
      {
        blockType: "unstructured",
        blockOrder: 0,
        blockTitle: null,
        blockText: normalizedFullText.trim(),
        parentBlockId: null,
      } satisfies CreatePrecedentBlockInput,
    ].filter((block) => block.blockText.length > 0);
  }

  const blocks: CreatePrecedentBlockInput[] = [];
  let current: SectionContext | null = null;

  const flushCurrent = () => {
    if (!current) {
      return;
    }

    const block = buildBlockInput(current, blocks.length);

    if (block) {
      blocks.push(block);
    }

    current = null;
  };

  for (const line of lines) {
    const nextBlockType = detectSectionType(line);

    if (nextBlockType) {
      flushCurrent();
      current = {
        blockType: nextBlockType,
        blockTitle: line,
        lines: [line],
      };
      continue;
    }

    if (!current) {
      current = {
        blockType: "unstructured",
        blockTitle: null,
        lines: [line],
      };
      continue;
    }

    current.lines.push(line);
  }

  flushCurrent();

  return blocks.length > 0
    ? blocks
    : [
        {
          blockType: "unstructured",
          blockOrder: 0,
          blockTitle: null,
          blockText: normalizedFullText.trim(),
          parentBlockId: null,
        } satisfies CreatePrecedentBlockInput,
      ].filter((block) => block.blockText.length > 0);
}
