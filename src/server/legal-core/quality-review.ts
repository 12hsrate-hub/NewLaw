import { createHash } from "node:crypto";
import { z } from "zod";

import { getAIQualityReviewUsageSince } from "@/db/repositories/ai-request.repository";
import { getAIQualityReviewRuntimeEnv } from "@/schemas/env";
import { requestAssistantProxyCompletion } from "@/server/legal-assistant/ai-proxy";
import type {
  AILegalCoreScenarioExpectationProfile,
  AILegalCoreScenarioExpectedCompanionTarget,
} from "@/server/legal-core/test-scenarios-registry";
import type {
  LegalCoreAnswerConfidence,
  LegalCoreRiskLevel,
} from "@/server/legal-core/metadata";
import { extractProxyUsageMetrics } from "@/server/legal-core/observability";

export const AI_QUALITY_REVIEW_VERSION = "ai_quality_review_v1";
export const AI_QUALITY_REVIEWER_PROMPT_VERSION = "ai_quality_reviewer_v1";
export const AI_QUALITY_REVIEWER_MODEL = "gpt-5.4-mini";
export type AIQualityReviewMode = "off" | "log_only" | "full";

async function getAIQualityReviewUsageSinceSafe(input: { since: Date }) {
  if (!(process.env.DATABASE_URL?.trim() && process.env.DIRECT_URL?.trim())) {
    return {
      reviewerAttemptCount: 0,
      reviewerCostUsd: 0,
    };
  }

  try {
    return await getAIQualityReviewUsageSince(input);
  } catch {
    return {
      reviewerAttemptCount: 0,
      reviewerCostUsd: 0,
    };
  }
}

type ReviewRootCause =
  | "normalization_issue"
  | "law_basis_issue"
  | "availability_issue"
  | "input_quality_issue"
  | "generation_issue";

type ReviewFixTarget =
  | "normalization_prompt"
  | "normalization_model"
  | "normalization_guardrail"
  | null;

type SelfRiskSignals = {
  queue_for_future_ai_quality_review: boolean;
  future_review_priority: LegalCoreRiskLevel;
  future_review_flags: string[];
  future_review_reason_codes: string[];
};

type ReviewFlagSeverity = "pass" | "warn" | "fail";

export type DeterministicLawBasisReviewFlagCode =
  | "missing_primary_basis_norm"
  | "law_family_mismatch"
  | "weak_direct_basis"
  | "sanction_or_exception_used_as_primary"
  | "missing_required_companion_context"
  | "unresolved_explicit_citation_used_as_basis";

export type DeterministicLawBasisReviewFlag = {
  code: DeterministicLawBasisReviewFlagCode;
  severity: ReviewFlagSeverity;
  short_reason: string;
  evidence: Record<string, unknown>;
};

