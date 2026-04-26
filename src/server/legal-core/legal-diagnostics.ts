import type { LegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import type {
  LegalSelectionCandidate,
  StructuredSelectionResult,
} from "@/server/legal-core/legal-selection";

export const legalGroundingFlags = [
  "missing_primary_basis_norm",
  "law_family_mismatch",
  "weak_direct_basis",
  "off_topic_context_norm",
  "general_law_used_instead_of_specific_law",
  "specific_law_used_without_scope",
  "sanction_used_as_primary",
  "procedure_used_as_primary",
  "exception_used_as_primary",
  "wrong_source_family",
  "wrong_primary_basis",
] as const;

export type LegalGroundingFlag = (typeof legalGroundingFlags)[number];

export type LegalCandidateDiagnostic = {
  server_id: string;
  law_id: string;
  law_name: string;
  law_version: string;
  law_block_id: string;
  article_number: string | null;
  law_family: string;
  norm_role: string;
  applicability_score: number;
  primary_basis_eligibility: string;
  primary_basis_eligibility_reason: string | null;
  ineligible_primary_basis_reasons: string[];
  weak_primary_basis_reasons: string[];
  matched_anchors: string[];
  matched_required_law_family: boolean;
  matched_preferred_norm_role: boolean;
  off_topic: boolean;
  penalties: string[];
  specificity_rank: number;
  specificity_reasons: string[];
  specificity_penalties: string[];
  source_channel: string | null;
  citation_resolution_status: string | null;
};

export type LegalGroundingDiagnostics = {
  candidate_diagnostics: LegalCandidateDiagnostic[];
  grounding_diagnostics: {
    flags: LegalGroundingFlag[];
    direct_basis_status: StructuredSelectionResult["direct_basis_status"];
    selected_norm_count: number;
    primary_basis_norm_count: number;
    selected_law_families: string[];
    legal_issue_type: LegalQueryPlan["primaryLegalIssueType"];
    legal_issue_secondary_types: LegalQueryPlan["secondaryLegalIssueTypes"];
    legal_issue_confidence: LegalQueryPlan["legalIssueConfidence"];
    selected_primary_specificity_ranks?: number[];
  };
};

export function buildLegalGroundingDiagnostics<TCandidate extends LegalSelectionCandidate>(input: {
  plan: LegalQueryPlan;
  selection: StructuredSelectionResult<TCandidate>;
}) {
  const candidateDiagnostics = input.selection.scored_candidates.map((entry) => ({
    server_id: entry.candidate.serverId,
    law_id: entry.candidate.lawId,
    law_name: entry.candidate.lawTitle,
    law_version: entry.candidate.lawVersionId,
    law_block_id: entry.candidate.lawBlockId,
    article_number: entry.candidate.articleNumberNormalized ?? null,
    law_family: entry.law_family,
    norm_role: entry.norm_role,
    applicability_score: entry.applicability_score,
    primary_basis_eligibility: entry.primary_basis_eligibility,
    primary_basis_eligibility_reason: entry.primary_basis_eligibility_reason,
    ineligible_primary_basis_reasons: entry.ineligible_primary_basis_reasons,
    weak_primary_basis_reasons: entry.weak_primary_basis_reasons,
    matched_anchors: entry.matched_anchors,
    matched_required_law_family: entry.matched_required_law_family,
    matched_preferred_norm_role: entry.matched_preferred_norm_role,
    off_topic: entry.off_topic,
    penalties: entry.penalties,
    specificity_rank: entry.specificity_rank,
    specificity_reasons: entry.specificity_reasons,
    specificity_penalties: entry.specificity_penalties,
    source_channel:
      typeof entry.source_channel === "string" || entry.source_channel === null
        ? entry.source_channel
        : null,
    citation_resolution_status:
      typeof entry.citation_resolution_status === "string" ||
      entry.citation_resolution_status === null
        ? entry.citation_resolution_status
        : null,
  })) satisfies LegalCandidateDiagnostic[];

  const selectedDiagnostics = candidateDiagnostics.filter((entry) =>
    input.selection.selected_norm_roles.some(
      (selected) =>
        selected.law_id === entry.law_id &&
        selected.law_version === entry.law_version &&
        selected.law_block_id === entry.law_block_id,
    ),
  );
  const selectedLawFamilies = Array.from(new Set(selectedDiagnostics.map((entry) => entry.law_family)));
  const primaryBasisKeys = new Set(
    input.selection.primary_basis_norms.map(
      (candidate) => `${candidate.lawId}:${candidate.lawVersionId}:${candidate.lawBlockId}`,
    ),
  );
  const primaryDiagnostics = selectedDiagnostics.filter((entry) =>
    primaryBasisKeys.has(`${entry.law_id}:${entry.law_version}:${entry.law_block_id}`),
  );
  const selectedPrimarySpecificityRanks = primaryDiagnostics.map((entry) => entry.specificity_rank);
  const flags = new Set<LegalGroundingFlag>();

  if (input.selection.primary_basis_norms.length === 0) {
    flags.add("missing_primary_basis_norm");
  }

  if (input.selection.direct_basis_status !== "direct_basis_present") {
    flags.add("weak_direct_basis");
  }

  if (selectedDiagnostics.some((entry) => entry.off_topic)) {
    flags.add("off_topic_context_norm");
  }

  if (
    input.plan.required_law_families.length > 0 &&
    selectedLawFamilies.length > 0 &&
    !selectedLawFamilies.some((family) =>
      input.plan.required_law_families.includes(family as (typeof input.plan.required_law_families)[number]),
    )
  ) {
    flags.add("law_family_mismatch");
  }

  if (primaryDiagnostics.some((entry) => entry.norm_role === "sanction")) {
    flags.add("sanction_used_as_primary");
  }

  if (primaryDiagnostics.some((entry) => entry.norm_role === "procedure")) {
    flags.add("procedure_used_as_primary");
  }

  if (primaryDiagnostics.some((entry) => entry.norm_role === "exception")) {
    flags.add("exception_used_as_primary");
  }

  if (
    primaryDiagnostics.some((entry) =>
      entry.specificity_penalties.some((penalty) => penalty.includes("missing_explicit_scope_marker")),
    )
  ) {
    flags.add("specific_law_used_without_scope");
  }

  if (
    primaryDiagnostics.some((entry) =>
      entry.specificity_penalties.some((penalty) => penalty.includes("family_not_preferred_for_active_profile")),
    )
  ) {
    flags.add("wrong_source_family");
  }

  if (primaryDiagnostics.some((entry) => entry.specificity_penalties.length > 0)) {
    flags.add("wrong_primary_basis");
  }

  const highestSpecificityCandidate = candidateDiagnostics.reduce<LegalCandidateDiagnostic | null>(
    (currentHighest, candidate) => {
      if (!currentHighest || candidate.specificity_rank > currentHighest.specificity_rank) {
        return candidate;
      }

      return currentHighest;
    },
    null,
  );
  const strongestPrimarySpecificity = Math.max(...selectedPrimarySpecificityRanks, Number.NEGATIVE_INFINITY);

  if (
    highestSpecificityCandidate &&
    primaryDiagnostics.length > 0 &&
    highestSpecificityCandidate.specificity_rank > strongestPrimarySpecificity &&
    highestSpecificityCandidate.specificity_reasons.some((reason) =>
      reason.includes("primary_preferred_family"),
    ) &&
    primaryDiagnostics.some((entry) =>
      entry.specificity_penalties.some((penalty) => penalty.includes("family_not_preferred_for_active_profile")),
    )
  ) {
    flags.add("general_law_used_instead_of_specific_law");
  }

  return {
    candidate_diagnostics: candidateDiagnostics,
    grounding_diagnostics: {
      flags: Array.from(flags),
      direct_basis_status: input.selection.direct_basis_status,
      selected_norm_count: input.selection.selected_norms.length,
      primary_basis_norm_count: input.selection.primary_basis_norms.length,
      selected_law_families: selectedLawFamilies,
      legal_issue_type: input.plan.primaryLegalIssueType,
      legal_issue_secondary_types: input.plan.secondaryLegalIssueTypes,
      legal_issue_confidence: input.plan.legalIssueConfidence,
      selected_primary_specificity_ranks: selectedPrimarySpecificityRanks,
    },
  } satisfies LegalGroundingDiagnostics;
}
