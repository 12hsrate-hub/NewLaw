import { createHash } from "node:crypto";

import { buildAssistantRetrievalQuery } from "@/server/legal-core/assistant-retrieval-query";
import type { LegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import {
  type LawRetrievalResult as CurrentLawRetrievalResult,
  searchCurrentLawCorpus,
  searchCurrentLawCorpusWithContext,
} from "@/server/law-corpus/retrieval";
import { searchCurrentPrecedentCorpus } from "@/server/precedent-corpus/retrieval";

type AssistantRetrievalDependencies = {
  searchCurrentLawCorpus: typeof searchCurrentLawCorpus;
  searchCurrentLawCorpusWithContext: typeof searchCurrentLawCorpusWithContext;
  searchCurrentPrecedentCorpus: typeof searchCurrentPrecedentCorpus;
  now: () => Date;
};

const defaultDependencies: AssistantRetrievalDependencies = {
  searchCurrentLawCorpus,
  searchCurrentLawCorpusWithContext,
  searchCurrentPrecedentCorpus,
  now: () => new Date(),
};

export type LawRetrievalResult = CurrentLawRetrievalResult;
export type PrecedentRetrievalResult = Awaited<ReturnType<typeof searchCurrentPrecedentCorpus>>;

export type AssistantLawReference = LawRetrievalResult["results"][number] & {
  sourceKind: "law";
};

export type AssistantPrecedentReference = PrecedentRetrievalResult["results"][number] & {
  sourceKind: "precedent";
};

export type AssistantTypedRetrievalReference = AssistantLawReference | AssistantPrecedentReference;

export type AssistantCorpusRetrievalResult = {
  serverId: string;
  query: string;
  generatedAt: string;
  hasCurrentLawCorpus: boolean;
  hasUsablePrecedentCorpus: boolean;
  hasAnyUsableCorpus: boolean;
  lawRetrieval: LawRetrievalResult;
  precedentRetrieval: PrecedentRetrievalResult;
  retrievalDebug?: LawRetrievalResult["retrievalDebug"] | null;
  resultCount: number;
  results: AssistantTypedRetrievalReference[];
  lawCorpusSnapshot: LawRetrievalResult["corpusSnapshot"];
  precedentCorpusSnapshot: PrecedentRetrievalResult["corpusSnapshot"];
  combinedRetrievalRevision: ReturnType<typeof buildCombinedRetrievalRevision>;
};

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
    legalQueryPlan?: LegalQueryPlan | null;
  },
  dependencies: AssistantRetrievalDependencies = defaultDependencies,
): Promise<AssistantCorpusRetrievalResult> {
  const queryBreakdown = input.legalQueryPlan
    ? buildAssistantRetrievalQuery({
        normalized_input: input.legalQueryPlan.normalized_input,
        intent: input.legalQueryPlan.intent,
        required_law_families: input.legalQueryPlan.required_law_families,
        preferred_norm_roles: input.legalQueryPlan.preferred_norm_roles,
        legal_anchors: [...input.legalQueryPlan.legal_anchors],
        question_scope: input.legalQueryPlan.question_scope,
        forbidden_scope_markers: input.legalQueryPlan.forbidden_scope_markers,
      })
    : null;
  const lawRetrievalPromise: Promise<LawRetrievalResult> =
    input.legalQueryPlan && queryBreakdown
      ? dependencies.searchCurrentLawCorpusWithContext({
          serverId: input.serverId,
          query: input.query,
          limit: input.lawLimit ?? 6,
          retrievalContext: {
            legalQueryPlan: input.legalQueryPlan,
            queryBreakdown,
          },
        })
      : dependencies.searchCurrentLawCorpus({
          serverId: input.serverId,
          query: input.query,
          limit: input.lawLimit ?? 6,
        }).then((result) => ({
          ...result,
          retrievalDebug: null,
        }));
  const [lawRetrieval, precedentRetrieval] = await Promise.all([
    lawRetrievalPromise,
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
    retrievalDebug: lawRetrieval.retrievalDebug,
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
