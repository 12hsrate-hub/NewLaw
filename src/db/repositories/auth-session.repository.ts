import { prisma } from "@/db/prisma";

type SessionMutationDb = {
  $executeRaw: typeof prisma.$executeRaw;
};

export async function revokeAccountSessions(
  accountId: string,
  db: SessionMutationDb = prisma,
) {
  const revokedSessions = await db.$executeRaw`
    DELETE FROM auth.sessions
    WHERE user_id = ${accountId}::uuid
  `;

  const revokedRefreshTokens = await db.$executeRaw`
    DELETE FROM auth.refresh_tokens
    WHERE user_id = ${accountId}::uuid
  `;

  return {
    revokedSessions: Number(revokedSessions),
    revokedRefreshTokens: Number(revokedRefreshTokens),
  };
}
