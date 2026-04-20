import {
  createPrecedentRecord,
  getPrecedentByServerAndKey,
  getPrecedentBySourceTopicAndLocator,
  updatePrecedentDisplayTitle,
} from "@/db/repositories/precedent.repository";
import {
  createPrecedentImportRunRecord,
  finishPrecedentImportRunRecord,
  getActivePrecedentImportRunByLockKey,
} from "@/db/repositories/precedent-import-run.repository";
import {
  createPrecedentVersionRecord,
  findPrecedentVersionByNormalizedHash,
  listPrecedentVersionsByPrecedent,
  updatePrecedentVersionMutableFields,
} from "@/db/repositories/precedent-version.repository";
import { replacePrecedentBlocksForVersion } from "@/db/repositories/precedent-block.repository";
import { replacePrecedentSourcePostsForVersion } from "@/db/repositories/precedent-source-post.repository";
import {
  createPrecedentBlockInputSchema,
  createPrecedentImportRunInputSchema,
  createPrecedentVersionInputSchema,
  finishPrecedentImportRunInputSchema,
  normalizePrecedentKeyCandidate,
} from "@/schemas/precedent-corpus";

type PrecedentFoundationRepository = {
  getPrecedentBySourceTopicAndLocator: typeof getPrecedentBySourceTopicAndLocator;
  getPrecedentByServerAndKey: typeof getPrecedentByServerAndKey;
  createPrecedentRecord: typeof createPrecedentRecord;
  updatePrecedentDisplayTitle: typeof updatePrecedentDisplayTitle;
  getActivePrecedentImportRunByLockKey: typeof getActivePrecedentImportRunByLockKey;
  createPrecedentImportRunRecord: typeof createPrecedentImportRunRecord;
  finishPrecedentImportRunRecord: typeof finishPrecedentImportRunRecord;
  findPrecedentVersionByNormalizedHash: typeof findPrecedentVersionByNormalizedHash;
  createPrecedentVersionRecord: typeof createPrecedentVersionRecord;
  listPrecedentVersionsByPrecedent: typeof listPrecedentVersionsByPrecedent;
  updatePrecedentVersionMutableFields: typeof updatePrecedentVersionMutableFields;
  replacePrecedentSourcePostsForVersion: typeof replacePrecedentSourcePostsForVersion;
  replacePrecedentBlocksForVersion: typeof replacePrecedentBlocksForVersion;
};

const defaultRepository: PrecedentFoundationRepository = {
  getPrecedentBySourceTopicAndLocator,
  getPrecedentByServerAndKey,
  createPrecedentRecord,
  updatePrecedentDisplayTitle,
  getActivePrecedentImportRunByLockKey,
  createPrecedentImportRunRecord,
  finishPrecedentImportRunRecord,
  findPrecedentVersionByNormalizedHash,
  createPrecedentVersionRecord,
  listPrecedentVersionsByPrecedent,
  updatePrecedentVersionMutableFields,
  replacePrecedentSourcePostsForVersion,
  replacePrecedentBlocksForVersion,
};

export class PrecedentImportRunConflictError extends Error {
  constructor() {
    super("Another precedent import run is already active for this lock key");
    this.name = "PrecedentImportRunConflictError";
  }
}

function buildPrecedentKeySuffix(sourceTopicId: string, locatorKey: string) {
  return normalizePrecedentKeyCandidate(`${sourceTopicId}_${locatorKey}`).slice(-24) || "precedent";
}

function buildValidPrecedentKeyBase(displayTitle: string, locatorKey: string) {
  const titleCandidate = normalizePrecedentKeyCandidate(displayTitle).slice(0, 64);

  if (titleCandidate.length >= 2 && /[a-z]/.test(titleCandidate)) {
    return titleCandidate;
  }

  const locatorCandidate = normalizePrecedentKeyCandidate(`precedent_${locatorKey}`).slice(0, 64);

  if (locatorCandidate.length >= 2 && /[a-z]/.test(locatorCandidate)) {
    return locatorCandidate;
  }

  return "precedent";
}

