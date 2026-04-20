import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  createLawSourcePostInputSchema,
  lawVersionIdSchema,
} from "@/schemas/law-corpus";

type PrismaLike = PrismaClient;

export async function listLawSourcePostsByVersion(
  lawVersionId: string,
  db: PrismaLike = prisma,
) {
  return db.lawSourcePost.findMany({
    where: {
      lawVersionId: lawVersionIdSchema.parse(lawVersionId),
    },
    orderBy: [{ postOrder: "asc" }],
  });
}

export async function replaceLawSourcePostsForVersion(
  input: {
    lawVersionId: string;
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
  const parsedLawVersionId = lawVersionIdSchema.parse(input.lawVersionId);
  const parsedPosts = input.posts.map((post) => createLawSourcePostInputSchema.parse(post));

  await db.lawSourcePost.deleteMany({
    where: {
      lawVersionId: parsedLawVersionId,
    },
  });

  if (parsedPosts.length === 0) {
    return [];
  }

  await db.lawSourcePost.createMany({
    data: parsedPosts.map((post) => ({
      lawVersionId: parsedLawVersionId,
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

  return listLawSourcePostsByVersion(parsedLawVersionId, db);
}
