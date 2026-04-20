import { redirect } from "next/navigation";

import { AdminSecuritySection } from "@/components/product/admin-security/admin-security-section";
import { AppShellHeader } from "@/components/product/shell/app-shell-header";
import { PageContainer } from "@/components/ui/page-container";
import { findAccountForAdminSearch } from "@/server/admin-security/account-search";
import { getAppShellContext } from "@/server/app-shell/context";
import { buildAdminAccessDeniedRedirectPath } from "@/server/auth/protected";

type AdminSecurityPageProps = {
  searchParams?: Promise<{
    identifier?: string;
  }>;
};

export default async function AdminSecurityPage({
  searchParams,
}: AdminSecurityPageProps) {
  const shellContext = await getAppShellContext("/app/admin-security");

  if (!shellContext.account.isSuperAdmin) {
    redirect(buildAdminAccessDeniedRedirectPath());
  }

  const resolvedSearchParams = await searchParams;
  const searchResult = await findAccountForAdminSearch(resolvedSearchParams?.identifier);

  return (
    <PageContainer>
      <main className="min-h-screen px-6 py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <AppShellHeader
            accountEmail={shellContext.account.email}
            accountLogin={shellContext.account.login}
            activeCharacterId={shellContext.activeCharacter?.id ?? null}
            activeCharacterName={shellContext.activeCharacter?.fullName ?? null}
            activeServerId={shellContext.activeServer?.id ?? null}
            activeServerName={shellContext.activeServer?.name ?? null}
            characters={shellContext.characters.map((character) => ({
              id: character.id,
              fullName: character.fullName,
              passportNumber: character.passportNumber,
            }))}
            currentPath={shellContext.currentPath}
            isSuperAdmin={shellContext.account.isSuperAdmin}
            mustChangePassword={shellContext.account.mustChangePassword}
            servers={shellContext.servers.map((server) => ({
              id: server.id,
              name: server.name,
            }))}
          />

          <AdminSecuritySection searchResult={searchResult} />
        </div>
      </main>
    </PageContainer>
  );
}
