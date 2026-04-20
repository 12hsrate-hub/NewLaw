import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { createPrecedentBlockInputSchema, precedentVersionIdSchema } from "@/schemas/precedent-corpus";

type PrismaLike = PrismaClient;

export async function listPrecedentBlocksByVersion(
  precedentVersionId: string,
  db: PrismaLike = prisma,
) {
  return db.precedentBlock.findMany({
    where: {
      precedentVersionId: precedentVersionIdSchema.parse(precedentVersionId),
    },
    orderBy: [{ blockOrder: "asc" }],
  });
}

export async function replacePrecedentBlocksForVersion(
  input: {
    precedentVersionId: string;
    blocks: Array<{
      blockType: "facts" | "issue" | "holding" | "reasoning" | "resolution" | "unstructured";
      blockOrder: number;
      blockTitle?: string | null;
      blockText: string;
      parentBlockId?: string | null;
    }>;
  },
  db: PrismaLike = prisma,
) {
  const parsedPrecedentVersionId = precedentVersionIdSchema.parse(input.precedentVersionId);
  const parsedBlocks = input.blocks.map((block) => createPrecedentBlockInputSchema.parse(block));

  await db.precedentBlock.deleteMany({
    where: {
      precedentVersionId: parsedPrecedentVersionId,
    },
  });

  if (parsedBlocks.length === 0) {
    return [];
  }

  await db.precedentBlock.createMany({
    data: parsedBlocks.map((block) => ({
      precedentVersionId: parsedPrecedentVersionId,
      blockType: block.blockType,
      blockOrder: block.blockOrder,
      blockTitle: block.blockTitle ?? null,
      blockText: block.blockText,
      parentBlockId: block.parentBlockId ?? null,
    })),
  });

  return listPrecedentBlocksByVersion(parsedPrecedentVersionId, db);
}
