import { listLawSourceIndexes } from "@/db/repositories/law-source-index.repository";
import { listLawsForAdminReview } from "@/db/repositories/law.repository";
import { listPrecedentSourceTopicsForAdminReview } from "@/db/repositories/precedent-source-topic.repository";
import { getServers } from "@/db/repositories/server.repository";
import { buildLawCorpusBootstrapHealth } from "@/server/law-corpus/bootstrap-status";
import { searchCurrentLawCorpus } from "@/server/law-corpus/retrieval";

type InternalCorpusServerItem = {
  id: string;
  name: string;
};

function resolveSelectedPreviewServerId(
  servers: InternalCorpusServerItem[],
  previewServerId?: string | null,
) {
  const requestedServerId = previewServerId?.trim() || null;

  if (!requestedServerId) {
    return servers[0]?.id ?? null;
  }

  return servers.some((server) => server.id === requestedServerId)
    ? requestedServerId
    : (servers[0]?.id ?? null);
}

export async function getInternalLawCorpusPageData(input?: {
  previewQuery?: string | null;
  previewServerId?: string | null;
}) {
  const [servers, sourceIndexes, laws] = await Promise.all([
    getServers(),
    listLawSourceIndexes(),
    listLawsForAdminReview(),
  ]);
  const serverItems = servers.map((server) => ({
    id: server.id,
    name: server.name,
  }));
  const selectedPreviewServerId = resolveSelectedPreviewServerId(
    serverItems,
    input?.previewServerId,
  );
  const previewQuery = input?.previewQuery?.trim() ?? "";
  const hasPreviewQuery = previewQuery.length >= 2 && selectedPreviewServerId;
  const selectedPreviewServerName =
    serverItems.find((server) => server.id === selectedPreviewServerId)?.name ?? null;
  const retrievalPreview =
    hasPreviewQuery && selectedPreviewServerName
      ? await searchCurrentLawCorpus({
          serverId: selectedPreviewServerId,
          query: previewQuery,
        })
      : null;

  return {
    servers: serverItems,
    sourceIndexes: sourceIndexes.map((sourceIndex) => ({
      id: sourceIndex.id,
      serverId: sourceIndex.serverId,
      indexUrl: sourceIndex.indexUrl,
      isEnabled: sourceIndex.isEnabled,
      lastDiscoveredAt: sourceIndex.lastDiscoveredAt,
      lastDiscoveryStatus: sourceIndex.lastDiscoveryStatus,
      lastDiscoveryError: sourceIndex.lastDiscoveryError,
    })),
    laws: laws.map((law) => ({
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
    })),
    bootstrapHealthByServerId: Object.fromEntries(
      serverItems.map((server) => [
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
    ),
    selectedPreviewServerId,
    previewQuery,
    retrievalPreview:
      retrievalPreview && selectedPreviewServerName
        ? {
            serverName: selectedPreviewServerName,
            query: retrievalPreview.query,
            serverId: retrievalPreview.serverId,
            resultCount: retrievalPreview.resultCount,
            corpusSnapshotHash: retrievalPreview.corpusSnapshot.corpusSnapshotHash,
            currentVersionIds: retrievalPreview.corpusSnapshot.currentVersionIds,
            results: retrievalPreview.results,
          }
        : null,
  };
}

export async function getInternalPrecedentCorpusPageData() {
  const [servers, sourceIndexes, sourceTopics] = await Promise.all([
    getServers(),
    listLawSourceIndexes(),
    listPrecedentSourceTopicsForAdminReview(),
  ]);

  return {
    servers: servers.map((server) => ({
      id: server.id,
      name: server.name,
    })),
    sourceIndexes: sourceIndexes.map((sourceIndex) => ({
      id: sourceIndex.id,
      serverId: sourceIndex.serverId,
      indexUrl: sourceIndex.indexUrl,
      isEnabled: sourceIndex.isEnabled,
    })),
    sourceTopics: sourceTopics.map((sourceTopic) => ({
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
    })),
  };
}
