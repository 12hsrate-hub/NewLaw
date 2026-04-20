import { getLawByServerAndTopicExternalId } from "@/db/repositories/law.repository";
import { getLawSourceIndexById } from "@/db/repositories/law-source-index.repository";
import {
  createPrecedentSourceTopicRecord,
  findPrecedentSourceTopicByServerAndTopicExternalId,
  getPrecedentSourceTopicById,
  syncPrecedentSourceTopicFromDiscovery,
  updatePrecedentSourceTopicDiscoveryState,
} from "@/db/repositories/precedent-source-topic.repository";
import { getPrecedentBySourceTopicAndLocator } from "@/db/repositories/precedent.repository";
import { findPrecedentVersionByNormalizedHash } from "@/db/repositories/precedent-version.repository";
import { classifyPrecedentTopicTitle } from "@/server/precedent-corpus/classification";
import {
  createImportedDraftPrecedentVersion,
  finishPrecedentImportRun,
  PrecedentImportRunConflictError,
  registerPrecedentStub,
  replaceImportedPrecedentBlocks,
  replaceImportedPrecedentSourcePosts,
  startPrecedentImportRun,
} from "@/server/precedent-corpus/foundation";
import { segmentPrecedentTextIntoBlocks } from "@/server/precedent-corpus/segmentation";
import { splitPrecedentSourceTopicIntoUnits } from "@/server/precedent-corpus/splitting";
import {
  buildNormalizedTextHash,
  buildSourceSnapshotHash,
  parseForumIndexCandidates,
  parseForumTopicPosts,
} from "@/server/law-corpus/forum-html";

type DiscoveryImportDependencies = {
  getLawSourceIndexById: typeof getLawSourceIndexById;
  getLawByServerAndTopicExternalId: typeof getLawByServerAndTopicExternalId;
  createPrecedentSourceTopicRecord: typeof createPrecedentSourceTopicRecord;
  findPrecedentSourceTopicByServerAndTopicExternalId: typeof findPrecedentSourceTopicByServerAndTopicExternalId;
  getPrecedentSourceTopicById: typeof getPrecedentSourceTopicById;
  getPrecedentBySourceTopicAndLocator: typeof getPrecedentBySourceTopicAndLocator;
  syncPrecedentSourceTopicFromDiscovery: typeof syncPrecedentSourceTopicFromDiscovery;
  updatePrecedentSourceTopicDiscoveryState: typeof updatePrecedentSourceTopicDiscoveryState;
  startPrecedentImportRun: typeof startPrecedentImportRun;
  finishPrecedentImportRun: typeof finishPrecedentImportRun;
  registerPrecedentStub: typeof registerPrecedentStub;
  findPrecedentVersionByNormalizedHash: typeof findPrecedentVersionByNormalizedHash;
  createImportedDraftPrecedentVersion: typeof createImportedDraftPrecedentVersion;
  replaceImportedPrecedentSourcePosts: typeof replaceImportedPrecedentSourcePosts;
  replaceImportedPrecedentBlocks: typeof replaceImportedPrecedentBlocks;
  fetchHtml: (url: string) => Promise<string>;
};

const defaultDependencies: DiscoveryImportDependencies = {
  getLawSourceIndexById,
  getLawByServerAndTopicExternalId,
  createPrecedentSourceTopicRecord,
  findPrecedentSourceTopicByServerAndTopicExternalId,
  getPrecedentSourceTopicById,
  getPrecedentBySourceTopicAndLocator,
  syncPrecedentSourceTopicFromDiscovery,
  updatePrecedentSourceTopicDiscoveryState,
  startPrecedentImportRun,
  finishPrecedentImportRun,
  registerPrecedentStub,
  findPrecedentVersionByNormalizedHash,
  createImportedDraftPrecedentVersion,
  replaceImportedPrecedentSourcePosts,
  replaceImportedPrecedentBlocks,
  async fetchHtml(url: string) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Lawyer5RP Precedent Corpus Importer/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`Форум вернул HTTP ${response.status}.`);
    }

    return response.text();
  },
};

export class PrecedentSourceIndexMissingError extends Error {
  constructor() {
    super("Источник precedent discovery не найден.");
    this.name = "PrecedentSourceIndexMissingError";
  }
}

export class PrecedentSourceTopicMissingError extends Error {
  constructor() {
    super("Precedent source topic для import не найден.");
    this.name = "PrecedentSourceTopicMissingError";
  }
}

export class PrecedentImportNoPostsError extends Error {
  constructor() {
    super("Не удалось собрать snapshot постов темы для precedent import.");
    this.name = "PrecedentImportNoPostsError";
  }
}