export async function registerPrecedentStub(
  input: {
    serverId: string;
    precedentSourceTopicId: string;
    displayTitle: string;
    precedentLocatorKey: string;
  },
  repository: PrecedentFoundationRepository = defaultRepository,
) {
  const existing = await repository.getPrecedentBySourceTopicAndLocator({
    precedentSourceTopicId: input.precedentSourceTopicId,
    precedentLocatorKey: input.precedentLocatorKey,
  });

  if (existing) {
    if (existing.displayTitle !== input.displayTitle) {
      await repository.updatePrecedentDisplayTitle({
        precedentId: existing.id,
        displayTitle: input.displayTitle,
      });
    }

    return existing;
  }

  const basePrecedentKey = buildValidPrecedentKeyBase(input.displayTitle, input.precedentLocatorKey);
  const suffix = buildPrecedentKeySuffix(input.precedentSourceTopicId, input.precedentLocatorKey);
  let precedentKey = basePrecedentKey;
  let attempt = 0;

  while (
    await repository.getPrecedentByServerAndKey({
      serverId: input.serverId,
      precedentKey,
    })
  ) {
    attempt += 1;
    const nextSuffix = attempt === 1 ? suffix : `${suffix}_${attempt}`;
    precedentKey = `${basePrecedentKey.slice(0, Math.max(2, 64 - nextSuffix.length - 1))}_${nextSuffix}`;
  }

  return repository.createPrecedentRecord({
    serverId: input.serverId,
    precedentSourceTopicId: input.precedentSourceTopicId,
    precedentKey,
    displayTitle: input.displayTitle,
    precedentLocatorKey: input.precedentLocatorKey,
    validityStatus: "applicable",
  });
}

export function buildPrecedentImportRunLockKey(input: {
  serverId: string;
  mode: "discovery" | "import_source_topic";
  sourceIndexId?: string | null;
  sourceTopicId?: string | null;
}) {
  const parsed = createPrecedentImportRunInputSchema.parse(input);
  const sourceScope = parsed.sourceTopicId ?? parsed.sourceIndexId ?? "server";

  return `precedent-run:${parsed.serverId}:${parsed.mode}:${sourceScope}`;
}

export async function startPrecedentImportRun(
  input: {
    serverId: string;
    mode: "discovery" | "import_source_topic";
    sourceIndexId?: string | null;
    sourceTopicId?: string | null;
  },
  repository: PrecedentFoundationRepository = defaultRepository,
) {
  const parsed = createPrecedentImportRunInputSchema.parse(input);
  const lockKey = buildPrecedentImportRunLockKey(parsed);
  const activeRun = await repository.getActivePrecedentImportRunByLockKey(lockKey);

  if (activeRun) {
    throw new PrecedentImportRunConflictError();
  }

  return repository.createPrecedentImportRunRecord({
    serverId: parsed.serverId,
    sourceIndexId: parsed.sourceIndexId ?? null,
    sourceTopicId: parsed.sourceTopicId ?? null,
    mode: parsed.mode,
    status: "running",
    lockKey,
  });
}

export async function finishPrecedentImportRun(
  input: {
    runId: string;
    status: "running" | "success" | "failure";
    summary?: string | null;
    error?: string | null;
  },
  repository: PrecedentFoundationRepository = defaultRepository,
) {
  const parsed = finishPrecedentImportRunInputSchema.parse(input);

  return repository.finishPrecedentImportRunRecord(parsed);
}

export async function createImportedDraftPrecedentVersion(
  input: {
    precedentId: string;
    normalizedFullText: string;
    sourceSnapshotHash: string;
    normalizedTextHash: string;
  },
  repository: PrecedentFoundationRepository = defaultRepository,
) {
  const parsed = createPrecedentVersionInputSchema.parse({
    ...input,
    status: "imported_draft",
  });
  const existingVersion = await repository.findPrecedentVersionByNormalizedHash({
    precedentId: parsed.precedentId,
    normalizedTextHash: parsed.normalizedTextHash,
  });

  if (existingVersion) {
    return existingVersion;
  }

  const existingVersions = await repository.listPrecedentVersionsByPrecedent(parsed.precedentId);

  for (const existingDraft of existingVersions.filter((version) => version.status === "imported_draft")) {
    await repository.updatePrecedentVersionMutableFields(existingDraft.id, {
      status: "superseded",
    });
  }

  return repository.createPrecedentVersionRecord(parsed);
}

export async function replaceImportedPrecedentSourcePosts(
  input: {
    precedentVersionId: string;
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
  repository: PrecedentFoundationRepository = defaultRepository,
) {
  return repository.replacePrecedentSourcePostsForVersion(input);
}

export async function replaceImportedPrecedentBlocks(
  input: {
    precedentVersionId: string;
    blocks: Array<{
      blockType: "facts" | "issue" | "holding" | "reasoning" | "resolution" | "unstructured";
      blockOrder: number;
      blockTitle?: string | null;
      blockText: string;
      parentBlockId?: string | null;
    }>;
  },
  repository: PrecedentFoundationRepository = defaultRepository,
) {
  input.blocks.forEach((block) => createPrecedentBlockInputSchema.parse(block));

  return repository.replacePrecedentBlocksForVersion(input);
}
