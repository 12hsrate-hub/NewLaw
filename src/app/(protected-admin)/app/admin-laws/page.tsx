import { redirect } from "next/navigation";

import { LawSourceManagementSection } from "@/components/product/law-sources/law-source-management-section";
import { AppShellHeader } from "@/components/product/shell/app-shell-header";
import { PageContainer } from "@/components/ui/page-container";
import { listLawSourceIndexes } from "@/db/repositories/law-source-index.repository";
import { listLaws } from "@/db/repositories/law.repository";
import { getAppShellContext } from "@/server/app-shell/context";
import { buildAdminAccessDeniedRedirectPath } from "@/server/auth/protected";

type AdminLawsPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function AdminLawsPage({ searchParams }: AdminLawsPageProps) {
  const shellContext = await getAppShellContext("/app/admin-laws");

  if (!shellContext.account.isSuperAdmin) {
    redirect(buildAdminAccessDeniedRedirectPath());
  }

  const [resolvedSearchParams, sourceIndexes, laws] = await Promise.all([
    searchParams,
    listLawSourceIndexes(),
    listLaws(),
  ]);

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

          <LawSourceManagementSection
            laws={laws.map((law) => ({
              id: law.id,
              serverId: law.serverId,
              lawKey: law.lawKey,
              title: law.title,
              topicUrl: law.topicUrl,
              lawKind: law.lawKind,
              isExcluded: law.isExcluded,
              classificationOverride: law.classificationOverride,
              currentVersionId: law.currentVersionId,
              latestVersionStatus: law.versions[0]?.status ?? null,
              versionCount: law._count.versions,
            }))}
            servers={shellContext.servers.map((server) => ({
              id: server.id,
              name: server.name,
            }))}
            sourceIndexes={sourceIndexes.map((sourceIndex) => ({
              id: sourceIndex.id,
              serverId: sourceIndex.serverId,
              indexUrl: sourceIndex.indexUrl,
              isEnabled: sourceIndex.isEnabled,
              lastDiscoveredAt: sourceIndex.lastDiscoveredAt,
              lastDiscoveryStatus: sourceIndex.lastDiscoveryStatus,
              lastDiscoveryError: sourceIndex.lastDiscoveryError,
            }))}
            status={resolvedSearchParams?.status}
          />
        </div>
      </main>
    </PageContainer>
  );
}
