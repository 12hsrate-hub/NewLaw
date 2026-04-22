import { requireProtectedAccountContext } from "@/server/auth/protected";
import { getAccountForumConnectionSummary } from "@/server/forum-integration/service";

export async function getAccountForumIntegrationContext(nextPath = "/account/security") {
  const { account } = await requireProtectedAccountContext(nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const forumConnection = await getAccountForumConnectionSummary(account.id);

  return {
    account,
    forumConnection,
  };
}
