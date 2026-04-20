import {
  getLawById,
  getLawByServerAndTopicExternalId,
  syncLawRecordFromDiscovery,
} from "@/db/repositories/law.repository";
import {
  getLawSourceIndexById,
  updateLawSourceIndexDiscoveryState,
} from "@/db/repositories/law-source-index.repository";
import { findLawVersionByNormalizedHash } from "@/db/repositories/law-version.repository";
import { classifyLawTopicTitle } from "@/server/law-corpus/classification";
import {
  createImportedDraftLawVersion,
  finishLawImportRun,
  registerLawStub,
  replaceImportedLawBlocks,
  replaceImportedLawSourcePosts,
  startLawImportRun,
} from "@/server/law-corpus/foundation";
import {
  buildNormalizedLawText,
  buildNormalizedTextHash,
  buildSourceSnapshotHash,
  parseForumIndexCandidates,
  parseForumIndexPaginationUrls,
  parseForumTopicPosts,
  type ParsedForumPost,
} from "@/server/law-corpus/forum-html";
import { segmentLawTextIntoBlocks } from "@/server/law-corpus/segmentation";

type DiscoveryImportDependencies = {
  getLawSourceIndexById: typeof getLawSourceIndexById;
  updateLawSourceIndexDiscoveryState: typeof updateLawSourceIndexDiscoveryState;
  getLawByServerAndTopicExternalId: typeof getLawByServerAndTopicExternalId;
  getLawById: typeof getLawById;
  syncLawRecordFromDiscovery: typeof syncLawRecordFromDiscovery;
  registerLawStub: typeof registerLawStub;
  startLawImportRun: typeof startLawImportRun;
  finishLawImportRun: typeof finishLawImportRun;
  createImportedDraftLawVersion: typeof createImportedDraftLawVersion;
  findLawVersionByNormalizedHash: typeof findLawVersionByNormalizedHash;
  replaceImportedLawSourcePosts: typeof replaceImportedLawSourcePosts;
  replaceImportedLawBlocks: typeof replaceImportedLawBlocks;
  fetchHtml: (url: string) => Promise<string>;
};

const defaultDependencies: DiscoveryImportDependencies = {
  getLawSourceIndexById,
  updateLawSourceIndexDiscoveryState,
  getLawByServerAndTopicExternalId,
  getLawById,
  syncLawRecordFromDiscovery,
  registerLawStub,
  startLawImportRun,
  finishLawImportRun,
  createImportedDraftLawVersion,
  findLawVersionByNormalizedHash,
  replaceImportedLawSourcePosts,
  replaceImportedLawBlocks,
  async fetchHtml(url: string) {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: {
            "user-agent": "Lawyer5RP Law Corpus Importer/1.0",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });

        if (!response.ok) {
          if (response.status >= 500 && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 400));
            continue;
          }

          throw new Error(`Форум вернул HTTP ${response.status}.`);
        }

        return response.text();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, attempt * 400));
      }
    }

    throw new Error("Не удалось получить HTML форума.");
  },
};

export class LawSourceIndexMissingError extends Error {
  constructor() {
    super("Источник законодательной базы не найден.");
    this.name = "LawSourceIndexMissingError";
  }
}

export class LawImportTargetMissingError extends Error {
  constructor() {
    super("Закон для импорта не найден.");
    this.name = "LawImportTargetMissingError";
  }
}

export class LawImportNoPostsError extends Error {
  constructor() {
    super("Не удалось собрать нормативную цепочку постов.");
    this.name = "LawImportNoPostsError";
  }
}

export class LawImportExcludedError extends Error {
  constructor() {
    super("Этот закон помечен как excluded и не должен импортироваться через обычный workflow.");
    this.name = "LawImportExcludedError";
  }
}

function isLikelyNormativeContinuation(post: ParsedForumPost, firstPost: ParsedForumPost) {
  if (!post.normalizedTextFragment.trim()) {
    return false;
  }

  if (firstPost.authorName && post.authorName && firstPost.authorName !== post.authorName) {
    return false;
  }

  const hasNormativeMarkers = /(статья|глава|раздел|приложени|ч\.\s*\d|част[ьяи])/iu.test(
    post.normalizedTextFragment,
  );

  if (hasNormativeMarkers) {
    return true;
  }

  return post.normalizedTextFragment.length >= 80;
}

