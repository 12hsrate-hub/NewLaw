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
    },
  } satisfies LegalGroundingDiagnostics;
}