export type DeterministicLawBasisReviewResult = {
  overall_status: ReviewFlagSeverity;
  flags: DeterministicLawBasisReviewFlag[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
};

export type DeterministicLawBasisReviewContext = {
  expectationProfile?: AILegalCoreScenarioExpectationProfile | null;
  expectedLawFamilies?: string[] | null;
};

type NormalizationReview = {
  raw_input: string | null;
  normalized_input: string | null;
  normalization_model: string | null;
  normalization_prompt_version: string | null;
  normalization_changed: boolean;
  comparison_result: "unchanged" | "surface_cleanup" | "meaning_risk";
  changed_ratio: number | null;
  result_summary: string;
};

const aiReviewerOutputSchema = z.object({
  quality_score: z.number().int().min(0).max(100),
  risk_level: z.enum(["low", "medium", "high"]),
  confidence: z.enum(["low", "medium", "high"]),
  flags: z.array(z.string().trim().min(1)).max(10),
  review_items: z.array(z.string().trim().min(1)).max(10),
  root_cause: z.enum([
    "normalization_issue",
    "law_basis_issue",
    "availability_issue",
    "input_quality_issue",
    "generation_issue",
  ]),
  input_quality: z.enum(["low", "medium", "high"]),
});

type AIReviewerOutput = z.infer<typeof aiReviewerOutputSchema>;

type AIQualityReviewUsageSnapshot = {
  reviewer_attempt_count: number;
  reviewer_cost_usd: number;
};

type DeterministicAIQualityReviewSnapshot = {
  review_version: string;
  review_mode: "deterministic_bootstrap";
  controls: {
    enabled: boolean;
    mode: AIQualityReviewMode;
    daily_request_limit: number | null;
    daily_cost_limit_usd: number | null;
    usage_today: AIQualityReviewUsageSnapshot;
    request_limit_reached: boolean;
    cost_limit_reached: boolean;
    limits_status:
      | "no_limits_configured"
      | "enforced_available"
      | "daily_limit_reached";
  };
  queue_for_super_admin: boolean;
  quality_score: number;
  risk_level: LegalCoreRiskLevel;
  confidence: LegalCoreAnswerConfidence;
  flags: string[];
  review_items: string[];
  root_cause: ReviewRootCause;
  input_quality: LegalCoreRiskLevel;
  issue_fingerprint: string;
  issue_cluster_key: string;
  fix_target: ReviewFixTarget;
  layers: {
    deterministic_checks: {
      status: "completed";
      normalization_review: NormalizationReview;
      law_basis_review: DeterministicLawBasisReviewResult;
      checks: string[];
    };
    ai_reviewer:
      | {
          status: "not_run";
          reason:
            | "ai_review_mode_not_full"
            | "no_review_signal"
            | "daily_limit_reached";
        }
      | {
          status: "unavailable";
          reason: string;
          model: string;
          prompt_version: string;
          attempted_proxy_keys: string[];
          latency_ms: number;
        }
      | {
          status: "invalid_output";
          reason: string;
          model: string;
          prompt_version: string;
          attempted_proxy_keys: string[];
          latency_ms: number;
        }
      | {
          status: "completed";
          model: string;
          prompt_version: string;
          attempted_proxy_keys: string[];
          latency_ms: number;
          prompt_tokens: number | null;
          completion_tokens: number | null;
          total_tokens: number | null;
          cost_usd: number | null;
          output: AIReviewerOutput;
        };
    self_risk_signals: SelfRiskSignals;
  };
  case_chain: {
    raw_input: string | null;
    normalized_input: string | null;
    normalization_model: string | null;
    normalization_prompt_version: string | null;
    normalization_changed: boolean;
    normalization_comparison_result: NormalizationReview["comparison_result"];
    retrieved_sources: unknown[];
    final_output_preview: string | null;
  };
};

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readBoolean(source: Record<string, unknown>, key: string) {
  return source[key] === true;
}

function readStringArray(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function readUnknownArray(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return Array.isArray(value) ? value : [];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readStringArrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string")));
}

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAlphaNumericText(value: string) {
  return normalizeComparableText(value).replace(/[^\p{L}\p{N}\s]/gu, "");
}

function extractFactLikeTokens(value: string) {
  return Array.from(
    new Set(
      (value.match(/\b[\p{Lu}A-ZА-ЯЁ][\p{L}\p{N}_-]{1,}\b|\b\d[\d:./-]*\b/gu) ?? []).map((token) =>
        token.trim(),
      ),
    ),
  );
}

function extractLegalKeywords(value: string) {
  const keywords = [
    "стат",
    "закон",
    "норм",
    "доказатель",
    "жалоб",
    "иск",
    "ответчик",
    "истец",
    "правонаруш",
    "квалифиц",
    "может свидетельствовать",
  ];
  const normalized = normalizeComparableText(value);

  return keywords.filter((keyword) => normalized.includes(keyword));
}

function normalizeMarker(value: string | null | undefined) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().toLowerCase() : null;
}

function buildLawBasisFlag(input: DeterministicLawBasisReviewFlag) {
  return input;
}

function countEligiblePrimaryBasisNorms(input: {
  selectedNormRoles: Array<Record<string, unknown>>;
  primaryBasisEligibility: Array<Record<string, unknown>>;
}) {
  const primaryBasisEntries = input.selectedNormRoles.filter(
    (entry) => readStringValue(entry.norm_role) === "primary_basis",
  );

  if (input.primaryBasisEligibility.length === 0) {
    return primaryBasisEntries.length;
  }

  return primaryBasisEntries.filter((entry) =>
    input.primaryBasisEligibility.some(
      (eligibility) =>
        readStringValue(eligibility.law_id) === readStringValue(entry.law_id) &&
        readStringValue(eligibility.law_version) === readStringValue(entry.law_version) &&
        readStringValue(eligibility.law_block_id) === readStringValue(entry.law_block_id) &&
        readStringValue(eligibility.primary_basis_eligibility) === "eligible",
    ),
  ).length;
}

function matchesCompanionTarget(
  target: AILegalCoreScenarioExpectedCompanionTarget,
  candidate: {
    law_family: string | null;
    article_number: string | null;
    marker: string | null;
    part_number: string | null;
    relation_type: string | null;
  },
) {
  if (candidate.relation_type !== target.relationType) {
    return false;
  }

  if (target.lawFamily && target.lawFamily !== candidate.law_family) {
    return false;
  }

  if (target.articleNumber && target.articleNumber !== candidate.article_number) {
    return false;
  }

  if (target.partNumber && target.partNumber !== candidate.part_number) {
    return false;
  }

  if (target.marker) {
    return normalizeMarker(target.marker) === candidate.marker;
  }

  return true;
}

function buildCompanionCoverage(input: {
  requestPayloadJson: Record<string, unknown>;
  responsePayloadJson: Record<string, unknown>;
}) {
  const selectedCandidateDiagnostics = readUnknownArray(input.requestPayloadJson, "selected_candidate_diagnostics")
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const lawFamilyById = new Map<string, string | null>();
  const articleNumberById = new Map<string, string | null>();

  for (const entry of selectedCandidateDiagnostics) {
    const lawId = readStringValue(entry.law_id);

    if (!lawId) {
      continue;
    }

    lawFamilyById.set(lawId, readStringValue(entry.law_family));
    articleNumberById.set(lawId, readStringValue(entry.article_number));
  }

  const includedSegments = readUnknownArray(input.requestPayloadJson, "included_article_segments")
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => {
      const lawId = readStringValue(entry.law_id);

      return {
        law_id: lawId,
        law_family: lawId ? (lawFamilyById.get(lawId) ?? null) : null,
        article_number: lawId ? (articleNumberById.get(lawId) ?? null) : null,
        marker: normalizeMarker(readStringValue(entry.marker)),
        part_number: readStringValue(entry.part_number),
        relation_type: readStringValue(entry.relation_type),
        reason_code: readStringValue(entry.reason_code),
      };
    });
  const projectionExcluded = readUnknownArray(input.requestPayloadJson, "bundle_projection_excluded_items").flatMap(
    (entry) => {
      const safeEntry = readRecord(entry);
      const lawId = readStringValue(safeEntry?.law_id);
      const lawFamily = lawId ? (lawFamilyById.get(lawId) ?? null) : null;
      const articleNumber = lawId ? (articleNumberById.get(lawId) ?? null) : null;

      return readUnknownArray(safeEntry ?? {}, "items")
        .map((item) => readRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          law_id: lawId,
          law_family: lawFamily,
          article_number: articleNumber,
          marker: normalizeMarker(readStringValue(item.marker)),
          part_number: readStringValue(item.part_number),
          relation_type: readStringValue(item.relation_type),
          reason_code: readStringValue(item.reason_code),
        }));
    },
  );
  const relationTypes = uniqueStrings([
    ...readUnknownArray(input.requestPayloadJson, "companion_relation_types").flatMap((entry) => {
      const safeEntry = readRecord(entry);
      return readStringArrayValue(safeEntry?.relation_types);
    }),
    ...includedSegments.map((entry) => entry.relation_type),
    ...projectionExcluded
      .filter((entry) => entry.reason_code === "duplicate_of_primary_excerpt")
      .map((entry) => entry.relation_type),
  ]);

  return {
    includedSegments,
    projectionExcluded,
    relationTypes,
    missingExpectedCompanion: readStringArrayValue(
      input.requestPayloadJson.missing_expected_companion,
    ),
  };
}

function deriveLawBasisReviewRiskLevel(result: DeterministicLawBasisReviewResult): LegalCoreRiskLevel {
  if (result.summary.fail > 0) {
    return "high";
  }

  if (result.summary.warn > 0) {
    return "medium";
  }

  return "low";
}