function collectNormativeChain(posts: ParsedForumPost[]) {
  if (posts.length === 0) {
    return [];
  }

  const includedPosts: ParsedForumPost[] = [posts[0]!];
  const firstPost = posts[0]!;

  for (const post of posts.slice(1)) {
    if (!isLikelyNormativeContinuation(post, firstPost)) {
      break;
    }

    includedPosts.push(post);
  }

  return includedPosts;
}

async function resolveExistingLawManualOverride(
  serverId: string,
  topicExternalId: string,
  dependencies: DiscoveryImportDependencies,
) {
  return dependencies.getLawByServerAndTopicExternalId({
    serverId,
    topicExternalId,
  });
}

async function collectIndexCandidates(
  indexUrl: string,
  dependencies: Pick<DiscoveryImportDependencies, "fetchHtml">,
) {
  const visitedUrls = new Set<string>();
  const queue = [indexUrl];
  const candidatesByTopicId = new Map<string, ReturnType<typeof parseForumIndexCandidates>[number]>();

  while (queue.length > 0) {
    const currentUrl = queue.shift();

    if (!currentUrl || visitedUrls.has(currentUrl)) {
      continue;
    }

    visitedUrls.add(currentUrl);

    const indexHtml = await dependencies.fetchHtml(currentUrl);

    for (const candidate of parseForumIndexCandidates(indexHtml)) {
      candidatesByTopicId.set(candidate.topicExternalId, candidate);
    }

    for (const paginationUrl of parseForumIndexPaginationUrls(indexHtml, currentUrl)) {
      if (!visitedUrls.has(paginationUrl) && !queue.includes(paginationUrl)) {
        queue.push(paginationUrl);
      }
    }
  }

  return {
    pageCount: visitedUrls.size,
    candidates: [...candidatesByTopicId.values()],
  };
}

function summarizeDiscovery(result: {
  pageCount: number;
  candidateCount: number;
  createdCount: number;
  updatedCount: number;
  ignoredCount: number;
  supplementCount: number;
}) {
  return [
    `Страниц индекса: ${result.pageCount}.`,
    `Кандидатов: ${result.candidateCount}.`,
    `Создано новых законов: ${result.createdCount}.`,
    `Обновлено существующих записей: ${result.updatedCount}.`,
    `Дополнений: ${result.supplementCount}.`,
    `Проигнорировано: ${result.ignoredCount}.`,
  ].join(" ");
}

