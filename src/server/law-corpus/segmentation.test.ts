import { describe, expect, it } from "vitest";

import { segmentLawTextIntoBlocks } from "@/server/law-corpus/segmentation";

describe("law segmentation", () => {
  it("ограничивает blockTitle до 500 символов", () => {
    const veryLongArticleTitle = `Статья 1. ${"А".repeat(600)}`;
    const blocks = segmentLawTextIntoBlocks(veryLongArticleTitle);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.blockType).toBe("article");
    expect(blocks[0]?.blockTitle?.length).toBe(500);
  });
});
