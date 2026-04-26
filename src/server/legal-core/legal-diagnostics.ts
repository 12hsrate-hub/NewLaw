import type { LegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import { LEGAL_SOURCE_SPECIFICITY_PROFILES } from "@/server/legal-core/legal-semantic-dictionaries";
import type {
  LegalSelectionCandidate,
  StructuredSelectionResult,
} from "@/server/legal-core/legal-selection";

export const legalGroundingFlags = [
  "missing_primary_basis_norm",
  "law_family_mismatch",
  "weak_direct_basis",
  "off_topic_context_norm",
  "citation_unresolved_no_primary_basis",
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
    specificity_warning_reasons?: string[];
  };
};

type SourceSpecificityProfileKey = Exclude<
  keyof typeof LEGAL_SOURCE_SPECIFICITY_PROFILES,
  "explicit_citation"
>;

function getActiveSpecificityProfiles(plan: LegalQueryPlan) {
  const profiles: SourceSpecificityProfileKey[] = [];
  const rightIssue = plan.primaryLegalIssueType === "right_question";

  if (plan.legal_anchors.includes("attorney_request")) {
    profiles.push("attorney_request");
  }

  if (plan.legal_anchors.includes("video_recording") || plan.legal_anchors.includes("evidence")) {
    profiles.push("video_recording");
  }

  if (plan.legal_anchors.includes("attorney_rights") && rightIssue) {
    profiles.push("attorney_rights");
  }

  if (plan.legal_anchors.includes("detention_procedure") && !rightIssue) {
    profiles.push("detention_procedure");
  }

  return profiles;
}

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
  const orderedSelectedDiagnostics = input.selection.selected_norm_roles.reduce<LegalCandidateDiagnostic[]>(
    (accumulator, selected) => {
      const matchingDiagnostic = selectedDiagnostics.find(
        (entry) =>
          entry.law_id === selected.law_id &&
          entry.law_version === selected.law_version &&
          entry.law_block_id === selected.law_block_id,
      );

      if (matchingDiagnostic) {
        accumulator.push(matchingDiagnostic);
      }

      return accumulator;
    },
    [],
  );
  const selectedLawFamilies = Array.from(new Set(selectedDiagnostics.map((entry) => entry.law_family)));
  const primaryBasisKeys = new Set(
    input.selection.primary_basis_norms.map(
      (candidate) => `${candidate.lawId}:${candidate.lawVersionId}:${candidate.lawBlockId}`,
    ),
  );
  const primaryDiagnostics = orderedSelectedDiagnostics.filter((entry) =>
    primaryBasisKeys.has(`${entry.law_id}:${entry.law_version}:${entry.law_block_id}`),
  );
  const effectiveBasisDiagnostics =
    primaryDiagnostics.length > 0
      ? primaryDiagnostics
      : orderedSelectedDiagnostics.filter((entry) =>
          ["primary_basis", "right_or_guarantee", "procedure", "exception", "sanction"].includes(
            entry.norm_role,
          ),
        );
  const selectedPrimarySpecificityRanks = primaryDiagnostics.map((entry) => entry.specificity_rank);
  const specificityWarningReasons = new Set<string>();
  const flags = new Set<LegalGroundingFlag>();
  const citationIssue =
    input.plan.primaryLegalIssueType === "citation_explanation" ||
    input.plan.primaryLegalIssueType === "citation_application";
  const hasResolvedCitationTarget = candidateDiagnostics.some(
    (entry) =>
      entry.source_channel === "citation_target" &&
      (entry.citation_resolution_status === "resolved" ||
        entry.citation_resolution_status === "partially_supported"),
  );

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

  if (effectiveBasisDiagnostics.some((entry) => entry.norm_role === "sanction")) {
    flags.add("sanction_used_as_primary");
    specificityWarningReasons.add("sanction_without_primary_rule");
  }

  if (effectiveBasisDiagnostics.some((entry) => entry.norm_role === "procedure")) {
    flags.add("procedure_used_as_primary");
    specificityWarningReasons.add("procedure_without_issue_alignment");
  }

  if (effectiveBasisDiagnostics.some((entry) => entry.norm_role === "exception")) {
    flags.add("exception_used_as_primary");
    specificityWarningReasons.add("exception_without_primary_rule");
  }

  if (
    effectiveBasisDiagnostics.some((entry) =>
      entry.specificity_penalties.some(
        (penalty) =>
          penalty.includes("missing_explicit_scope_marker") ||
          penalty === "scoped_family_without_explicit_scope",
      ),
    )
  ) {
    flags.add("specific_law_used_without_scope");
    specificityWarningReasons.add("scoped_family_without_explicit_scope");
  }

  if (
    effectiveBasisDiagnostics.some((entry) =>
      entry.specificity_penalties.some(
        (penalty) =>
          penalty.includes("family_not_preferred_for_active_profile") ||
          penalty === "selected_family_not_preferred" ||
          penalty === "scoped_family_without_explicit_scope",
      ),
    )
  ) {
    flags.add("wrong_source_family");
    specificityWarningReasons.add("selected_family_not_preferred");
  }

  if (
    effectiveBasisDiagnostics.some(
      (entry) => entry.specificity_rank <= 0 || entry.specificity_penalties.length > 0,
    )
  ) {
    flags.add("wrong_primary_basis");
    specificityWarningReasons.add("selected_role_not_primary_suitable");
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
  const strongestPrimarySpecificity = Math.max(
    ...effectiveBasisDiagnostics.map((entry) => entry.specificity_rank),
    Number.NEGATIVE_INFINITY,
  );

  for (const profileKey of getActiveSpecificityProfiles(input.plan)) {
    const profile = LEGAL_SOURCE_SPECIFICITY_PROFILES[profileKey];
    const selectedHasPreferredFamily = selectedDiagnostics.some((entry) =>
      (profile.primaryPreferredFamilies as readonly string[]).includes(entry.law_family),
    );

    if (!selectedHasPreferredFamily && profile.primaryPreferredFamilies.length > 0) {
      specificityWarningReasons.add("missing_preferred_family_for_profile");
      flags.add("wrong_source_family");
    }
  }

  if (
    highestSpecificityCandidate &&
    effectiveBasisDiagnostics.length > 0 &&
    highestSpecificityCandidate.specificity_rank > strongestPrimarySpecificity &&
    highestSpecificityCandidate.specificity_reasons.some((reason) =>
      reason.includes("primary_preferred_family"),
    ) &&
    effectiveBasisDiagnostics.some((entry) =>
      entry.specificity_penalties.some((penalty) => penalty.includes("family_not_preferred_for_active_profile")),
    )
  ) {
    flags.add("general_law_used_instead_of_specific_law");
    specificityWarningReasons.add("missing_preferred_family_for_profile");
  }

  if (
    citationIssue &&
    input.plan.explicitLegalCitations.length > 0 &&
    !hasResolvedCitationTarget &&
    input.selection.primary_basis_norms.length === 0
  ) {
    flags.add("citation_unresolved_no_primary_basis");
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
      specificity_warning_reasons: Array.from(specificityWarningReasons),
    },
  } satisfies LegalGroundingDiagnostics;
}
