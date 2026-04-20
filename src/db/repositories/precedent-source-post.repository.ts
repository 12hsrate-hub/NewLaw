import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  createPrecedentSourcePostInputSchema,
  precedentVersionIdSchema,
} from "@/schemas/precedent-corpus";

type PrismaLike = PrismaClient;

export async function listPrecedentSourcePostsByVersion(
  precedentVersionId: string,
  db: PrismaLike = prisma,
) {
  return db.precedentSourcePost.findMany({
    where: {
      precedentVersionId: precedentVersionIdSchema.parse(precedentVersionId),
    },
    orderBy: [{ postOrder: "asc" }],
  });
}

export async function replacePrecedentSourcePostsForVersion(
  input: {
    precedentVersionId: string;
    posts: Array<{
      postExternalId: string;
      postUrl: string;
      postOrder: number;
      authorName?: string | null;
      postedAt?: Date | null;
      rawHtml: string;
      rawText: string;
      normalizedTextFragment: string;
    }>;
  },
  db: PrismaLike = prisma,
) {
  const parsedPrecedentVersionId = precedentVersionIdSchema.parse(input.precedentVersionId);
  const parsedPosts = input.posts.map((post) => createPrecedentSourcePostInputSchema.parse(post));

  await db.precedentSourcePost.deleteMany({
    where: {
      precedentVersionId: parsedPrecedentVersionId,
    },
  });

  if (parsedPosts.length === 0) {
    return [];
  }

  await db.precedentSourcePost.createMany({
    data: parsedPosts.map((post) => ({
      precedentVersionId: parsedPrecedentVersionId,
      postExternalId: post.postExternalId,
      postUrl: post.postUrl,
      postOrder: post.postOrder,
      authorName: post.authorName ?? null,
      postedAt: post.postedAt ?? null,
      rawHtml: post.rawHtml,
      rawText: post.rawText,
      normalizedTextFragment: post.normalizedTextFragment,
    })),
  });

  return listPrecedentSourcePostsByVersion(parsedPrecedentVersionId, db);
}
