import { redirect } from "next/navigation";

import { LawSourceManagementSection } from "@/components/product/law-sources/law-source-management-section";
import { PrecedentSourceFoundationSection } from "@/components/product/precedent-sources/precedent-source-foundation-section";
import { AppShellHeader } from "@/components/product/shell/app-shell-header";
import { PageContainer } from "@/components/ui/page-container";
import { listLawSourceIndexes } from "@/db/repositories/law-source-index.repository";
import { listLawsForAdminReview } from "@/db/repositories/law.repository";
import { listPrecedentSourceTopicsForAdminReview } from "@/db/repositories/precedent-source-topic.repository";
import { getAppShellContext } from "@/server/app-shell/context";
import { buildAdminAccessDeniedRedirectPath } from "@/server/auth/protected";
import { buildLawCorpusBootstrapHealth } from "@/server/law-corpus/bootstrap-status";
import { searchCurrentLawCorpus } from "@/server/law-corpus/retrieval";

type AdminLawsPageProps = {
  searchParams?: Promise<{
    status?: string;
    previewQuery?: string;
    previewServerId?: string;
  }>;
};

export default async function AdminLawsPage({ searchParams }: AdminLawsPageProps) {
  const shellContext = await getAppShellContext("/app/admin-laws");

  if (!shellContext.account.isSuperAdmin) {
    redirect(buildAdminAccessDeniedRedirectPath());
  }

  const [resolvedSearchParams, sourceIndexes, laws, precedentSourceTopics] = await Promise.all([
    searchParams,
    listLawSourceIndexes(),
    listLawsForAdminReview(),
    listPrecedentSourceTopicsForAdminReview(),
  ]);
  const previewServerId =
    resolvedSearchParams?.previewServerId ??
    shellContext.activeServer?.id ??
    shellContext.servers[0]?.id ??
    null;
  const previewQuery = resolvedSearchParams?.previewQuery?.trim() ?? "";
  const hasPreviewQuery = previewQuery.length >= 2 && previewServerId;
  const previewServerName =
    shellContext.servers.find((server) => server.id === previewServerId)?.name ?? null;
  const retrievalPreview =
    hasPreviewQuery && previewServerName
      ? await searchCurrentLawCorpus({
          serverId: previewServerId,
          query: previewQuery,
        })
      : null;

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
            bootstrapHealthByServerId={Object.fromEntries(
              shellContext.servers.map((server) => [
                server.id,
                buildLawCorpusBootstrapHealth(
                  laws
                    .filter((law) => law.serverId === server.id)
                    .map((law) => ({
                      lawKind: law.lawKind,
                      isExcluded: law.isExcluded,
                      classificationOverride: law.classificationOverride,
                      currentVersionId: law.currentVersionId,
                      versionCount: law._count.versions,
                    })),
                  {
                    hasDiscoveryFailure: sourceIndexes.some(
                      (sourceIndex) =>
                        sourceIndex.serverId === server.id &&
                        sourceIndex.isEnabled &&
                        sourceIndex.lastDiscoveryStatus === "failure",
                    ),
                  },
                ),
              ]),
            )}
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
              versions: law.versions.map((version) => ({
                id: version.id,
                status: version.status,
                importedAt: version.importedAt,
                confirmedAt: version.confirmedAt,
                confirmedByAccountEmail: version.confirmedByAccount?.email ?? null,
                sourcePostsCount: version._count.sourcePosts,
                blocksCount: version._count.blocks,
                sourceSnapshotHash: version.sourceSnapshotHash,
                normalizedTextHash: version.normalizedTextHash,
              })),
            }))}
            previewQuery={previewQuery}
            retrievalPreview={
              retrievalPreview && previewServerName
                ? {
                    serverName: previewServerName,
                    query: retrievalPreview.query,
                    serverId: retrievalPreview.serverId,
                    resultCount: retrievalPreview.resultCount,
                    corpusSnapshotHash: retrievalPreview.corpusSnapshot.corpusSnapshotHash,
                    currentVersionIds: retrievalPreview.corpusSnapshot.currentVersionIds,
                    results: retrievalPreview.results,
                  }
                : null
            }
            selectedPreviewServerId={previewServerId}
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

          <PrecedentSourceFoundationSection
            servers={shellContext.servers.map((server) => ({
              id: server.id,
              name: server.name,
            }))}
            sourceIndexes={sourceIndexes.map((sourceIndex) => ({
              id: sourceIndex.id,
              serverId: sourceIndex.serverId,
              indexUrl: sourceIndex.indexUrl,
              isEnabled: sourceIndex.isEnabled,
            }))}
            sourceTopics={precedentSourceTopics.map((sourceTopic) => ({
              id: sourceTopic.id,
              serverId: sourceTopic.serverId,
              sourceIndexId: sourceTopic.sourceIndexId,
              topicUrl: sourceTopic.topicUrl,
              topicExternalId: sourceTopic.topicExternalId,
              title: sourceTopic.title,
              isExcluded: sourceTopic.isExcluded,
              classificationOverride: sourceTopic.classificationOverride,
              internalNote: sourceTopic.internalNote,
              lastDiscoveredAt: sourceTopic.lastDiscoveredAt,
              lastDiscoveryStatus: sourceTopic.lastDiscoveryStatus,
              lastDiscoveryError: sourceTopic.lastDiscoveryError,
              sourceIndexUrl: sourceTopic.sourceIndex.indexUrl,
              precedentsCount: sourceTopic._count.precedents,
              latestImportRun: sourceTopic.importRuns[0]
                ? {
                    status: sourceTopic.importRuns[0].status,
                    startedAt: sourceTopic.importRuns[0].startedAt,
                    summary: sourceTopic.importRuns[0].summary,
                    error: sourceTopic.importRuns[0].error,
                  }
                : null,
              precedents: sourceTopic.precedents.map((precedent) => ({
                id: precedent.id,
                displayTitle: precedent.displayTitle,
                precedentKey: precedent.precedentKey,
                precedentLocatorKey: precedent.precedentLocatorKey,
                validityStatus: precedent.validityStatus,
                currentVersionId: precedent.currentVersionId,
                latestVersionStatus: precedent.versions[0]?.status ?? null,
                versionCount: precedent._count.versions,
                versions: precedent.versions.map((version) => ({
                  id: version.id,
                  status: version.status,
                  importedAt: version.importedAt,
                  confirmedAt: version.confirmedAt,
                  confirmedByAccountEmail: version.confirmedByAccount?.email ?? null,
                  sourcePostsCount: version._count.sourcePosts,
                  blocksCount: version._count.blocks,
                  sourceSnapshotHash: version.sourceSnapshotHash,
                  normalizedTextHash: version.normalizedTextHash,
                  blockTypes: version.blocks.map((block) => block.blockType),
                })),
              })),
            }))}
            status={resolvedSearchParams?.status}
          />
        </div>
      </main>
    </PageContainer>
  );
}
