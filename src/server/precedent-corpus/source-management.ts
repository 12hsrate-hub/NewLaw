import { getLawSourceIndexById } from "@/db/repositories/law-source-index.repository";
import {
  createPrecedentSourceTopicRecord,
  findPrecedentSourceTopicByServerAndTopicExternalId,
  getPrecedentSourceTopicById,
  updatePrecedentSourceTopicManualOverride,
} from "@/db/repositories/precedent-source-topic.repository";
import {
  createPrecedentSourceTopicInputSchema,
  extractPrecedentTopicExternalId,
  precedentSourceTopicManualOverrideSchema,
  type CreatePrecedentSourceTopicInput,
  type PrecedentSourceTopicManualOverrideInput,
} from "@/schemas/precedent-corpus";

type PrecedentSourceManagementRepository = {
  getLawSourceIndexById: typeof getLawSourceIndexById;
  findPrecedentSourceTopicByServerAndTopicExternalId: typeof findPrecedentSourceTopicByServerAndTopicExternalId;
  createPrecedentSourceTopicRecord: typeof createPrecedentSourceTopicRecord;
  getPrecedentSourceTopicById: typeof getPrecedentSourceTopicById;
  updatePrecedentSourceTopicManualOverride: typeof updatePrecedentSourceTopicManualOverride;
};

const defaultRepository: PrecedentSourceManagementRepository = {
  getLawSourceIndexById,
  findPrecedentSourceTopicByServerAndTopicExternalId,
  createPrecedentSourceTopicRecord,
  getPrecedentSourceTopicById,
  updatePrecedentSourceTopicManualOverride,
};

export class PrecedentSourceIndexNotFoundError extends Error {
  constructor() {
    super("Source index not found for precedent source management");
    this.name = "PrecedentSourceIndexNotFoundError";
  }
}

export class PrecedentSourceTopicDuplicateError extends Error {
  constructor() {
    super("Precedent source topic already exists for server");
    this.name = "PrecedentSourceTopicDuplicateError";
  }
}

export class PrecedentSourceTopicNotFoundError extends Error {
  constructor() {
    super("Precedent source topic not found");
    this.name = "PrecedentSourceTopicNotFoundError";
  }
}

export async function addPrecedentSourceTopic(
  input: CreatePrecedentSourceTopicInput,
  repository: PrecedentSourceManagementRepository = defaultRepository,
) {
  const parsed = createPrecedentSourceTopicInputSchema.parse(input);
  const sourceIndex = await repository.getLawSourceIndexById(parsed.sourceIndexId);

  if (!sourceIndex) {
    throw new PrecedentSourceIndexNotFoundError();
  }

  const topicExternalId = extractPrecedentTopicExternalId(parsed.topicUrl);
  const existingSourceTopic = await repository.findPrecedentSourceTopicByServerAndTopicExternalId({
    serverId: sourceIndex.serverId,
    topicExternalId,
  });

  if (existingSourceTopic) {
    throw new PrecedentSourceTopicDuplicateError();
  }

  return repository.createPrecedentSourceTopicRecord({
    serverId: sourceIndex.serverId,
    sourceIndexId: parsed.sourceIndexId,
    topicUrl: parsed.topicUrl,
    topicExternalId,
    title: parsed.title,
  });
}

export async function updatePrecedentSourceTopicOverrides(
  input: PrecedentSourceTopicManualOverrideInput,
  repository: PrecedentSourceManagementRepository = defaultRepository,
) {
  const parsed = precedentSourceTopicManualOverrideSchema.parse(input);
  const sourceTopic = await repository.getPrecedentSourceTopicById(parsed.sourceTopicId);

  if (!sourceTopic) {
    throw new PrecedentSourceTopicNotFoundError();
  }

  return repository.updatePrecedentSourceTopicManualOverride(parsed);
}
