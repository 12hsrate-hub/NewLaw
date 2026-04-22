import { AccountSecuritySection } from "@/components/product/security/account-security-section";
import { ForumIntegrationSection } from "@/components/product/security/forum-integration-section";
import { getAccountForumIntegrationContext } from "@/server/forum-integration/context";

type AccountSecurityPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function AccountSecurityPage({
  searchParams,
}: AccountSecurityPageProps) {
  const [context, resolvedSearchParams] = await Promise.all([
    getAccountForumIntegrationContext("/account/security"),
    searchParams,
  ]);

  return (
    <div className="space-y-6">
      <AccountSecuritySection
        accountEmail={context.account.email}
        accountLogin={context.account.login}
        mustChangePassword={context.account.mustChangePassword}
        pendingEmail={context.account.pendingEmail}
        status={resolvedSearchParams?.status}
      />
      <ForumIntegrationSection forumConnection={context.forumConnection} />
    </div>
  );
}
