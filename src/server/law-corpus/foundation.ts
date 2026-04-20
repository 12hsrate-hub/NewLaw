import {
  createLawRecord,
  getLawByServerAndLawKey,
  getLawByServerAndTopicExternalId,
} from "@/db/repositories/law.repository";
import {
  createLawImportRunRecord,
  finishLawImportRunRecord,
  getActiveLawImportRunByLockKey,
} from "@/db/repositories/law-import-run.repository";
import {
  createLawVersionRecord,
  findLawVersionByNormalizedHash,
} from "@/db/repositories/law-version.repository";
import {
  createLawBlockInputSchema,
  createLawImportRunInputSchema,
  createLawVersionInputSchema,
  finishLawImportRunInputSchema,
  normalizeLawKeyCandidate,
  registerLawInputSchema,
} from "@/schemas/law-corpus";
import { replaceLawBlocksForVersion } from "@/db/repositories/law-block.repository";
import { replaceLawSourcePostsForVersion } from "@/db/repositories/law-source-post.repository";

type LawFoundationRepository = {
  getLawByServerAndTopicExternalId: typeof getLawByServerAndTopicExternalId;
  getLawByServerAndLawKey: typeof getLawByServerAndLawKey;
  createLawRecord: typeof createLawRecord;
  getActiveLawImportRunByLockKey: typeof getActiveLawImportRunByLockKey;
  createLawImportRunRecord: typeof createLawImportRunRecord;
  finishLawImportRunRecord: typeof finishLawImportRunRecord;
  findLawVersionByNormalizedHash: typeof findLawVersionByNormalizedHash;
  createLawVersionRecord: typeof createLawVersionRecord;
  replaceLawSourcePostsForVersion: typeof replaceLawSourcePostsForVersion;
  replaceLawBlocksForVersion: typeof replaceLawBlocksForVersion;
};

const defaultRepository: LawFoundationRepository = {
  getLawByServerAndTopicExternalId,
  getLawByServerAndLawKey,
  createLawRecord,
  getActiveLawImportRunByLockKey,
  createLawImportRunRecord,
  finishLawImportRunRecord,
  findLawVersionByNormalizedHash,
  createLawVersionRecord,
  replaceLawSourcePostsForVersion,
  replaceLawBlocksForVersion,
};

export class LawImportRunConflictError extends Error {
  constructor() {
    super("Another import run is already active for this lock key");
    this.name = "LawImportRunConflictError";
  }
}

function buildLawKeyFromTitle(title: string) {
  const candidate = normalizeLawKeyCandidate(title);

  return candidate.slice(0, 64);
}

function buildLawKeySuffix(topicExternalId: string) {
  return topicExternalId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-16);
}

export async function registerLawStub(
  input: {
    serverId: string;
    title: string;
    topicUrl: string;
    topicExternalId: string;
    lawKind: "primary" | "supplement";
    relatedPrimaryLawId?: string | null;
    isExcluded?: boolean;
    classificationOverride?: "primary" | "supplement" | null;
    internalNote?: string | null;
  },
  repository: LawFoundationRepository = defaultRepository,
) {
  const parsed = registerLawInputSchema.parse(input);
  const existingLaw = await repository.getLawByServerAndTopicExternalId({
    serverId: parsed.serverId,
    topicExternalId: parsed.topicExternalId,
  });

  if (existingLaw) {
    return existingLaw;
  }

  const baseLawKey = buildLawKeyFromTitle(parsed.title);
  const externalSuffix = buildLawKeySuffix(parsed.topicExternalId) || "topic";
  let lawKey = baseLawKey;
  let attempt = 0;

  while (
    await repository.getLawByServerAndLawKey({
      serverId: parsed.serverId,
      lawKey,
    })
  ) {
    attempt += 1;
    const suffix = attempt === 1 ? externalSuffix : `${externalSuffix}_${attempt}`;
    lawKey = `${baseLawKey.slice(0, Math.max(2, 64 - suffix.length - 1))}_${suffix}`;
  }

  return repository.createLawRecord({
    serverId: parsed.serverId,
    lawKey,
    title: parsed.title,
    topicUrl: parsed.topicUrl,
    topicExternalId: parsed.topicExternalId,
    lawKind: parsed.lawKind,
    relatedPrimaryLawId: parsed.relatedPrimaryLawId ?? null,
    isExcluded: parsed.isExcluded ?? false,
    classificationOverride: parsed.classificationOverride ?? null,
    internalNote: parsed.internalNote ?? null,
  });
}

export function buildLawImportRunLockKey(input: {
  serverId: string;
  mode: "discovery" | "import_law";
  sourceIndexId?: string | null;
}) {
  const parsed = createLawImportRunInputSchema.parse(input);
  const sourceScope = parsed.sourceIndexId ?? "server";

  return `law-run:${parsed.serverId}:${parsed.mode}:${sourceScope}`;
}

export async function startLawImportRun(
  input: {
    serverId: string;
    mode: "discovery" | "import_law";
    sourceIndexId?: string | null;
  },
  repository: LawFoundationRepository = defaultRepository,
) {
  const parsed = createLawImportRunInputSchema.parse(input);
  const lockKey = buildLawImportRunLockKey(parsed);
  const activeRun = await repository.getActiveLawImportRunByLockKey(lockKey);

  if (activeRun) {
    throw new LawImportRunConflictError();
  }

  return repository.createLawImportRunRecord({
    serverId: parsed.serverId,
    sourceIndexId: parsed.sourceIndexId ?? null,
    mode: parsed.mode,
    status: "running",
    lockKey,
  });
}

export async function finishLawImportRun(
  input: {
    runId: string;
    status: "running" | "success" | "failure";
    summary?: string | null;
    error?: string | null;
  },
  repository: LawFoundationRepository = defaultRepository,
) {
  const parsed = finishLawImportRunInputSchema.parse(input);

  return repository.finishLawImportRunRecord(parsed);
}

export async function createImportedDraftLawVersion(
  input: {
    lawId: string;
    normalizedFullText: string;
    sourceSnapshotHash: string;
    normalizedTextHash: string;
  },
  repository: LawFoundationRepository = defaultRepository,
) {
  const parsed = createLawVersionInputSchema.parse({
    ...input,
    status: "imported_draft",
  });
  const existingVersion = await repository.findLawVersionByNormalizedHash({
    lawId: parsed.lawId,
    normalizedTextHash: parsed.normalizedTextHash,
  });

  if (existingVersion) {
    return existingVersion;
  }

  return repository.createLawVersionRecord(parsed);
}

export async function replaceImportedLawSourcePosts(
  input: {
    lawVersionId: string;
    posts: Array<{
      postExternalId: string;
      postUrl: string;
      postOrder: number;
      authorName?: string | null;
      postedAt?: Date | null;
      rawHtml: string;
      rawText: string;
      normalizedTextFragment: string;
    }>;
  },
  repository: LawFoundationRepository = defaultRepository,
) {
  return repository.replaceLawSourcePostsForVersion(input);
}

export async function replaceImportedLawBlocks(
  input: {
    lawVersionId: string;
    blocks: Array<{
      blockType: "section" | "chapter" | "article" | "appendix" | "unstructured";
      blockOrder: number;
      blockTitle?: string | null;
      blockText: string;
      parentBlockId?: string | null;
      articleNumberNormalized?: string | null;
    }>;
  },
  repository: LawFoundationRepository = defaultRepository,
) {
  input.blocks.forEach((block) => createLawBlockInputSchema.parse(block));

  return repository.replaceLawBlocksForVersion(input);
}