export async function runLawSourceDiscovery(
  sourceIndexId: string,
  dependencies: DiscoveryImportDependencies = defaultDependencies,
) {
  const sourceIndex = await dependencies.getLawSourceIndexById(sourceIndexId);

  if (!sourceIndex) {
    throw new LawSourceIndexMissingError();
  }

  const run = await dependencies.startLawImportRun({
    serverId: sourceIndex.serverId,
    sourceIndexId: sourceIndex.id,
    mode: "discovery",
  });

  await dependencies.updateLawSourceIndexDiscoveryState({
    sourceIndexId: sourceIndex.id,
    lastDiscoveredAt: null,
    lastDiscoveryStatus: "running",
    lastDiscoveryError: null,
  });

  try {
    const { pageCount, candidates } = await collectIndexCandidates(sourceIndex.indexUrl, dependencies);
    let createdCount = 0;
    let updatedCount = 0;
    let ignoredCount = 0;
    let supplementCount = 0;

    for (const candidate of candidates) {
      const existingLaw = await resolveExistingLawManualOverride(
        sourceIndex.serverId,
        candidate.topicExternalId,
        dependencies,
      );
      const classification = classifyLawTopicTitle(candidate.title, {
        isExcluded: existingLaw?.isExcluded,
        classificationOverride: existingLaw?.classificationOverride,
      });

      if (classification === "ignored") {
        ignoredCount += 1;
        continue;
      }

      if (classification === "supplement") {
        supplementCount += 1;
      }

      if (existingLaw) {
        await dependencies.syncLawRecordFromDiscovery({
          lawId: existingLaw.id,
          title: candidate.title,
          topicUrl: candidate.topicUrl,
          lawKind: classification,
          relatedPrimaryLawId: existingLaw.relatedPrimaryLawId ?? null,
        });
        updatedCount += 1;
        continue;
      }

      await dependencies.registerLawStub({
        serverId: sourceIndex.serverId,
        title: candidate.title,
        topicUrl: candidate.topicUrl,
        topicExternalId: candidate.topicExternalId,
        lawKind: classification,
      });
      createdCount += 1;
    }

    const summary = summarizeDiscovery({
      pageCount,
      candidateCount: candidates.length,
      createdCount,
      updatedCount,
      ignoredCount,
      supplementCount,
    });

    await dependencies.finishLawImportRun({
      runId: run.id,
      status: "success",
      summary,
    });

    await dependencies.updateLawSourceIndexDiscoveryState({
      sourceIndexId: sourceIndex.id,
      lastDiscoveredAt: new Date(),
      lastDiscoveryStatus: "success",
      lastDiscoveryError: null,
    });

    return {
      sourceIndex,
      pageCount,
      candidateCount: candidates.length,
      createdCount,
      updatedCount,
      ignoredCount,
      supplementCount,
      summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка discovery.";

    await dependencies.finishLawImportRun({
      runId: run.id,
      status: "failure",
      summary: null,
      error: errorMessage,
    });

    await dependencies.updateLawSourceIndexDiscoveryState({
      sourceIndexId: sourceIndex.id,
      lastDiscoveredAt: new Date(),
      lastDiscoveryStatus: "failure",
      lastDiscoveryError: errorMessage,
    });

    throw error;
  }
}

export async function runLawTopicImport(
  lawId: string,
  dependencies: DiscoveryImportDependencies = defaultDependencies,
) {
  const law = await dependencies.getLawById(lawId);

  if (!law) {
    throw new LawImportTargetMissingError();
  }

  if (law.isExcluded) {
    throw new LawImportExcludedError();
  }

  const run = await dependencies.startLawImportRun({
    serverId: law.serverId,
    mode: "import_law",
  });

  try {
    const topicHtml = await dependencies.fetchHtml(law.topicUrl);
    const parsedPosts = parseForumTopicPosts(topicHtml, law.topicUrl);
    const includedPosts = collectNormativeChain(parsedPosts);

    if (includedPosts.length === 0) {
      throw new LawImportNoPostsError();
    }

    const normalizedFullText = buildNormalizedLawText(includedPosts);

    if (!normalizedFullText) {
      throw new LawImportNoPostsError();
    }

    const sourceSnapshotHash = buildSourceSnapshotHash(includedPosts);
    const normalizedTextHash = buildNormalizedTextHash(normalizedFullText);
    const existingVersion = await dependencies.findLawVersionByNormalizedHash({
      lawId: law.id,
      normalizedTextHash,
    });

    if (existingVersion) {
      const summary = `Изменений нет. Актуальный imported snapshot уже существует для закона ${law.lawKey}.`;

      await dependencies.finishLawImportRun({
        runId: run.id,
        status: "success",
        summary,
      });

      return {
        law,
        version: existingVersion,
        createdNewVersion: false,
        includedPostsCount: includedPosts.length,
        summary,
      };
    }

    const createdVersion = await dependencies.createImportedDraftLawVersion({
      lawId: law.id,
      normalizedFullText,
      sourceSnapshotHash,
      normalizedTextHash,
    });
    const blocks = segmentLawTextIntoBlocks(normalizedFullText);

    await dependencies.replaceImportedLawSourcePosts({
      lawVersionId: createdVersion.id,
      posts: includedPosts.map((post) => ({
        postExternalId: post.postExternalId,
        postUrl: post.postUrl,
        postOrder: post.postOrder,
        authorName: post.authorName,
        postedAt: post.postedAt,
        rawHtml: post.rawHtml,
        rawText: post.rawText,
        normalizedTextFragment: post.normalizedTextFragment,
      })),
    });

    await dependencies.replaceImportedLawBlocks({
      lawVersionId: createdVersion.id,
      blocks,
    });

    const summary = `Создана imported_draft версия из ${includedPosts.length} постов и ${blocks.length} логических блоков.`;

    await dependencies.finishLawImportRun({
      runId: run.id,
      status: "success",
      summary,
    });

    return {
      law,
      version: createdVersion,
      createdNewVersion: true,
      includedPostsCount: includedPosts.length,
      blockCount: blocks.length,
      summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка импорта.";

    await dependencies.finishLawImportRun({
      runId: run.id,
      status: "failure",
      summary: null,
      error: errorMessage,
    });

    throw error;
  }
}