export function buildDeterministicLawBasisReviewResult(input: {
  requestPayloadJson?: Record<string, unknown> | null;
  responsePayloadJson?: Record<string, unknown> | null;
  reviewContext?: DeterministicLawBasisReviewContext | null;
}): DeterministicLawBasisReviewResult {
  const requestPayloadJson = input.requestPayloadJson ?? {};
  const responsePayloadJson = input.responsePayloadJson ?? {};
  const reviewContext = input.reviewContext ?? null;
  const selectedNormRoles = readUnknownArray(requestPayloadJson, "selected_norm_roles")
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const primaryBasisEligibility = readUnknownArray(requestPayloadJson, "primary_basis_eligibility")
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const selectedCandidateDiagnostics = readUnknownArray(requestPayloadJson, "selected_candidate_diagnostics")
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const directBasisStatus = readString(requestPayloadJson, "direct_basis_status");
  const selectedLawFamilies = uniqueStrings(
    selectedNormRoles.map((entry) => readStringValue(entry.law_family)),
  );
  const eligiblePrimaryBasisNormCount = countEligiblePrimaryBasisNorms({
    selectedNormRoles,
    primaryBasisEligibility,
  });
  const primaryBasisEntries = selectedNormRoles.filter(
    (entry) => readStringValue(entry.norm_role) === "primary_basis",
  );
  const primaryLawFamilies = uniqueStrings(
    primaryBasisEntries.map((entry) => readStringValue(entry.law_family)),
  );
  const expectedLawFamilies = uniqueStrings([
    ...(reviewContext?.expectedLawFamilies ?? []),
    ...((reviewContext?.expectationProfile?.requiredLawFamilies as string[] | undefined) ?? []),
    ...readUnknownArray(requestPayloadJson, "citation_resolution")
      .map((entry) => readRecord(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .filter((entry) => readStringValue(entry.resolution_status) === "resolved")
      .map((entry) => readStringValue(entry.law_family)),
  ]);
  const companionCoverage = buildCompanionCoverage({
    requestPayloadJson,
    responsePayloadJson,
  });
  const citations = readUnknownArray(requestPayloadJson, "citation_resolution")
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const unresolvedExplicitCitationCount =
    typeof requestPayloadJson.citation_unresolved_count === "number"
      ? requestPayloadJson.citation_unresolved_count
      : citations.filter((entry) => readStringValue(entry.resolution_status) === "unresolved").length;
  const hasCitationDrivenPrimary = selectedCandidateDiagnostics.some(
    (entry) =>
      readStringValue(entry.norm_role) === "primary_basis" &&
      readStringValue(entry.source_channel) === "citation_target" &&
      readStringValue(entry.citation_resolution_status) === "unresolved",
  );
  const sanctionOrExceptionReasons = primaryBasisEligibility.filter((entry) => {
    const reason = readStringValue(entry.primary_basis_eligibility_reason);
    return (
      reason === "ineligible_due_to_sanction_only" ||
      reason === "ineligible_due_to_exception_without_base"
    );
  });
  const sanctionOrExceptionWithoutBase =
    eligiblePrimaryBasisNormCount === 0 &&
    selectedNormRoles.some((entry) => {
      const role = readStringValue(entry.norm_role);
      return role === "sanction" || role === "exception";
    });
  const expectationProfile = reviewContext?.expectationProfile ?? null;
  const companionChecksActive = expectationProfile?.activateCompanionChecks === true;
  const requiredCompanionRelations = companionChecksActive
    ? expectationProfile?.requiredCompanionRelations ?? []
    : [];
  const requiredCompanionTargets = companionChecksActive
    ? expectationProfile?.requiredCompanionTargets ?? []
    : [];

  const missingPrimaryBasisFlag = (() => {
    if (directBasisStatus === "direct_basis_present" && eligiblePrimaryBasisNormCount > 0) {
      return buildLawBasisFlag({
        code: "missing_primary_basis_norm",
        severity: "pass",
        short_reason: "Eligible primary basis присутствует.",
        evidence: {
          direct_basis_status: directBasisStatus,
          eligible_primary_basis_norm_count: eligiblePrimaryBasisNormCount,
        },
      });
    }

    if (directBasisStatus === "partial_basis_only") {
      return buildLawBasisFlag({
        code: "missing_primary_basis_norm",
        severity: "warn",
        short_reason: "Контекст собран только как partial basis.",
        evidence: {
          direct_basis_status: directBasisStatus,
          eligible_primary_basis_norm_count: eligiblePrimaryBasisNormCount,
        },
      });
    }

    if (
      expectationProfile?.expectedDirectBasisStatus === "direct_basis_present" &&
      eligiblePrimaryBasisNormCount === 0
    ) {
      return buildLawBasisFlag({
        code: "missing_primary_basis_norm",
        severity: "fail",
        short_reason: "Ожидалась прямая база, но eligible primary basis отсутствует.",
        evidence: {
          direct_basis_status: directBasisStatus,
          expected_direct_basis_status: expectationProfile.expectedDirectBasisStatus,
          eligible_primary_basis_norm_count: eligiblePrimaryBasisNormCount,
        },
      });
    }

    return buildLawBasisFlag({
      code: "missing_primary_basis_norm",
      severity: eligiblePrimaryBasisNormCount > 0 ? "pass" : "warn",
      short_reason:
        eligiblePrimaryBasisNormCount > 0
          ? "Primary basis candidate присутствует."
          : "Прямая primary basis норма не подтверждена для этого контекста.",
      evidence: {
        direct_basis_status: directBasisStatus,
        eligible_primary_basis_norm_count: eligiblePrimaryBasisNormCount,
      },
    });
  })();

  const lawFamilyMismatchFlag = (() => {
    if (expectedLawFamilies.length === 0) {
      return buildLawBasisFlag({
        code: "law_family_mismatch",
        severity: "pass",
        short_reason: "Явного expected law family constraint нет.",
        evidence: {
          selected_law_families: selectedLawFamilies,
        },
      });
    }

    const primaryMatches = primaryLawFamilies.some((family) => expectedLawFamilies.includes(family));

    if (!primaryMatches) {
      return buildLawBasisFlag({
        code: "law_family_mismatch",
        severity: "fail",
        short_reason: "Primary law family конфликтует с expected family constraint.",
        evidence: {
          expected_law_families: expectedLawFamilies,
          primary_law_families: primaryLawFamilies,
          selected_law_families: selectedLawFamilies,
        },
      });
    }

    const offFamilyNoise = selectedLawFamilies.filter((family) => !expectedLawFamilies.includes(family));

    if (offFamilyNoise.length > 0) {
      return buildLawBasisFlag({
        code: "law_family_mismatch",
        severity: "warn",
        short_reason: "В selected context есть off-family noise при корректной primary family.",
        evidence: {
          expected_law_families: expectedLawFamilies,
          primary_law_families: primaryLawFamilies,
          off_family_noise: offFamilyNoise,
        },
      });
    }

    return buildLawBasisFlag({
      code: "law_family_mismatch",
      severity: "pass",
      short_reason: "Law family соответствует expected constraint.",
      evidence: {
        expected_law_families: expectedLawFamilies,
        primary_law_families: primaryLawFamilies,
      },
    });
  })();

  const weakDirectBasisFlag = (() => {
    if (directBasisStatus === "direct_basis_present") {
      return buildLawBasisFlag({
        code: "weak_direct_basis",
        severity: "pass",
        short_reason: "Direct basis присутствует.",
        evidence: {
          direct_basis_status: directBasisStatus,
        },
      });
    }

    if (
      directBasisStatus === "no_direct_basis" &&
      expectationProfile?.expectedDirectBasisStatus === "direct_basis_present"
    ) {
      return buildLawBasisFlag({
        code: "weak_direct_basis",
        severity: "fail",
        short_reason: "Ожидалась прямая база, но context остался без direct basis.",
        evidence: {
          direct_basis_status: directBasisStatus,
          expected_direct_basis_status: expectationProfile.expectedDirectBasisStatus,
        },
      });
    }

    if (directBasisStatus === "partial_basis_only" || directBasisStatus === "no_direct_basis") {
      return buildLawBasisFlag({
        code: "weak_direct_basis",
        severity: "warn",
        short_reason:
          directBasisStatus === "partial_basis_only"
            ? "Контекст собран только как partial basis."
            : "Контекст остался без direct basis.",
        evidence: {
          direct_basis_status: directBasisStatus,
        },
      });
    }

    return buildLawBasisFlag({
      code: "weak_direct_basis",
      severity: "pass",
      short_reason: "Direct basis status не указывает на ослабленную базу.",
      evidence: {
        direct_basis_status: directBasisStatus,
      },
    });
  })();

  const sanctionOrExceptionUsedAsPrimaryFlag = (() => {
    if (sanctionOrExceptionReasons.length > 0 || sanctionOrExceptionWithoutBase) {
      return buildLawBasisFlag({
        code: "sanction_or_exception_used_as_primary",
        severity: "fail",
        short_reason: "Sanction/exception норма пытается выступать как primary basis.",
        evidence: {
          primary_basis_eligibility: sanctionOrExceptionReasons.map((entry) => ({
            law_id: readStringValue(entry.law_id),
            primary_basis_eligibility_reason: readStringValue(entry.primary_basis_eligibility_reason),
          })),
          eligible_primary_basis_norm_count: eligiblePrimaryBasisNormCount,
          selected_norm_roles: selectedNormRoles.map((entry) => ({
            law_id: readStringValue(entry.law_id),
            law_family: readStringValue(entry.law_family),
            norm_role: readStringValue(entry.norm_role),
          })),
        },
      });
    }

    const dominantCompanionNoise =
      eligiblePrimaryBasisNormCount > 0 &&
      (companionCoverage.relationTypes.includes("sanction_companion") ||
        companionCoverage.relationTypes.includes("exception")) &&
      primaryLawFamilies.length === 0;

    if (dominantCompanionNoise) {
      return buildLawBasisFlag({
        code: "sanction_or_exception_used_as_primary",
        severity: "warn",
        short_reason: "Sanction/exception companion доминирует сильнее, чем ожидается для base rule.",
        evidence: {
          companion_relation_types: companionCoverage.relationTypes,
          eligible_primary_basis_norm_count: eligiblePrimaryBasisNormCount,
        },
      });
    }

    return buildLawBasisFlag({
      code: "sanction_or_exception_used_as_primary",
      severity: "pass",
      short_reason: "Sanction/exception остаются companion или secondary context.",
      evidence: {
        companion_relation_types: companionCoverage.relationTypes,
        eligible_primary_basis_norm_count: eligiblePrimaryBasisNormCount,
      },
    });
  })();

  const missingRequiredCompanionContextFlag = (() => {
    if (!companionChecksActive) {
      return buildLawBasisFlag({
        code: "missing_required_companion_context",
        severity: "pass",
        short_reason: "Companion checks не активированы для этого review context.",
        evidence: {
          activate_companion_checks: false,
        },
      });
    }

    const missingRelations = requiredCompanionRelations.filter(
      (relation) => !companionCoverage.relationTypes.includes(relation),
    );
    const duplicateCoveredRelations = requiredCompanionRelations.filter((relation) =>
      companionCoverage.projectionExcluded.some(
        (entry) =>
          entry.reason_code === "duplicate_of_primary_excerpt" && entry.relation_type === relation,
      ),
    );
    const duplicateCoveredTargets = requiredCompanionTargets.filter((target) =>
      companionCoverage.projectionExcluded.some(
        (entry) =>
          entry.reason_code === "duplicate_of_primary_excerpt" &&
          matchesCompanionTarget(target, entry),
      ),
    );
    const missingTargets = requiredCompanionTargets.filter((target) => {
      const included = companionCoverage.includedSegments.some((entry) =>
        matchesCompanionTarget(target, entry),
      );
      const duplicateCovered = companionCoverage.projectionExcluded.some(
        (entry) =>
          entry.reason_code === "duplicate_of_primary_excerpt" &&
          matchesCompanionTarget(target, entry),
      );

      return !included && !duplicateCovered;
    });

    if (missingRelations.length > 0 || missingTargets.length > 0) {
      return buildLawBasisFlag({
        code: "missing_required_companion_context",
        severity: "fail",
        short_reason: "Не хватает обязательного companion context для activated scenario.",
        evidence: {
          required_companion_relations: requiredCompanionRelations,
          missing_companion_relations: missingRelations,
          required_companion_targets: requiredCompanionTargets,
          missing_companion_targets: missingTargets.map((target) => ({
            relation_type: target.relationType,
            law_family: target.lawFamily ?? null,
            article_number: target.articleNumber ?? null,
            part_number: target.partNumber ?? null,
            marker: target.marker ?? null,
          })),
          missing_expected_companion: companionCoverage.missingExpectedCompanion,
        },
      });
    }

    if (duplicateCoveredRelations.length > 0 || duplicateCoveredTargets.length > 0) {
      return buildLawBasisFlag({
        code: "missing_required_companion_context",
        severity: "warn",
        short_reason: "Часть required companion context покрыта только через duplicate_of_primary_excerpt.",
        evidence: {
          duplicate_covered_relations: duplicateCoveredRelations,
          duplicate_covered_targets: duplicateCoveredTargets.map((target) => ({
            relation_type: target.relationType,
            law_family: target.lawFamily ?? null,
            article_number: target.articleNumber ?? null,
            part_number: target.partNumber ?? null,
            marker: target.marker ?? null,
          })),
        },
      });
    }

    return buildLawBasisFlag({
      code: "missing_required_companion_context",
      severity: "pass",
      short_reason: "Required companion context присутствует.",
      evidence: {
        required_companion_relations: requiredCompanionRelations,
        required_companion_targets: requiredCompanionTargets,
      },
    });
  })();

  const unresolvedExplicitCitationFlag = (() => {
    if (citations.length === 0) {
      return buildLawBasisFlag({
        code: "unresolved_explicit_citation_used_as_basis",
        severity: "pass",
        short_reason: "Explicit citation diagnostics отсутствуют.",
        evidence: {
          citation_count: 0,
        },
      });
    }

    if (unresolvedExplicitCitationCount > 0 && (hasCitationDrivenPrimary || directBasisStatus === "direct_basis_present")) {
      return buildLawBasisFlag({
        code: "unresolved_explicit_citation_used_as_basis",
        severity: hasCitationDrivenPrimary ? "fail" : "warn",
        short_reason:
          hasCitationDrivenPrimary
            ? "Unresolved explicit citation не должна создавать fake citation-target basis."
            : "Unresolved explicit citation обработана, но direct basis остался сильным и требует ручной проверки.",
        evidence: {
          citation_unresolved_count: unresolvedExplicitCitationCount,
          selected_candidate_diagnostics: selectedCandidateDiagnostics.map((entry) => ({
            law_id: readStringValue(entry.law_id),
            norm_role: readStringValue(entry.norm_role),
            source_channel: readStringValue(entry.source_channel),
            citation_resolution_status: readStringValue(entry.citation_resolution_status),
          })),
          direct_basis_status: directBasisStatus,
        },
      });
    }

    if (unresolvedExplicitCitationCount > 0) {
      return buildLawBasisFlag({
        code: "unresolved_explicit_citation_used_as_basis",
        severity: "warn",
        short_reason: "Explicit citation unresolved, но fake primary basis не сформировалась.",
        evidence: {
          citation_unresolved_count: unresolvedExplicitCitationCount,
          direct_basis_status: directBasisStatus,
        },
      });
    }

    return buildLawBasisFlag({
      code: "unresolved_explicit_citation_used_as_basis",
      severity: "pass",
      short_reason: "Explicit citation либо resolved, либо не влияет на basis.",
      evidence: {
        citation_unresolved_count: unresolvedExplicitCitationCount,
      },
    });
  })();

  const flags = [
    missingPrimaryBasisFlag,
    lawFamilyMismatchFlag,
    weakDirectBasisFlag,
    sanctionOrExceptionUsedAsPrimaryFlag,
    missingRequiredCompanionContextFlag,
    unresolvedExplicitCitationFlag,
  ];
  const summary = {
    pass: flags.filter((flag) => flag.severity === "pass").length,
    warn: flags.filter((flag) => flag.severity === "warn").length,
    fail: flags.filter((flag) => flag.severity === "fail").length,
  };

  return {
    overall_status: summary.fail > 0 ? "fail" : summary.warn > 0 ? "warn" : "pass",
    flags,
    summary,
  };
}

function buildNormalizationReview(input: {
  requestPayloadJson: Record<string, unknown>;
}) {
  const rawInput = readString(input.requestPayloadJson, "raw_input");
  const normalizedInput = readString(input.requestPayloadJson, "normalized_input");
  const normalizationChanged = readBoolean(input.requestPayloadJson, "normalization_changed");
  const normalizationModel = readString(input.requestPayloadJson, "normalization_model");
  const normalizationPromptVersion = readString(
    input.requestPayloadJson,
    "normalization_prompt_version",
  );

  if (!rawInput || !normalizedInput) {
    return {
      review: {
        raw_input: rawInput,
        normalized_input: normalizedInput,
        normalization_model: normalizationModel,
        normalization_prompt_version: normalizationPromptVersion,
        normalization_changed: normalizationChanged,
        comparison_result: "unchanged" as const,
        changed_ratio: null,
        result_summary: "Слой нормализации не дал достаточно данных для сравнения.",
      },
      flags: [] as string[],
      reviewItems: ["Нормализация не содержит полного raw/normalized pair для проверки."],
    };
  }

  const changedRatio =
    rawInput.length > 0 ? Math.abs(normalizedInput.length - rawInput.length) / rawInput.length : 0;
  const rawFacts = extractFactLikeTokens(rawInput);
  const normalizedFacts = extractFactLikeTokens(normalizedInput);
  const addedFacts = normalizedFacts.filter((token) => !rawFacts.includes(token));
  const removedFacts = rawFacts.filter((token) => !normalizedFacts.includes(token));
  const rawLegalKeywords = extractLegalKeywords(rawInput);
  const normalizedLegalKeywords = extractLegalKeywords(normalizedInput);
  const introducedLegalKeywords = normalizedLegalKeywords.filter(
    (keyword) => !rawLegalKeywords.includes(keyword),
  );
  const alphaNormalizedRaw = normalizeAlphaNumericText(rawInput);
  const alphaNormalizedInput = normalizeAlphaNumericText(normalizedInput);
  const surfaceCleanup = alphaNormalizedRaw === alphaNormalizedInput;

  const flags: string[] = [];
  const reviewItems: string[] = [];

  if (normalizationChanged && addedFacts.length > 0) {
    flags.push("normalization_added_fact");
    reviewItems.push(`Нормализация добавила fact-like tokens: ${addedFacts.join(", ")}.`);
  }

  if (normalizationChanged && removedFacts.length > 0) {
    flags.push("normalization_removed_fact");
    reviewItems.push(`Нормализация убрала fact-like tokens: ${removedFacts.join(", ")}.`);
  }

  if (normalizationChanged && introducedLegalKeywords.length > 0) {
    flags.push("normalization_overlegalized");
    reviewItems.push(
      `Нормализация добавила юридические маркеры: ${introducedLegalKeywords.join(", ")}.`,
    );
  }

  if (normalizationChanged && changedRatio >= 0.35 && !surfaceCleanup) {
    flags.push("normalization_too_aggressive");
    reviewItems.push("Нормализация слишком сильно переписала исходный ввод.");
  }

  if (
    flags.includes("normalization_added_fact") ||
    flags.includes("normalization_removed_fact") ||
    flags.includes("normalization_overlegalized")
  ) {
    flags.push("normalization_changed_meaning");
    reviewItems.push("Есть признаки того, что нормализация изменила смысл исходного ввода.");
  }

  const rawLooksProblematic = /[!?]{2,}|\.{3,}|\s{2,}|[,;:]{2,}/.test(rawInput);

  if (!normalizationChanged && rawLooksProblematic) {
    flags.push("normalization_failed");
    reviewItems.push("Нормализация не исправила явно проблемный ввод.");
  }

  const comparisonResult =
    flags.includes("normalization_changed_meaning") ||
    flags.includes("normalization_added_fact") ||
    flags.includes("normalization_removed_fact") ||
    flags.includes("normalization_overlegalized")
      ? ("meaning_risk" as const)
      : normalizationChanged && surfaceCleanup
        ? ("surface_cleanup" as const)
        : ("unchanged" as const);

  const resultSummary =
    comparisonResult === "meaning_risk"
      ? "Нормализация выглядит как потенциальный источник смысловой ошибки."
      : comparisonResult === "surface_cleanup"
        ? "Нормализация выглядит как поверхностная правка без явного смыслового сдвига."
        : "Нормализация не дала признаков смыслового сдвига.";

  return {
    review: {
      raw_input: rawInput,
      normalized_input: normalizedInput,
      normalization_model: normalizationModel,
      normalization_prompt_version: normalizationPromptVersion,
      normalization_changed: normalizationChanged,
      comparison_result: comparisonResult,
      changed_ratio: Number.isFinite(changedRatio) ? Number(changedRatio.toFixed(3)) : null,
      result_summary: resultSummary,
    } satisfies NormalizationReview,
    flags: Array.from(new Set(flags)),
    reviewItems,
  };
}

function deriveInputQuality(requestPayloadJson: Record<string, unknown>): LegalCoreRiskLevel {
  const rawInput = readString(requestPayloadJson, "raw_input");

  if (!rawInput) {
    return "low";
  }

  const noisy =
    /[!?]{2,}|\.{3,}|\s{2,}|[,;:]{2,}/.test(rawInput) ||
    rawInput.split(" ").filter(Boolean).length < 4;

  if (rawInput.length < 24 || noisy) {
    return "low";
  }

  if (rawInput.length < 80) {
    return "medium";
  }

  return "high";
}

function deriveRootCause(input: {
  flags: string[];
  selfRiskSignals: SelfRiskSignals;
  inputQuality: LegalCoreRiskLevel;
  lawBasisReview: DeterministicLawBasisReviewResult;
}): ReviewRootCause {
  if (input.flags.some((flag) => flag.startsWith("normalization_"))) {
    return "normalization_issue";
  }

  if (
    input.lawBasisReview.flags.some(
      (flag) => flag.severity !== "pass" && flag.code !== "unresolved_explicit_citation_used_as_basis",
    )
  ) {
    return "law_basis_issue";
  }

  if (
    input.selfRiskSignals.future_review_reason_codes.includes("model_unavailable_after_retrieval") ||
    input.selfRiskSignals.future_review_reason_codes.includes("rewrite_proxy_unavailable")
  ) {
    return "availability_issue";
  }

  if (
    input.selfRiskSignals.future_review_reason_codes.includes("no_usable_corpus") ||
    input.selfRiskSignals.future_review_reason_codes.includes("no_relevant_norms") ||
    input.selfRiskSignals.future_review_reason_codes.includes("precedent_only_grounding") ||
    input.selfRiskSignals.future_review_reason_codes.includes("insufficient_grounding") ||
    input.selfRiskSignals.future_review_reason_codes.includes("law_version_contract_violation") ||
    input.selfRiskSignals.future_review_reason_codes.includes("no_legal_guardrails")
  ) {
    return "law_basis_issue";
  }

  if (input.inputQuality === "low") {
    return "input_quality_issue";
  }

  return "generation_issue";
}

function deriveFixTarget(input: { rootCause: ReviewRootCause; flags: string[] }): ReviewFixTarget {
  if (input.rootCause !== "normalization_issue") {
    return null;
  }

  if (
    input.flags.includes("normalization_added_fact") ||
    input.flags.includes("normalization_removed_fact") ||
    input.flags.includes("normalization_overlegalized") ||
    input.flags.includes("normalization_changed_meaning")
  ) {
    return "normalization_guardrail";
  }

  if (input.flags.includes("normalization_too_aggressive")) {
    return "normalization_prompt";
  }

  return "normalization_model";
}

function deriveReviewConfidence(input: {
  flags: string[];
  selfRiskSignals: SelfRiskSignals;
  lawBasisReview: DeterministicLawBasisReviewResult;
}): LegalCoreAnswerConfidence {
  if (input.flags.some((flag) => flag.startsWith("normalization_"))) {
    return "high";
  }

  if (input.lawBasisReview.summary.fail > 0 || input.lawBasisReview.summary.warn > 0) {
    return "high";
  }

  if (input.selfRiskSignals.future_review_reason_codes.length > 0) {
    return "medium";
  }

  return "low";
}

function deriveQualityScore(input: {
  riskLevel: LegalCoreRiskLevel;
  flags: string[];
  queueForSuperAdmin: boolean;
}) {
  let score = 100;

  if (input.riskLevel === "high") {
    score -= 35;
  } else if (input.riskLevel === "medium") {
    score -= 20;
  } else {
    score -= 5;
  }

  score -= Math.min(40, input.flags.length * 8);

  if (input.queueForSuperAdmin) {
    score -= 10;
  }

  return Math.max(0, score);
}

function stableHash(input: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function getAIQualityReviewControls(
  dependencies: {
    getRuntimeEnv: typeof getAIQualityReviewRuntimeEnv;
  } = {
    getRuntimeEnv: getAIQualityReviewRuntimeEnv,
  },
) {
  const runtimeEnv = dependencies.getRuntimeEnv();
  const enabled = runtimeEnv.AI_REVIEW_ENABLED && runtimeEnv.AI_REVIEW_MODE !== "off";
  const mode = enabled ? runtimeEnv.AI_REVIEW_MODE : ("off" as const);

  return {
    enabled,
    mode,
    daily_request_limit: runtimeEnv.AI_REVIEW_DAILY_REQUEST_LIMIT ?? null,
    daily_cost_limit_usd: runtimeEnv.AI_REVIEW_DAILY_COST_LIMIT_USD ?? null,
  };
}

function getStartOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function evaluateAIReviewLimits(input: {
  controls: ReturnType<typeof getAIQualityReviewControls>;
  usageToday: AIQualityReviewUsageSnapshot;
}) {
  const requestLimitReached =
    input.controls.daily_request_limit !== null &&
    input.usageToday.reviewer_attempt_count >= input.controls.daily_request_limit;
  const costLimitReached =
    input.controls.daily_cost_limit_usd !== null &&
    input.usageToday.reviewer_cost_usd >= input.controls.daily_cost_limit_usd;

  return {
    request_limit_reached: requestLimitReached,
    cost_limit_reached: costLimitReached,
    limits_status:
      input.controls.daily_request_limit === null && input.controls.daily_cost_limit_usd === null
        ? ("no_limits_configured" as const)
        : requestLimitReached || costLimitReached
          ? ("daily_limit_reached" as const)
          : ("enforced_available" as const),
  };
}

function rankRiskLevel(value: LegalCoreRiskLevel) {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function maxRiskLevel(left: LegalCoreRiskLevel, right: LegalCoreRiskLevel): LegalCoreRiskLevel {
  return rankRiskLevel(left) >= rankRiskLevel(right) ? left : right;
}

function rankInputQuality(value: LegalCoreRiskLevel) {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function minInputQuality(
  left: LegalCoreRiskLevel,
  right: LegalCoreRiskLevel,
): LegalCoreRiskLevel {
  return rankInputQuality(left) <= rankInputQuality(right) ? left : right;
}

function extractFirstJsonObject(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const startIndex = trimmed.indexOf("{");
  const endIndex = trimmed.lastIndexOf("}");

  if (startIndex >= 0 && endIndex > startIndex) {
    return trimmed.slice(startIndex, endIndex + 1);
  }

  return null;
}

function buildAIReviewerSystemPrompt() {
  return [
    "Ты внутренний AI reviewer юридической AI-выдачи.",
    "Оцени цепочку raw input -> normalization -> retrieval -> final output.",
    "Не переписывай ответ и не давай советы пользователю.",
    "Нужно вернуть только один JSON-объект без markdown и без пояснений.",
    "Оцени риск внутренней ошибки, а не юридическую силу кейса сама по себе.",
    "Особенно проверяй: искажение смысла нормализацией, слабую правовую опору, слишком смелую генерацию, проблемы input quality.",
    "Поле quality_score: целое число от 0 до 100, где 100 = review не видит заметной проблемы.",
    "Поля risk_level, confidence, input_quality: только low | medium | high.",
    "Поле root_cause: только normalization_issue | law_basis_issue | availability_issue | input_quality_issue | generation_issue.",
    "Поле flags: массив коротких machine-readable строк.",
    "Поле review_items: массив коротких human-readable замечаний.",
  ].join("\n");
}

function buildAIReviewerUserPrompt(input: {
  featureKey: string;
  requestPayloadJson: Record<string, unknown>;
  responsePayloadJson: Record<string, unknown>;
  deterministicSnapshot: DeterministicAIQualityReviewSnapshot;
}) {
  return [
    `feature_key: ${input.featureKey}`,
    "",
    "request_payload_json:",
    JSON.stringify(input.requestPayloadJson, null, 2),
    "",
    "response_payload_json:",
    JSON.stringify(input.responsePayloadJson, null, 2),
    "",
    "deterministic_review_snapshot:",
    JSON.stringify(
      {
        quality_score: input.deterministicSnapshot.quality_score,
        risk_level: input.deterministicSnapshot.risk_level,
        confidence: input.deterministicSnapshot.confidence,
        flags: input.deterministicSnapshot.flags,
        review_items: input.deterministicSnapshot.review_items,
        root_cause: input.deterministicSnapshot.root_cause,
        input_quality: input.deterministicSnapshot.input_quality,
        case_chain: input.deterministicSnapshot.case_chain,
      },
      null,
      2,
    ),
    "",
    "Верни JSON строго в таком формате:",
    JSON.stringify(
      {
        quality_score: 42,
        risk_level: "high",
        confidence: "medium",
        flags: ["example_flag"],
        review_items: ["Краткое внутреннее замечание."],
        root_cause: "generation_issue",
        input_quality: "medium",
      },
      null,
      2,
    ),
  ].join("\n");
}

function shouldRunAIReviewer(input: {
  controls: ReturnType<typeof getAIQualityReviewControls>;
  deterministicSnapshot: DeterministicAIQualityReviewSnapshot;
  limits: ReturnType<typeof evaluateAIReviewLimits>;
}) {
  if (!input.controls.enabled || input.controls.mode !== "full") {
    return false;
  }

  if (input.limits.request_limit_reached || input.limits.cost_limit_reached) {
    return false;
  }

  return (
    input.deterministicSnapshot.queue_for_super_admin ||
    input.deterministicSnapshot.flags.length > 0 ||
    input.deterministicSnapshot.risk_level !== "low"
  );
}

async function runAIReviewer(input: {
  featureKey: string;
  requestPayloadJson: Record<string, unknown>;
  responsePayloadJson: Record<string, unknown>;
  deterministicSnapshot: DeterministicAIQualityReviewSnapshot;
}, dependencies: {
  requestProxyCompletion: typeof requestAssistantProxyCompletion;
}) {
  const startedAt = Date.now();
  const proxyResponse = await dependencies.requestProxyCompletion({
    systemPrompt: buildAIReviewerSystemPrompt(),
    userPrompt: buildAIReviewerUserPrompt(input),
    modelOverride: AI_QUALITY_REVIEWER_MODEL,
    temperature: 0,
    requestMetadata: {
      featureKey: "ai_quality_reviewer",
      review_for_feature: input.featureKey,
      review_prompt_version: AI_QUALITY_REVIEWER_PROMPT_VERSION,
      issue_cluster_key: input.deterministicSnapshot.issue_cluster_key,
    },
  });
  const latencyMs = Math.max(0, Date.now() - startedAt);

  if (proxyResponse.status !== "success") {
    return {
      status: "unavailable" as const,
      reason: proxyResponse.message,
      model: "model" in proxyResponse && proxyResponse.model ? proxyResponse.model : AI_QUALITY_REVIEWER_MODEL,
      prompt_version: AI_QUALITY_REVIEWER_PROMPT_VERSION,
      attempted_proxy_keys: proxyResponse.attemptedProxyKeys,
      latency_ms: latencyMs,
    };
  }

  const jsonText = extractFirstJsonObject(proxyResponse.content);

  if (!jsonText) {
    return {
      status: "invalid_output" as const,
      reason: "AI reviewer did not return a valid JSON object.",
      model: proxyResponse.model ?? AI_QUALITY_REVIEWER_MODEL,
      prompt_version: AI_QUALITY_REVIEWER_PROMPT_VERSION,
      attempted_proxy_keys: proxyResponse.attemptedProxyKeys,
      latency_ms: latencyMs,
    };
  }

  try {
    const parsed = aiReviewerOutputSchema.parse(JSON.parse(jsonText));
    const usageMetrics = extractProxyUsageMetrics(proxyResponse.responsePayloadJson ?? null);

    return {
      status: "completed" as const,
      model: proxyResponse.model ?? AI_QUALITY_REVIEWER_MODEL,
      prompt_version: AI_QUALITY_REVIEWER_PROMPT_VERSION,
      attempted_proxy_keys: proxyResponse.attemptedProxyKeys,
      latency_ms: latencyMs,
      prompt_tokens: usageMetrics.prompt_tokens,
      completion_tokens: usageMetrics.completion_tokens,
      total_tokens: usageMetrics.total_tokens,
      cost_usd: usageMetrics.cost_usd,
      output: parsed,
    };
  } catch (error) {
    return {
      status: "invalid_output" as const,
      reason: error instanceof Error ? error.message : "AI reviewer output is invalid.",
      model: proxyResponse.model ?? AI_QUALITY_REVIEWER_MODEL,
      prompt_version: AI_QUALITY_REVIEWER_PROMPT_VERSION,
      attempted_proxy_keys: proxyResponse.attemptedProxyKeys,
      latency_ms: latencyMs,
    };
  }
}

export function buildDeterministicAIQualityReviewSnapshot(input: {
  featureKey: string;
  requestPayloadJson?: Record<string, unknown> | null;
  responsePayloadJson?: Record<string, unknown> | null;
  usageToday?: AIQualityReviewUsageSnapshot;
  reviewContext?: DeterministicLawBasisReviewContext | null;
}, dependencies: {
  getRuntimeEnv: typeof getAIQualityReviewRuntimeEnv;
} = {
  getRuntimeEnv: getAIQualityReviewRuntimeEnv,
}): DeterministicAIQualityReviewSnapshot {
  const requestPayloadJson = input.requestPayloadJson ?? {};
  const responsePayloadJson = input.responsePayloadJson ?? {};
  const controls = getAIQualityReviewControls(dependencies);
  const usageToday = input.usageToday ?? {
    reviewer_attempt_count: 0,
    reviewer_cost_usd: 0,
  };
  const limits = evaluateAIReviewLimits({
    controls,
    usageToday,
  });
  const selfRiskSignals: SelfRiskSignals = {
    queue_for_future_ai_quality_review:
      responsePayloadJson.queue_for_future_ai_quality_review === true,
    future_review_priority:
      responsePayloadJson.future_review_priority === "high" ||
      responsePayloadJson.future_review_priority === "medium"
        ? (responsePayloadJson.future_review_priority as LegalCoreRiskLevel)
        : "low",
    future_review_flags: readStringArray(responsePayloadJson, "future_review_flags"),
    future_review_reason_codes: readStringArray(responsePayloadJson, "future_review_reason_codes"),
  };
  const normalizationCheck = buildNormalizationReview({ requestPayloadJson });
  const lawBasisReview = buildDeterministicLawBasisReviewResult({
    requestPayloadJson,
    responsePayloadJson,
    reviewContext: input.reviewContext ?? null,
  });
  const lawBasisFlags = lawBasisReview.flags
    .filter((flag) => flag.severity !== "pass")
    .map((flag) => flag.code);
  const flags = Array.from(
    new Set([...selfRiskSignals.future_review_flags, ...normalizationCheck.flags, ...lawBasisFlags]),
  );
  const inputQuality = deriveInputQuality(requestPayloadJson);
  const derivedLawBasisRiskLevel = deriveLawBasisReviewRiskLevel(lawBasisReview);
  const mergedDeterministicRiskLevel = maxRiskLevel(
    selfRiskSignals.future_review_priority,
    derivedLawBasisRiskLevel,
  );
  const rootCause = deriveRootCause({
    flags,
    selfRiskSignals,
    inputQuality,
    lawBasisReview,
  });
  const fixTarget = deriveFixTarget({
    rootCause,
    flags,
  });
  const confidence = deriveReviewConfidence({
    flags,
    selfRiskSignals,
    lawBasisReview,
  });
  const queueForSuperAdmin =
    controls.mode === "full" &&
    (selfRiskSignals.queue_for_future_ai_quality_review || flags.length > 0);
  const finalOutputPreview =
    readString(responsePayloadJson, "answer_markdown_preview") ??
    readString(responsePayloadJson, "suggestionPreview") ??
    (typeof responsePayloadJson.output_trace === "object" &&
    responsePayloadJson.output_trace &&
    !Array.isArray(responsePayloadJson.output_trace)
      ? readString(responsePayloadJson.output_trace as Record<string, unknown>, "output_preview")
      : null);
  const issueFingerprint = stableHash({
    featureKey: input.featureKey,
    rootCause,
    flags,
    reasonCodes: selfRiskSignals.future_review_reason_codes,
    promptVersion: readString(requestPayloadJson, "prompt_version"),
    normalizationPromptVersion: readString(requestPayloadJson, "normalization_prompt_version"),
    lawVersionIds: readUnknownArray(requestPayloadJson, "law_version_ids"),
  });
  const issueClusterKey = stableHash({
    featureKey: input.featureKey,
    rootCause,
    flags: [...flags].sort(),
    promptVersion: readString(requestPayloadJson, "prompt_version"),
  }).slice(0, 20);
  const reviewItems = Array.from(
    new Set([
      ...normalizationCheck.reviewItems,
      ...lawBasisReview.flags
        .filter((flag) => flag.severity !== "pass")
        .map((flag) => flag.short_reason),
      ...selfRiskSignals.future_review_reason_codes.map(
        (reasonCode) => `Self-risk signal from legal core: ${reasonCode}.`,
      ),
    ]),
  );

  return {
    review_version: AI_QUALITY_REVIEW_VERSION,
    review_mode: "deterministic_bootstrap",
    controls: {
      ...controls,
      usage_today: usageToday,
      ...limits,
    },
    queue_for_super_admin: queueForSuperAdmin,
    quality_score: deriveQualityScore({
      riskLevel: mergedDeterministicRiskLevel,
      flags,
      queueForSuperAdmin,
    }),
    risk_level: mergedDeterministicRiskLevel,
    confidence,
    flags,
    review_items: reviewItems,
    root_cause: rootCause,
    input_quality: inputQuality,
    issue_fingerprint: issueFingerprint,
    issue_cluster_key: issueClusterKey,
    fix_target: fixTarget,
    layers: {
      deterministic_checks: {
        status: "completed",
        normalization_review: normalizationCheck.review,
        law_basis_review: lawBasisReview,
        checks: reviewItems,
      },
      ai_reviewer: {
        status: "not_run",
        reason:
          controls.mode !== "full"
            ? "ai_review_mode_not_full"
            : limits.request_limit_reached || limits.cost_limit_reached
              ? "daily_limit_reached"
              : "no_review_signal",
      },
      self_risk_signals: selfRiskSignals,
    },
    case_chain: {
      raw_input: normalizationCheck.review.raw_input,
      normalized_input: normalizationCheck.review.normalized_input,
      normalization_model: normalizationCheck.review.normalization_model,
      normalization_prompt_version: normalizationCheck.review.normalization_prompt_version,
      normalization_changed: normalizationCheck.review.normalization_changed,
      normalization_comparison_result: normalizationCheck.review.comparison_result,
      retrieved_sources:
        readUnknownArray(responsePayloadJson, "used_sources").length > 0
          ? readUnknownArray(responsePayloadJson, "used_sources")
          : readUnknownArray(requestPayloadJson, "used_sources"),
      final_output_preview: finalOutputPreview,
    },
  };
}

export async function attachDeterministicAIQualityReview(input: {
  featureKey: string;
  requestPayloadJson?: Record<string, unknown> | null;
  responsePayloadJson?: Record<string, unknown> | null;
}, dependencies: {
  getRuntimeEnv: typeof getAIQualityReviewRuntimeEnv;
  requestProxyCompletion: typeof requestAssistantProxyCompletion;
  getUsageSince: typeof getAIQualityReviewUsageSince;
  now: () => Date;
} = {
  getRuntimeEnv: getAIQualityReviewRuntimeEnv,
  requestProxyCompletion: requestAssistantProxyCompletion,
  getUsageSince: getAIQualityReviewUsageSinceSafe,
  now: () => new Date(),
}) {
  const responsePayloadJson = input.responsePayloadJson ?? {};
  const controls = getAIQualityReviewControls(dependencies);

  if (!controls.enabled || controls.mode === "off") {
    return responsePayloadJson;
  }

  const usageSince = await dependencies.getUsageSince({
    since: getStartOfUtcDay(dependencies.now()),
  });
  const usageToday = {
    reviewer_attempt_count: usageSince.reviewerAttemptCount,
    reviewer_cost_usd: usageSince.reviewerCostUsd,
  } satisfies AIQualityReviewUsageSnapshot;

  const deterministicSnapshot = buildDeterministicAIQualityReviewSnapshot(
    {
      ...input,
      usageToday,
    },
    dependencies,
  );
  const limits = evaluateAIReviewLimits({
    controls,
    usageToday,
  });

  if (!shouldRunAIReviewer({ controls, deterministicSnapshot, limits })) {
    return {
      ...responsePayloadJson,
      ai_quality_review: deterministicSnapshot,
    };
  }

  const aiReviewer = await runAIReviewer(
    {
      featureKey: input.featureKey,
      requestPayloadJson: input.requestPayloadJson ?? {},
      responsePayloadJson,
      deterministicSnapshot,
    },
    dependencies,
  );

  if (aiReviewer.status !== "completed") {
    return {
      ...responsePayloadJson,
      ai_quality_review: {
        ...deterministicSnapshot,
        layers: {
          ...deterministicSnapshot.layers,
          ai_reviewer: aiReviewer,
        },
      },
    };
  }

  const mergedFlags = Array.from(
    new Set([...deterministicSnapshot.flags, ...aiReviewer.output.flags]),
  );
  const mergedReviewItems = Array.from(
    new Set([...deterministicSnapshot.review_items, ...aiReviewer.output.review_items]),
  );
  const mergedRiskLevel = maxRiskLevel(
    deterministicSnapshot.risk_level,
    aiReviewer.output.risk_level,
  );
  const mergedInputQuality = minInputQuality(
    deterministicSnapshot.input_quality,
    aiReviewer.output.input_quality,
  );
  const queueForSuperAdmin =
    controls.mode === "full" &&
    (deterministicSnapshot.queue_for_super_admin ||
      aiReviewer.output.risk_level !== "low" ||
      aiReviewer.output.flags.length > 0);

  return {
    ...responsePayloadJson,
    ai_quality_review: {
      ...deterministicSnapshot,
      queue_for_super_admin: queueForSuperAdmin,
      quality_score: Math.round(
        (deterministicSnapshot.quality_score + aiReviewer.output.quality_score) / 2,
      ),
      risk_level: mergedRiskLevel,
      confidence: aiReviewer.output.confidence,
      flags: mergedFlags,
      review_items: mergedReviewItems,
      root_cause: aiReviewer.output.root_cause,
      input_quality: mergedInputQuality,
      layers: {
        ...deterministicSnapshot.layers,
        ai_reviewer: aiReviewer,
      },
    },
  };
}
