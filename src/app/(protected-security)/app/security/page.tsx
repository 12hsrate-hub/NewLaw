import { AccountSecuritySection } from "@/components/product/security/account-security-section";
import { AppShellHeader } from "@/components/product/shell/app-shell-header";
import { PageContainer } from "@/components/ui/page-container";
import { getAppShellContext } from "@/server/app-shell/context";

type ProtectedSecurityPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function ProtectedSecurityPage({
  searchParams,
}: ProtectedSecurityPageProps) {
  const shellContext = await getAppShellContext("/app/security", {
    allowMustChangePassword: true,
  });
  const resolvedSearchParams = await searchParams;

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
            mustChangePassword={shellContext.account.mustChangePassword}
            servers={shellContext.servers.map((server) => ({
              id: server.id,
              name: server.name,
            }))}
          />

          <AccountSecuritySection
            accountEmail={shellContext.account.email}
            accountLogin={shellContext.account.login}
            mustChangePassword={shellContext.account.mustChangePassword}
            pendingEmail={shellContext.account.pendingEmail}
            status={resolvedSearchParams?.status}
          />
        </div>
      </main>
    </PageContainer>
  );
}
