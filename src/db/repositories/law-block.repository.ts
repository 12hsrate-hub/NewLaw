import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { createLawBlockInputSchema, lawVersionIdSchema } from "@/schemas/law-corpus";

type PrismaLike = PrismaClient;

export async function listLawBlocksByVersion(lawVersionId: string, db: PrismaLike = prisma) {
  return db.lawBlock.findMany({
    where: {
      lawVersionId: lawVersionIdSchema.parse(lawVersionId),
    },
    orderBy: [{ blockOrder: "asc" }],
  });
}

export async function replaceLawBlocksForVersion(
  input: {
    lawVersionId: string;
    blocks: Array<{
      blockType: "section" | "chapter" | "article" | "appendix" | "unstructured";
      blockOrder: number;
      blockTitle?: string | null;
      blockText: string;
      parentBlockId?: string | null;
      articleNumberNormalized?: string | null;
    }>;
  },
  db: PrismaLike = prisma,
) {
  const parsedLawVersionId = lawVersionIdSchema.parse(input.lawVersionId);
  const parsedBlocks = input.blocks.map((block) => createLawBlockInputSchema.parse(block));

  await db.lawBlock.deleteMany({
    where: {
      lawVersionId: parsedLawVersionId,
    },
  });

  if (parsedBlocks.length === 0) {
    return [];
  }

  await db.lawBlock.createMany({
    data: parsedBlocks.map((block) => ({
      lawVersionId: parsedLawVersionId,
      blockType: block.blockType,
      blockOrder: block.blockOrder,
      blockTitle: block.blockTitle ?? null,
      blockText: block.blockText,
      parentBlockId: block.parentBlockId ?? null,
      articleNumberNormalized: block.articleNumberNormalized ?? null,
    })),
  });

  return listLawBlocksByVersion(parsedLawVersionId, db);
}
