export type LawCorpusBootstrapHealthStatus =
  | "corpus_bootstrap_incomplete"
  | "usable_with_gaps"
  | "current_corpus_ready";

type LawBootstrapInputItem = {
  lawKind: "primary" | "supplement";
  isExcluded: boolean;
  classificationOverride: "primary" | "supplement" | null;
  currentVersionId: string | null;
  versionCount: number;
};

export function resolveEffectiveLawKind(law: Pick<LawBootstrapInputItem, "lawKind" | "isExcluded" | "classificationOverride">) {
  if (law.isExcluded) {
    return "ignored" as const;
  }

  return (law.classificationOverride ?? law.lawKind) as "primary" | "supplement";
}

export function buildLawCorpusBootstrapHealth(
  laws: LawBootstrapInputItem[],
  options?: {
    hasDiscoveryFailure?: boolean;
  },
) {
  const primaryLaws = laws.filter((law) => resolveEffectiveLawKind(law) === "primary");
  const supplementCount = laws.filter((law) => resolveEffectiveLawKind(law) === "supplement").length;
  const ignoredCount = laws.filter((law) => resolveEffectiveLawKind(law) === "ignored").length;
  const currentPrimaryCount = primaryLaws.filter((law) => law.currentVersionId).length;
  const draftOnlyPrimaryCount = primaryLaws.filter(
    (law) => law.versionCount > 0 && !law.currentVersionId,
  ).length;
  const missingImportPrimaryCount = primaryLaws.filter((law) => law.versionCount === 0).length;

  let status: LawCorpusBootstrapHealthStatus = "current_corpus_ready";

  if (
    primaryLaws.length === 0 ||
    currentPrimaryCount === 0 ||
    Boolean(options?.hasDiscoveryFailure)
  ) {
    status = "corpus_bootstrap_incomplete";
  } else if (
    currentPrimaryCount < primaryLaws.length ||
    draftOnlyPrimaryCount > 0 ||
    missingImportPrimaryCount > 0
  ) {
    status = "usable_with_gaps";
  }

  return {
    status,
    primaryLawCount: primaryLaws.length,
    supplementCount,
    ignoredCount,
    currentPrimaryCount,
    draftOnlyPrimaryCount,
    missingImportPrimaryCount,
    hasDiscoveryFailure: Boolean(options?.hasDiscoveryFailure),
  };
}
