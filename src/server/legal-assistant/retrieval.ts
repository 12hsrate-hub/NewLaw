import { createHash } from "node:crypto";

import { searchCurrentLawCorpus } from "@/server/law-corpus/retrieval";
import { searchCurrentPrecedentCorpus } from "@/server/precedent-corpus/retrieval";

type AssistantRetrievalDependencies = {
  searchCurrentLawCorpus: typeof searchCurrentLawCorpus;
  searchCurrentPrecedentCorpus: typeof searchCurrentPrecedentCorpus;
  now: () => Date;
};

const defaultDependencies: AssistantRetrievalDependencies = {
  searchCurrentLawCorpus,
  searchCurrentPrecedentCorpus,
  now: () => new Date(),
};

export type LawRetrievalResult = Awaited<ReturnType<typeof searchCurrentLawCorpus>>;
export type PrecedentRetrievalResult = Awaited<ReturnType<typeof searchCurrentPrecedentCorpus>>;

export type AssistantLawReference = LawRetrievalResult["results"][number] & {
  sourceKind: "law";
};

export type AssistantPrecedentReference = PrecedentRetrievalResult["results"][number] & {
  sourceKind: "precedent";
};

export type AssistantTypedRetrievalReference = AssistantLawReference | AssistantPrecedentReference;

function buildCombinedRetrievalRevision(input: {
  serverId: string;
  lawCorpusSnapshot: LawRetrievalResult["corpusSnapshot"];
  precedentCorpusSnapshot: PrecedentRetrievalResult["corpusSnapshot"];
  generatedAt: Date;
}) {
  const snapshotInput = [
    input.serverId,
    input.lawCorpusSnapshot.corpusSnapshotHash,
    input.precedentCorpusSnapshot.corpusSnapshotHash,
    ...input.lawCorpusSnapshot.currentVersionIds,
    ...input.precedentCorpusSnapshot.currentVersionIds,
  ].join("|");

  return {
    serverId: input.serverId,
    generatedAt: input.generatedAt.toISOString(),
    lawCorpusSnapshotHash: input.lawCorpusSnapshot.corpusSnapshotHash,
    precedentCorpusSnapshotHash: input.precedentCorpusSnapshot.corpusSnapshotHash,
    combinedCorpusSnapshotHash: createHash("sha256").update(snapshotInput).digest("hex"),
    lawCurrentVersionIds: input.lawCorpusSnapshot.currentVersionIds,
    precedentCurrentVersionIds: input.precedentCorpusSnapshot.currentVersionIds,
  };
}

export async function searchAssistantCorpus(
  input: {
    serverId: string;
    query: string;
    lawLimit?: number;
    precedentLimit?: number;
  },
  dependencies: AssistantRetrievalDependencies = defaultDependencies,
) {
  const [lawRetrieval, precedentRetrieval] = await Promise.all([
    dependencies.searchCurrentLawCorpus({
      serverId: input.serverId,
      query: input.query,
      limit: input.lawLimit ?? 6,
    }),
    dependencies.searchCurrentPrecedentCorpus({
      serverId: input.serverId,
      query: input.query,
      limit: input.precedentLimit ?? 4,
      includeValidityStatuses: ["applicable", "limited"],
    }),
  ]);
  const generatedAt = dependencies.now();
  const combinedRetrievalRevision = buildCombinedRetrievalRevision({
    serverId: input.serverId,
    lawCorpusSnapshot: lawRetrieval.corpusSnapshot,
    precedentCorpusSnapshot: precedentRetrieval.corpusSnapshot,
    generatedAt,
  });

  return {
    serverId: input.serverId,
    query: input.query,
    generatedAt: generatedAt.toISOString(),
    hasCurrentLawCorpus: lawRetrieval.corpusSnapshot.currentVersionIds.length > 0,
    hasUsablePrecedentCorpus: precedentRetrieval.corpusSnapshot.currentVersionIds.length > 0,
    hasAnyUsableCorpus:
      lawRetrieval.corpusSnapshot.currentVersionIds.length > 0 ||
      precedentRetrieval.corpusSnapshot.currentVersionIds.length > 0,
    lawRetrieval,
    precedentRetrieval,
    resultCount: lawRetrieval.resultCount + precedentRetrieval.resultCount,
    results: [
      ...lawRetrieval.results.map(
        (result) =>
          ({
            ...result,
            sourceKind: "law",
          }) satisfies AssistantLawReference,
      ),
      ...precedentRetrieval.results.map(
        (result) =>
          ({
            ...result,
            sourceKind: "precedent",
          }) satisfies AssistantPrecedentReference,
      ),
    ],
    lawCorpusSnapshot: lawRetrieval.corpusSnapshot,
    precedentCorpusSnapshot: precedentRetrieval.corpusSnapshot,
    combinedRetrievalRevision,
  };
}
