import { getServerById } from "@/db/repositories/server.repository";
import {
  countLawSourceIndexesByServer,
  createLawSourceIndexRecord,
  findLawSourceIndexByServerAndUrl,
  getLawSourceIndexById,
  updateLawSourceIndexEnabledState,
} from "@/db/repositories/law-source-index.repository";
import {
  createLawSourceIndexInputSchema,
  type CreateLawSourceIndexInput,
  type UpdateLawSourceIndexEnabledInput,
  updateLawSourceIndexEnabledInputSchema,
} from "@/schemas/law-corpus";

export const MAX_LAW_SOURCE_INDEXES_PER_SERVER = 2;

type LawSourceManagementRepository = {
  getServerById: typeof getServerById;
  countLawSourceIndexesByServer: typeof countLawSourceIndexesByServer;
  findLawSourceIndexByServerAndUrl: typeof findLawSourceIndexByServerAndUrl;
  createLawSourceIndexRecord: typeof createLawSourceIndexRecord;
  getLawSourceIndexById: typeof getLawSourceIndexById;
  updateLawSourceIndexEnabledState: typeof updateLawSourceIndexEnabledState;
};

const defaultRepository: LawSourceManagementRepository = {
  getServerById,
  countLawSourceIndexesByServer,
  findLawSourceIndexByServerAndUrl,
  createLawSourceIndexRecord,
  getLawSourceIndexById,
  updateLawSourceIndexEnabledState,
};

export class LawSourceIndexLimitExceededError extends Error {
  constructor() {
    super("Source index limit reached for server");
    this.name = "LawSourceIndexLimitExceededError";
  }
}

export class LawSourceIndexDuplicateError extends Error {
  constructor() {
    super("Source index already exists for server");
    this.name = "LawSourceIndexDuplicateError";
  }
}

export class LawSourceIndexNotFoundError extends Error {
  constructor() {
    super("Law source index not found");
    this.name = "LawSourceIndexNotFoundError";
  }
}

export class LawSourceServerNotFoundError extends Error {
  constructor() {
    super("Server not found for law source management");
    this.name = "LawSourceServerNotFoundError";
  }
}

export async function addLawSourceIndexForServer(
  input: CreateLawSourceIndexInput,
  repository: LawSourceManagementRepository = defaultRepository,
) {
  const parsed = createLawSourceIndexInputSchema.parse(input);
  const server = await repository.getServerById(parsed.serverId);

  if (!server) {
    throw new LawSourceServerNotFoundError();
  }

  const currentCount = await repository.countLawSourceIndexesByServer(parsed.serverId);

  if (currentCount >= MAX_LAW_SOURCE_INDEXES_PER_SERVER) {
    throw new LawSourceIndexLimitExceededError();
  }

  const existingSource = await repository.findLawSourceIndexByServerAndUrl({
    serverId: parsed.serverId,
    indexUrl: parsed.indexUrl,
  });

  if (existingSource) {
    throw new LawSourceIndexDuplicateError();
  }

  return repository.createLawSourceIndexRecord(parsed);
}

export async function setLawSourceIndexEnabledState(
  input: UpdateLawSourceIndexEnabledInput,
  repository: LawSourceManagementRepository = defaultRepository,
) {
  const parsed = updateLawSourceIndexEnabledInputSchema.parse(input);
  const sourceIndex = await repository.getLawSourceIndexById(parsed.sourceIndexId);

  if (!sourceIndex) {
    throw new LawSourceIndexNotFoundError();
  }

  return repository.updateLawSourceIndexEnabledState(parsed);
}