export class PrecedentImportExcludedError extends Error {
  constructor() {
    super("Этот precedent source topic помечен как excluded и не должен импортироваться через обычный workflow.");
    this.name = "PrecedentImportExcludedError";
  }
}

function summarizeDiscovery(result: {
  candidateCount: number;
  createdCount: number;
  updatedCount: number;
  ignoredCount: number;
}) {
  return [
    `Кандидатов: ${result.candidateCount}.`,
    `Создано source topics: ${result.createdCount}.`,
    `Обновлено source topics: ${result.updatedCount}.`,
    `Проигнорировано: ${result.ignoredCount}.`,
  ].join(" ");
}

export async function runPrecedentSourceDiscovery(
  sourceIndexId: string,
  dependencies: DiscoveryImportDependencies = defaultDependencies,
) {
  const sourceIndex = await dependencies.getLawSourceIndexById(sourceIndexId);

  if (!sourceIndex) {
    throw new PrecedentSourceIndexMissingError();
  }

  const run = await dependencies.startPrecedentImportRun({
    serverId: sourceIndex.serverId,
    sourceIndexId: sourceIndex.id,
    mode: "discovery",
  });

  try {
    const indexHtml = await dependencies.fetchHtml(sourceIndex.indexUrl);
    const candidates = parseForumIndexCandidates(indexHtml);
    let createdCount = 0;
    let updatedCount = 0;
    let ignoredCount = 0;

    const discoveredAt = new Date();

    for (const candidate of candidates) {
      const [existingLaw, existingSourceTopic] = await Promise.all([
        dependencies.getLawByServerAndTopicExternalId({
          serverId: sourceIndex.serverId,
          topicExternalId: candidate.topicExternalId,
        }),
        dependencies.findPrecedentSourceTopicByServerAndTopicExternalId({
          serverId: sourceIndex.serverId,
          topicExternalId: candidate.topicExternalId,
        }),
      ]);

      const classification = classifyPrecedentTopicTitle(candidate.title, {
        isExcluded: existingSourceTopic?.isExcluded,
        classificationOverride: existingSourceTopic?.classificationOverride,
        relatedLawExists: Boolean(existingLaw),
      });

      if (classification === "ignored") {
        if (existingSourceTopic) {
          await dependencies.syncPrecedentSourceTopicFromDiscovery({
            sourceTopicId: existingSourceTopic.id,
            sourceIndexId: sourceIndex.id,
            topicUrl: candidate.topicUrl,
            title: candidate.title,
            lastDiscoveredAt: discoveredAt,
            lastDiscoveryStatus: "success",
            lastDiscoveryError: null,
          });
        }

        ignoredCount += 1;
        continue;
      }

      if (existingSourceTopic) {
        await dependencies.syncPrecedentSourceTopicFromDiscovery({
          sourceTopicId: existingSourceTopic.id,
          sourceIndexId: sourceIndex.id,
          topicUrl: candidate.topicUrl,
          title: candidate.title,
          lastDiscoveredAt: discoveredAt,
          lastDiscoveryStatus: "success",
          lastDiscoveryError: null,
        });
        updatedCount += 1;
        continue;
      }

      const createdSourceTopic = await dependencies.createPrecedentSourceTopicRecord({
        serverId: sourceIndex.serverId,
        sourceIndexId: sourceIndex.id,
        topicUrl: candidate.topicUrl,
        topicExternalId: candidate.topicExternalId,
        title: candidate.title,
      });

      await dependencies.updatePrecedentSourceTopicDiscoveryState({
        sourceTopicId: createdSourceTopic.id,
        lastDiscoveredAt: discoveredAt,
        lastDiscoveryStatus: "success",
        lastDiscoveryError: null,
      });
      createdCount += 1;
    }

    const summary = summarizeDiscovery({
      candidateCount: candidates.length,
      createdCount,
      updatedCount,
      ignoredCount,
    });

    await dependencies.finishPrecedentImportRun({
      runId: run.id,
      status: "success",
      summary,
    });

    return {
      sourceIndex,
      candidateCount: candidates.length,
      createdCount,
      updatedCount,
      ignoredCount,
      summary,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Неизвестная ошибка precedent discovery.";

    await dependencies.finishPrecedentImportRun({
      runId: run.id,
      status: "failure",
      summary: null,
      error: errorMessage,
    });

    throw error;
  }
}

function summarizeImport(result: {
  extractedCount: number;
  createdPrecedents: number;
  createdVersions: number;
  unchangedVersions: number;
}) {
  return [
    `Извлечено precedents: ${result.extractedCount}.`,
    `Создано новых precedent records: ${result.createdPrecedents}.`,
    `Создано imported_draft версий: ${result.createdVersions}.`,
    `Без изменений: ${result.unchangedVersions}.`,
  ].join(" ");
}

export async function runPrecedentSourceTopicImport(
  sourceTopicId: string,
  dependencies: DiscoveryImportDependencies = defaultDependencies,
) {
  const sourceTopic = await dependencies.getPrecedentSourceTopicById(sourceTopicId);

  if (!sourceTopic) {
    throw new PrecedentSourceTopicMissingError();
  }

  if (sourceTopic.isExcluded) {
    throw new PrecedentImportExcludedError();
  }

  const run = await dependencies.startPrecedentImportRun({
    serverId: sourceTopic.serverId,
    sourceTopicId: sourceTopic.id,
    mode: "import_source_topic",
  });

  try {
    const topicHtml = await dependencies.fetchHtml(sourceTopic.topicUrl);
    const parsedPosts = parseForumTopicPosts(topicHtml, sourceTopic.topicUrl);

    if (parsedPosts.length === 0) {
      throw new PrecedentImportNoPostsError();
    }

    const extractedUnits = splitPrecedentSourceTopicIntoUnits(sourceTopic.title, parsedPosts);

    if (extractedUnits.length === 0) {
      throw new PrecedentImportNoPostsError();
    }

    let createdPrecedents = 0;
    let createdVersions = 0;
    let unchangedVersions = 0;
    const importedPrecedents: Array<{
      precedentId: string;
      versionId: string;
      createdNewVersion: boolean;
      blockCount: number;
      sourcePostsCount: number;
    }> = [];

    for (const unit of extractedUnits) {
      const existingPrecedentBeforeImport = await dependencies.getPrecedentBySourceTopicAndLocator({
        precedentSourceTopicId: sourceTopic.id,
        precedentLocatorKey: unit.precedentLocatorKey,
      });
      const precedent = await dependencies.registerPrecedentStub({
        serverId: sourceTopic.serverId,
        precedentSourceTopicId: sourceTopic.id,
        displayTitle: unit.displayTitle,
        precedentLocatorKey: unit.precedentLocatorKey,
      });

      if (!existingPrecedentBeforeImport) {
        createdPrecedents += 1;
      }

      const sourceSnapshotHash = buildSourceSnapshotHash(unit.sourcePosts);
      const normalizedTextHash = buildNormalizedTextHash(unit.normalizedFullText);
      const existingVersion = await dependencies.findPrecedentVersionByNormalizedHash({
        precedentId: precedent.id,
        normalizedTextHash,
      });

      if (existingVersion) {
        unchangedVersions += 1;
        importedPrecedents.push({
          precedentId: precedent.id,
          versionId: existingVersion.id,
          createdNewVersion: false,
          blockCount: 0,
          sourcePostsCount: unit.sourcePosts.length,
        });
        continue;
      }

      const createdVersion = await dependencies.createImportedDraftPrecedentVersion({
        precedentId: precedent.id,
        normalizedFullText: unit.normalizedFullText,
        sourceSnapshotHash,
        normalizedTextHash,
      });
      const blocks = segmentPrecedentTextIntoBlocks(unit.normalizedFullText);

      await dependencies.replaceImportedPrecedentSourcePosts({
        precedentVersionId: createdVersion.id,
        posts: unit.sourcePosts,
      });
      await dependencies.replaceImportedPrecedentBlocks({
        precedentVersionId: createdVersion.id,
        blocks,
      });

      createdVersions += 1;
      importedPrecedents.push({
        precedentId: precedent.id,
        versionId: createdVersion.id,
        createdNewVersion: true,
        blockCount: blocks.length,
        sourcePostsCount: unit.sourcePosts.length,
      });
    }

    const summary = summarizeImport({
      extractedCount: extractedUnits.length,
      createdPrecedents,
      createdVersions,
      unchangedVersions,
    });

    await dependencies.finishPrecedentImportRun({
      runId: run.id,
      status: "success",
      summary,
    });

    return {
      sourceTopic,
      extractedCount: extractedUnits.length,
      createdPrecedents,
      createdVersions,
      unchangedVersions,
      importedPrecedents,
      summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка precedent import.";

    await dependencies.finishPrecedentImportRun({
      runId: run.id,
      status: "failure",
      summary: null,
      error: errorMessage,
    });

    throw error;
  }
}

export { PrecedentImportRunConflictError };
