"use server";

import { ZodError, z } from "zod";

import { getServerByCode } from "@/db/repositories/server.repository";
import {
  completeAITestRun,
  createAITestRun,
  createAITestRunResult,
  syncAITestScenarios,
} from "@/db/repositories/ai-test.repository";
import { findLatestAIRequestByTestRunContext } from "@/db/repositories/ai-request.repository";
import { requireSuperAdminAccountContext } from "@/server/auth/protected";
import {
  legalCoreActorContexts,
  legalCoreResponseModes,
} from "@/server/legal-core/metadata";
import {
  aiLegalCoreScenarioGroupKeys,
  getAILegalCoreTestScenarioById,
  listActiveAILegalCoreTestScenarios,
  listActiveAILegalCoreTestScenariosByGroup,
  type AILegalCoreScenarioGroupKey,
  type AILegalCoreScenarioTargetFlow,
  type AILegalCoreTestScenario,
} from "@/server/legal-core/test-scenarios-registry";
import {
  evaluateScenarioExpectations,
  type ExpectationCheckResult,
  type ExpectationEvaluationResult,
} from "@/server/legal-core/test-expectation-evaluator";
import { runInternalDocumentTextImprovementScenario } from "@/server/legal-core/internal-document-text-improvement";
import { generateServerLegalAssistantAnswer } from "@/server/legal-assistant/answer-pipeline";
import {
  getAILegalCoreScenarioComparisons,
  type AILegalCoreScenarioComparison,
} from "@/server/internal/ai-legal-core-history";

const RUN_GROUP_SCENARIO_LIMIT = 4;

const runTargetSchema = z.enum(["scenario", "group"]);
const lawVersionSelectionSchema = z.literal("current_snapshot_only");
const executionModeSchema = z.enum(["full_generation", "core_only", "compact_generation"]);

const aiLegalCoreTestRunInputSchema = z.object({
  serverSlug: z.string().trim().min(1).max(64),
  lawVersionSelection: lawVersionSelectionSchema,
  actorContext: z.enum(legalCoreActorContexts),
  answerMode: z.enum(legalCoreResponseModes),
  executionMode: executionModeSchema.optional(),
  scenarioGroup: z.enum(aiLegalCoreScenarioGroupKeys),
  scenarioId: z.string().trim().optional(),
  runTarget: runTargetSchema,
});

export type InternalAILegalCoreTestRunResult = {
  scenarioId: string;
  scenarioTitle: string;
  scenarioGroup: string;
  targetFlow: AILegalCoreScenarioTargetFlow;
  inputText: string;
  expectedBehavior: string;
  status: "answered" | "no_norms" | "no_corpus" | "unavailable" | "core_only" | "error";
  executionMode: "full_generation" | "core_only" | "compact_generation";
  message: string | null;
  answer: {
    question: string;
    answerMarkdown: string;
    sections: {
      summary: string;
      normativeAnalysis: string;
      precedentAnalysis: string;
      interpretation: string;
      sources?: string;
    };
    metadata: Record<string, unknown> | null;
    status?: "answered" | "no_norms";
  } | null;
  rewrite: {
    sourceText: string;
    suggestionText: string;
    metadata: Record<string, unknown> | null;
  } | null;
  technical: {
    usedSources: unknown[];
    confidence: string | null;
    insufficientData: boolean | null;
    tokens: number | null;
    costUsd: number | null;
    latencyMs: number | null;
    sentToReview: boolean;
    reviewPriority: string | null;
  };
  coreSnapshot: {
    normalized_input: string | null;
    legal_query_plan: Record<string, unknown> | null;
    selected_norm_roles: unknown[];
    primary_basis_eligibility: Array<{
      law_id: string | null;
      law_version: string | null;
      law_block_id: string | null;
      primary_basis_eligibility: string | null;
      primary_basis_eligibility_reason: string | null;
      ineligible_primary_basis_reasons: string[];
      weak_primary_basis_reasons: string[];
    }>;
    direct_basis_status: string | null;
    used_sources: unknown[];
    diagnostics: {
      applicability_diagnostics: unknown[];
      grounding_diagnostics: Record<string, unknown> | null;
      norm_bundle_diagnostics: {
        companion_relation_types: string[];
        missing_expected_companion: string[];
        included_article_segments: Array<{
          law_id: string | null;
          law_family: string | null;
          article_number: string | null;
          marker: string | null;
          part_number: string | null;
          relation_type: string | null;
          reason_code: string | null;
        }>;
        excluded_article_segments: Array<{
          law_id: string | null;
          law_family: string | null;
          article_number: string | null;
          marker: string | null;
          part_number: string | null;
          relation_type: string | null;
          reason_code: string | null;
        }>;
        bundle_projection_excluded_items: Array<{
          law_id: string | null;
          law_family: string | null;
          article_number: string | null;
          marker: string | null;
          part_number: string | null;
          relation_type: string | null;
          reason_code: string | null;
        }>;
      } | null;
    } | null;
    stage_usage: Record<string, unknown> | null;
    ai_quality_review: Record<string, unknown> | null;
  } | null;
  passed_expectations: ExpectationCheckResult[];
  failed_expectations: ExpectationCheckResult[];
  expectation_summary: {
    passed: number;
    failed: number;
    not_evaluable: number;
    future_reserved: number;
  };
  scenario_group_summary: {
    scenario_group: string;
    scenario_variant: string | null;
    semantic_cluster: string | null;
  };
  cost_summary: {
    tokens: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
    cost: number | null;
    latency: number | null;
  };
  direct_basis_summary: {
    direct_basis_status: string | null;
    primary_basis_count: number;
    eligible_primary_basis_count: number;
    selected_law_families: string[];
  };
  law_basis_review: {
    overall_status: "pass" | "warn" | "fail" | null;
    fail_count: number;
    warn_count: number;
    pass_count: number;
    flag_codes: string[];
    failed_flag_codes: string[];
    warn_flag_codes: string[];
  };
  comparison: AILegalCoreScenarioComparison | null;
};

export type InternalAILegalCoreActionState = {
  status: "idle" | "success" | "error";
  errorMessage: string | null;
  fieldErrors: {
    serverSlug?: string;
    scenarioGroup?: string;
    scenarioId?: string;
  };
  runSummary: {
    testRunId: string;
    serverCode: string;
    serverName: string;
    scenarioCount: number;
    sentToReviewCount: number;
    completedAt: string;
  } | null;
  scenario_group_summary?: {
    total_scenarios: number;
    passed_scenarios: number;
    failed_scenarios: number;
    unresolved_scenarios: number;
    groups: Array<{
      scenario_group: string;
      total_scenarios: number;
      passed_scenarios: number;
      failed_scenarios: number;
      unresolved_scenarios: number;
    }>;
  } | null;
  cost_summary?: {
    total_tokens: number | null;
    average_tokens: number | null;
    total_cost: number | null;
    average_latency: number | null;
  } | null;
  direct_basis_summary?: {
    counts_by_direct_basis_status: Record<string, number>;
    scenarios_with_missing_direct_basis: string[];
    scenarios_with_weak_only_basis: string[];
  } | null;
  law_basis_review_summary?: {
    counts_by_law_basis_review_status: Record<string, number>;
    scenarios_with_failed_law_basis_review: string[];
    top_law_basis_review_flags: Array<{
      code: string;
      count: number;
    }>;
  } | null;
  results: InternalAILegalCoreTestRunResult[];
};

type InternalAILegalCoreActionDependencies = {
  requireSuperAdminAccountContext: typeof requireSuperAdminAccountContext;
  getServerByCode: typeof getServerByCode;
  generateServerLegalAssistantAnswer: typeof generateServerLegalAssistantAnswer;
  runInternalDocumentTextImprovementScenario: typeof runInternalDocumentTextImprovementScenario;
  getAILegalCoreScenarioComparisons: typeof getAILegalCoreScenarioComparisons;
  syncAITestScenarios: typeof syncAITestScenarios;
  createAITestRun: typeof createAITestRun;
  completeAITestRun: typeof completeAITestRun;
  createAITestRunResult: typeof createAITestRunResult;
  findLatestAIRequestByTestRunContext: typeof findLatestAIRequestByTestRunContext;
  now: () => Date;
  createId: () => string;
};

const defaultDependencies: InternalAILegalCoreActionDependencies = {
  requireSuperAdminAccountContext,
  getServerByCode,
  generateServerLegalAssistantAnswer,
  runInternalDocumentTextImprovementScenario,
  getAILegalCoreScenarioComparisons,
  syncAITestScenarios,
  createAITestRun,
  completeAITestRun,
  createAITestRunResult,
  findLatestAIRequestByTestRunContext,
  now: () => new Date(),
  createId: () => crypto.randomUUID(),
};

function readMetadataObject(metadata: Record<string, unknown> | null | undefined) {
  return metadata && typeof metadata === "object" ? metadata : null;
}

function readJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readTechnicalSnapshot(metadata: Record<string, unknown> | null | undefined) {
  const safeMetadata = readMetadataObject(metadata);
  const usedSources = Array.isArray(safeMetadata?.used_sources) ? safeMetadata.used_sources : [];
  const selfAssessment =
    safeMetadata?.self_assessment && typeof safeMetadata.self_assessment === "object"
      ? (safeMetadata.self_assessment as {
          answer_confidence?: string;
          insufficient_data?: boolean;
        })
      : null;
  const reviewStatus =
    safeMetadata?.review_status && typeof safeMetadata.review_status === "object"
      ? (safeMetadata.review_status as {
          queue_for_future_ai_quality_review?: boolean;
          future_review_priority?: string | null;
        })
      : null;

  return {
    usedSources,
    confidence:
      typeof selfAssessment?.answer_confidence === "string"
        ? selfAssessment.answer_confidence
        : null,
    insufficientData:
      typeof selfAssessment?.insufficient_data === "boolean"
        ? selfAssessment.insufficient_data
        : null,
    tokens: typeof safeMetadata?.total_tokens === "number" ? safeMetadata.total_tokens : null,
    costUsd: typeof safeMetadata?.cost_usd === "number" ? safeMetadata.cost_usd : null,
    latencyMs: typeof safeMetadata?.latency_ms === "number" ? safeMetadata.latency_ms : null,
    sentToReview: reviewStatus?.queue_for_future_ai_quality_review === true,
    reviewPriority:
      typeof reviewStatus?.future_review_priority === "string"
        ? reviewStatus.future_review_priority
        : null,
  };
}

function readStageUsageEntry(value: unknown) {
  const safeValue = readJsonObject(value);

  if (!safeValue) {
    return null;
  }

  return {
    prompt_tokens: readNumber(safeValue.prompt_tokens),
    completion_tokens: readNumber(safeValue.completion_tokens),
    total_tokens: readNumber(safeValue.total_tokens),
    estimated_cost_usd: readNumber(safeValue.estimated_cost_usd),
    latency_ms: readNumber(safeValue.latency_ms),
  };
}

function sumNullableNumbers(values: Array<number | null | undefined>) {
  const numericValues = values.filter((value): value is number => typeof value === "number");

  if (numericValues.length === 0) {
    return null;
  }

  return Number(numericValues.reduce((sum, value) => sum + value, 0).toFixed(6));
}

function averageNullableNumbers(values: Array<number | null | undefined>) {
  const numericValues = values.filter((value): value is number => typeof value === "number");

  if (numericValues.length === 0) {
    return null;
  }

  return Number(
    (numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(6),
  );
}

function readCoreSnapshot(input: {
  requestPayloadJson: unknown;
  responsePayloadJson: unknown;
}) {
  const requestPayload = readJsonObject(input.requestPayloadJson);
  const responsePayload = readJsonObject(input.responsePayloadJson);

  if (!requestPayload && !responsePayload) {
    return null;
  }

  const selectedNormRoles = readArray(requestPayload?.selected_norm_roles);
  const applicabilityDiagnostics = readArray(requestPayload?.applicability_diagnostics)
    .map((entry) => readJsonObject(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const usedSources = readArray(responsePayload?.used_sources ?? requestPayload?.used_sources);
  const articleNumberByLawId = new Map<string, string | null>();
  const lawFamilyByLawId = new Map<string, string | null>();

  for (const source of usedSources) {
    const safeSource = readJsonObject(source);
    const lawId = readString(safeSource?.law_id);

    if (!lawId) {
      continue;
    }

    articleNumberByLawId.set(lawId, readString(safeSource?.article_number));
  }

  for (const selected of selectedNormRoles) {
    const safeSelected = readJsonObject(selected);
    const lawId = readString(safeSelected?.law_id);

    if (!lawId) {
      continue;
    }

    lawFamilyByLawId.set(lawId, readString(safeSelected?.law_family));
  }

  function readNormBundleSegmentDecisionArray(value: unknown) {
    return readArray(value)
      .map((entry) => readJsonObject(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .map((entry) => {
        const lawId = readString(entry.law_id);

        return {
          law_id: lawId,
          law_family: lawId ? (lawFamilyByLawId.get(lawId) ?? null) : null,
          article_number: lawId ? (articleNumberByLawId.get(lawId) ?? null) : null,
          marker: readString(entry.marker),
          part_number: readString(entry.part_number),
          relation_type: readString(entry.relation_type),
          reason_code: readString(entry.reason_code),
        };
      });
  }

  function readProjectionExcludedItems(value: unknown) {
    return readArray(value).flatMap((entry) => {
      const safeEntry = readJsonObject(entry);
      const lawId = readString(safeEntry?.law_id);
      const articleNumber = lawId ? (articleNumberByLawId.get(lawId) ?? null) : null;
      const lawFamily = lawId ? (lawFamilyByLawId.get(lawId) ?? null) : null;

      return readArray(safeEntry?.items)
        .map((item) => readJsonObject(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          law_id: lawId,
          law_family: lawFamily,
          article_number: articleNumber,
          marker: readString(item.marker),
          part_number: readString(item.part_number),
          relation_type: readString(item.relation_type),
          reason_code: readString(item.reason_code),
        }));
    });
  }
  const selectedPrimaryBasisEligibility = applicabilityDiagnostics
    .filter((entry) =>
      selectedNormRoles.some((selected) => {
        const selectedObject = readJsonObject(selected);

        if (!selectedObject) {
          return false;
        }

        return (
          readString(selectedObject.law_id) === readString(entry.law_id) &&
          readString(selectedObject.law_version) === readString(entry.law_version) &&
          readString(selectedObject.law_block_id) === readString(entry.law_block_id)
        );
      }),
    )
    .map((entry) => ({
      law_id: readString(entry.law_id),
      law_version: readString(entry.law_version),
      law_block_id: readString(entry.law_block_id),
      primary_basis_eligibility: readString(entry.primary_basis_eligibility),
      primary_basis_eligibility_reason: readString(entry.primary_basis_eligibility_reason),
      ineligible_primary_basis_reasons: readArray(entry.ineligible_primary_basis_reasons).filter(
        (value): value is string => typeof value === "string",
      ),
      weak_primary_basis_reasons: readArray(entry.weak_primary_basis_reasons).filter(
        (value): value is string => typeof value === "string",
      ),
    }));

  return {
    normalized_input: readString(requestPayload?.normalized_input),
    legal_query_plan: readJsonObject(requestPayload?.legal_query_plan),
    selected_norm_roles: selectedNormRoles,
    primary_basis_eligibility: selectedPrimaryBasisEligibility,
    direct_basis_status: readString(requestPayload?.direct_basis_status),
    used_sources: usedSources,
    diagnostics: {
      applicability_diagnostics: applicabilityDiagnostics,
      grounding_diagnostics: readJsonObject(requestPayload?.grounding_diagnostics),
      norm_bundle_diagnostics: {
        companion_relation_types: readArray(requestPayload?.companion_relation_types).flatMap((entry) => {
          const safeEntry = readJsonObject(entry);

          if (!safeEntry) {
            return [];
          }

          return readArray(safeEntry.relation_types).filter(
            (value): value is string => typeof value === "string",
          );
        }),
        missing_expected_companion: readArray(requestPayload?.missing_expected_companion).filter(
          (value): value is string => typeof value === "string",
        ),
        included_article_segments: readNormBundleSegmentDecisionArray(
          requestPayload?.included_article_segments,
        ),
        excluded_article_segments: readNormBundleSegmentDecisionArray(
          requestPayload?.excluded_article_segments,
        ),
        bundle_projection_excluded_items: readProjectionExcludedItems(
          requestPayload?.bundle_projection_excluded_items,
        ),
      },
    },
    stage_usage: readJsonObject(responsePayload?.stage_usage),
    ai_quality_review: readJsonObject(responsePayload?.ai_quality_review),
  };
}

function buildEmptyExpectationEvaluation(): ExpectationEvaluationResult {
  return {
    checks: [],
    passed_expectations: [],
    failed_expectations: [],
    expectation_summary: {
      passed: 0,
      failed: 0,
      not_evaluable: 0,
      future_reserved: 0,
    },
  };
}

function buildScenarioGroupSummary(scenario: AILegalCoreTestScenario) {
  return {
    scenario_group: scenario.suiteGroup ?? scenario.scenarioGroup,
    scenario_variant: scenario.scenarioVariant ?? null,
    semantic_cluster: scenario.semanticCluster ?? null,
  };
}

function buildCostSummary(input: {
  technical: InternalAILegalCoreTestRunResult["technical"];
  coreSnapshot: InternalAILegalCoreTestRunResult["coreSnapshot"];
}) {
  const stageUsageEntries = Object.values(input.coreSnapshot?.stage_usage ?? {})
    .map((entry) => readStageUsageEntry(entry))
    .filter((entry): entry is NonNullable<ReturnType<typeof readStageUsageEntry>> => Boolean(entry));

  const summedPromptTokens = sumNullableNumbers(stageUsageEntries.map((entry) => entry.prompt_tokens));
  const summedCompletionTokens = sumNullableNumbers(
    stageUsageEntries.map((entry) => entry.completion_tokens),
  );
  const summedTotalTokens = sumNullableNumbers(stageUsageEntries.map((entry) => entry.total_tokens));
  const summedCost = sumNullableNumbers(stageUsageEntries.map((entry) => entry.estimated_cost_usd));
  const summedLatency = sumNullableNumbers(stageUsageEntries.map((entry) => entry.latency_ms));

  return {
    tokens: input.technical.tokens ?? summedTotalTokens,
    input_tokens: summedPromptTokens,
    output_tokens: summedCompletionTokens,
    cost: input.technical.costUsd ?? summedCost,
    latency: input.technical.latencyMs ?? summedLatency,
  };
}

function buildLawBasisReviewSummary(
  coreSnapshot: InternalAILegalCoreTestRunResult["coreSnapshot"],
) {
  const lawBasisReview = readJsonObject(
    coreSnapshot?.ai_quality_review &&
      readJsonObject(coreSnapshot.ai_quality_review.layers)?.deterministic_checks &&
      readJsonObject(
        readJsonObject(coreSnapshot.ai_quality_review.layers)?.deterministic_checks,
      )?.law_basis_review,
  );
  const summary = readJsonObject(lawBasisReview?.summary);
  const flags = readArray(lawBasisReview?.flags)
    .map((entry) => readJsonObject(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const overallStatus = readString(lawBasisReview?.overall_status) as
    | "pass"
    | "warn"
    | "fail"
    | null;

  return {
    overall_status: overallStatus,
    fail_count: readNumber(summary?.fail) ?? 0,
    warn_count: readNumber(summary?.warn) ?? 0,
    pass_count: readNumber(summary?.pass) ?? 0,
    flag_codes: flags
      .map((entry) => readString(entry.code))
      .filter((value): value is string => Boolean(value)),
    failed_flag_codes: flags
      .filter((entry) => readString(entry.severity) === "fail")
      .map((entry) => readString(entry.code))
      .filter((value): value is string => Boolean(value)),
    warn_flag_codes: flags
      .filter((entry) => readString(entry.severity) === "warn")
      .map((entry) => readString(entry.code))
      .filter((value): value is string => Boolean(value)),
  };
}

function buildDirectBasisSummary(
  coreSnapshot: InternalAILegalCoreTestRunResult["coreSnapshot"],
) {
  const selectedNormRoles = coreSnapshot?.selected_norm_roles ?? [];
  const primaryBasisEntries = selectedNormRoles.filter((entry) => {
    const safeEntry = readJsonObject(entry);

    return readString(safeEntry?.norm_role) === "primary_basis";
  });
  const eligiblePrimaryBasisCount = (coreSnapshot?.primary_basis_eligibility ?? []).filter(
    (entry) => entry.primary_basis_eligibility === "eligible",
  ).length;
  const selectedLawFamilies = Array.from(
    new Set(
      selectedNormRoles
        .map((entry) => {
          const safeEntry = readJsonObject(entry);

          return readString(safeEntry?.law_family);
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return {
    direct_basis_status: coreSnapshot?.direct_basis_status ?? null,
    primary_basis_count: primaryBasisEntries.length,
    eligible_primary_basis_count: eligiblePrimaryBasisCount,
    selected_law_families: selectedLawFamilies,
  };
}

function buildExpectationEvaluationForScenario(input: {
  scenario: AILegalCoreTestScenario;
  technical: InternalAILegalCoreTestRunResult["technical"];
  coreSnapshot: InternalAILegalCoreTestRunResult["coreSnapshot"];
}) {
  const expectationProfile = input.scenario.expectationProfile ?? null;

  if (!expectationProfile || !input.coreSnapshot) {
    return buildEmptyExpectationEvaluation();
  }

  return evaluateScenarioExpectations({
    expectationProfile,
    snapshot: {
      selected_norm_roles: input.coreSnapshot.selected_norm_roles.map((entry) => {
        const safeEntry = readJsonObject(entry);

        return {
          law_id: readString(safeEntry?.law_id),
          law_version: readString(safeEntry?.law_version),
          law_block_id: readString(safeEntry?.law_block_id),
          law_family: readString(safeEntry?.law_family),
          norm_role: readString(safeEntry?.norm_role),
          applicability_score: readNumber(safeEntry?.applicability_score),
        };
      }),
      primary_basis_eligibility: input.coreSnapshot.primary_basis_eligibility,
      direct_basis_status: input.coreSnapshot.direct_basis_status,
      used_sources: input.coreSnapshot.used_sources.map((entry) => {
        const safeEntry = readJsonObject(entry);

        return {
          source_kind: readString(safeEntry?.source_kind),
          law_id: readString(safeEntry?.law_id),
          law_name: readString(safeEntry?.law_name),
          article_number: readString(safeEntry?.article_number),
        };
      }),
      technical: {
        tokens: input.technical.tokens,
        costUsd: input.technical.costUsd,
        latencyMs: input.technical.latencyMs,
      },
      stage_usage: input.coreSnapshot.stage_usage,
      norm_bundle_diagnostics: input.coreSnapshot.diagnostics?.norm_bundle_diagnostics ?? null,
    },
  });
}

function attachInternalRunnerSummaries(input: {
  scenario: AILegalCoreTestScenario;
  result: InternalAILegalCoreTestRunResult;
}) {
  const expectationEvaluation = buildExpectationEvaluationForScenario({
    scenario: input.scenario,
    technical: input.result.technical,
    coreSnapshot: input.result.coreSnapshot,
  });

  return {
    ...input.result,
    passed_expectations: expectationEvaluation.passed_expectations,
    failed_expectations: expectationEvaluation.failed_expectations,
    expectation_summary: expectationEvaluation.expectation_summary,
    scenario_group_summary: buildScenarioGroupSummary(input.scenario),
    cost_summary: buildCostSummary({
      technical: input.result.technical,
      coreSnapshot: input.result.coreSnapshot,
    }),
    direct_basis_summary: buildDirectBasisSummary(input.result.coreSnapshot),
    law_basis_review: buildLawBasisReviewSummary(input.result.coreSnapshot),
  } satisfies InternalAILegalCoreTestRunResult;
}

function buildAggregateScenarioGroupSummary(results: InternalAILegalCoreTestRunResult[]) {
  const groups = new Map<
    string,
    {
      scenario_group: string;
      total_scenarios: number;
      passed_scenarios: number;
      failed_scenarios: number;
      unresolved_scenarios: number;
    }
  >();
  let passedScenarios = 0;
  let failedScenarios = 0;
  let unresolvedScenarios = 0;

  for (const result of results) {
    const groupKey = result.scenario_group_summary.scenario_group;
    const existing = groups.get(groupKey) ?? {
      scenario_group: groupKey,
      total_scenarios: 0,
      passed_scenarios: 0,
      failed_scenarios: 0,
      unresolved_scenarios: 0,
    };

    const isFailed = result.expectation_summary.failed > 0;
    const isPassed =
      result.expectation_summary.failed === 0 &&
      result.expectation_summary.not_evaluable === 0 &&
      result.expectation_summary.passed > 0;

    existing.total_scenarios += 1;

    if (isFailed) {
      existing.failed_scenarios += 1;
      failedScenarios += 1;
    } else if (isPassed) {
      existing.passed_scenarios += 1;
      passedScenarios += 1;
    } else {
      existing.unresolved_scenarios += 1;
      unresolvedScenarios += 1;
    }

    groups.set(groupKey, existing);
  }

  return {
    total_scenarios: results.length,
    passed_scenarios: passedScenarios,
    failed_scenarios: failedScenarios,
    unresolved_scenarios: unresolvedScenarios,
    groups: Array.from(groups.values()),
  };
}

function buildAggregateCostSummary(results: InternalAILegalCoreTestRunResult[]) {
  return {
    total_tokens: sumNullableNumbers(results.map((result) => result.cost_summary.tokens)),
    average_tokens: averageNullableNumbers(results.map((result) => result.cost_summary.tokens)),
    total_cost: sumNullableNumbers(results.map((result) => result.cost_summary.cost)),
    average_latency: averageNullableNumbers(results.map((result) => result.cost_summary.latency)),
  };
}

function buildAggregateDirectBasisSummary(results: InternalAILegalCoreTestRunResult[]) {
  const countsByDirectBasisStatus: Record<string, number> = {
    direct_basis_present: 0,
    partial_basis_only: 0,
    no_direct_basis: 0,
    unknown: 0,
  };
  const scenariosWithMissingDirectBasis: string[] = [];
  const scenariosWithWeakOnlyBasis: string[] = [];

  for (const result of results) {
    const status = result.direct_basis_summary.direct_basis_status ?? "unknown";
    countsByDirectBasisStatus[status] = (countsByDirectBasisStatus[status] ?? 0) + 1;

    if (status === "no_direct_basis") {
      scenariosWithMissingDirectBasis.push(result.scenarioId);
    }

    if (status === "partial_basis_only") {
      scenariosWithWeakOnlyBasis.push(result.scenarioId);
    }
  }

  return {
    counts_by_direct_basis_status: countsByDirectBasisStatus,
    scenarios_with_missing_direct_basis: scenariosWithMissingDirectBasis,
    scenarios_with_weak_only_basis: scenariosWithWeakOnlyBasis,
  };
}

function buildAggregateLawBasisReviewSummary(results: InternalAILegalCoreTestRunResult[]) {
  const countsByStatus: Record<string, number> = {
    pass: 0,
    warn: 0,
    fail: 0,
    unknown: 0,
  };
  const scenariosWithFailedLawBasisReview: string[] = [];
  const flagCounts = new Map<string, number>();

  for (const result of results) {
    const status = result.law_basis_review.overall_status ?? "unknown";
    countsByStatus[status] = (countsByStatus[status] ?? 0) + 1;

    if (status === "fail") {
      scenariosWithFailedLawBasisReview.push(result.scenarioId);
    }

    for (const flagCode of result.law_basis_review.failed_flag_codes) {
      flagCounts.set(flagCode, (flagCounts.get(flagCode) ?? 0) + 1);
    }

    for (const flagCode of result.law_basis_review.warn_flag_codes) {
      flagCounts.set(flagCode, (flagCounts.get(flagCode) ?? 0) + 1);
    }
  }

  const topLawBasisReviewFlags = Array.from(flagCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.code.localeCompare(right.code);
    });

  return {
    counts_by_law_basis_review_status: countsByStatus,
    scenarios_with_failed_law_basis_review: scenariosWithFailedLawBasisReview,
    top_law_basis_review_flags: topLawBasisReviewFlags,
  };
}

function buildActionResultFromScenario(input: {
  scenario: AILegalCoreTestScenario;
  result: Awaited<ReturnType<typeof generateServerLegalAssistantAnswer>>;
}): InternalAILegalCoreTestRunResult {
  if (input.result.status === "answered" || input.result.status === "no_norms") {
    return {
      scenarioId: input.scenario.id,
      scenarioTitle: input.scenario.title,
      scenarioGroup: input.scenario.scenarioGroup,
      targetFlow: input.scenario.targetFlow,
      inputText: input.scenario.inputText,
      expectedBehavior: input.scenario.expectedBehavior,
      status: input.result.status,
      executionMode: "full_generation",
      message: null,
      answer: {
        question: input.scenario.inputText,
        answerMarkdown: input.result.answerMarkdown,
        sections: input.result.sections,
        metadata: input.result.metadata,
        status: input.result.status,
      },
      rewrite: null,
      technical: readTechnicalSnapshot(input.result.metadata),
      coreSnapshot: null,
      passed_expectations: [],
      failed_expectations: [],
      expectation_summary: {
        passed: 0,
        failed: 0,
        not_evaluable: 0,
        future_reserved: 0,
      },
      scenario_group_summary: buildScenarioGroupSummary(input.scenario),
      cost_summary: {
        tokens: null,
        input_tokens: null,
        output_tokens: null,
        cost: null,
        latency: null,
      },
      direct_basis_summary: {
        direct_basis_status: null,
        primary_basis_count: 0,
        eligible_primary_basis_count: 0,
        selected_law_families: [],
      },
      comparison: null,
      law_basis_review: {
        overall_status: null,
        fail_count: 0,
        warn_count: 0,
        pass_count: 0,
        flag_codes: [],
        failed_flag_codes: [],
        warn_flag_codes: [],
      },
    };
  }

  if (input.result.status === "core_only") {
    return {
      scenarioId: input.scenario.id,
      scenarioTitle: input.scenario.title,
      scenarioGroup: input.scenario.scenarioGroup,
      targetFlow: input.scenario.targetFlow,
      inputText: input.scenario.inputText,
      expectedBehavior: input.scenario.expectedBehavior,
      status: "core_only",
      executionMode: "core_only",
      message: input.result.message,
      answer: null,
      rewrite: null,
      technical: readTechnicalSnapshot(input.result.metadata),
      coreSnapshot: null,
      passed_expectations: [],
      failed_expectations: [],
      expectation_summary: {
        passed: 0,
        failed: 0,
        not_evaluable: 0,
        future_reserved: 0,
      },
      scenario_group_summary: buildScenarioGroupSummary(input.scenario),
      cost_summary: {
        tokens: null,
        input_tokens: null,
        output_tokens: null,
        cost: null,
        latency: null,
      },
      direct_basis_summary: {
        direct_basis_status: null,
        primary_basis_count: 0,
        eligible_primary_basis_count: 0,
        selected_law_families: [],
      },
      comparison: null,
      law_basis_review: {
        overall_status: null,
        fail_count: 0,
        warn_count: 0,
        pass_count: 0,
        flag_codes: [],
        failed_flag_codes: [],
        warn_flag_codes: [],
      },
    };
  }

  return {
    scenarioId: input.scenario.id,
    scenarioTitle: input.scenario.title,
    scenarioGroup: input.scenario.scenarioGroup,
    targetFlow: input.scenario.targetFlow,
    inputText: input.scenario.inputText,
    expectedBehavior: input.scenario.expectedBehavior,
    status: input.result.status,
    executionMode: "full_generation",
    message: input.result.message,
    answer: null,
    rewrite: null,
    technical: readTechnicalSnapshot(input.result.metadata),
    coreSnapshot: null,
    passed_expectations: [],
    failed_expectations: [],
    expectation_summary: {
      passed: 0,
      failed: 0,
      not_evaluable: 0,
      future_reserved: 0,
    },
    scenario_group_summary: buildScenarioGroupSummary(input.scenario),
    cost_summary: {
      tokens: null,
      input_tokens: null,
      output_tokens: null,
      cost: null,
      latency: null,
    },
    direct_basis_summary: {
      direct_basis_status: null,
      primary_basis_count: 0,
      eligible_primary_basis_count: 0,
      selected_law_families: [],
    },
    comparison: null,
    law_basis_review: {
      overall_status: null,
      fail_count: 0,
      warn_count: 0,
      pass_count: 0,
      flag_codes: [],
      failed_flag_codes: [],
      warn_flag_codes: [],
    },
  };
}

function buildRewriteResultFromScenario(input: {
  scenario: AILegalCoreTestScenario;
  result: Awaited<ReturnType<typeof runInternalDocumentTextImprovementScenario>>;
}): InternalAILegalCoreTestRunResult {
  if (input.result.status === "rewritten") {
    return {
      scenarioId: input.scenario.id,
      scenarioTitle: input.scenario.title,
      scenarioGroup: input.scenario.scenarioGroup,
      targetFlow: input.scenario.targetFlow,
      inputText: input.scenario.inputText,
      expectedBehavior: input.scenario.expectedBehavior,
      status: "answered",
      executionMode: "full_generation",
      message: null,
      answer: null,
      rewrite: {
        sourceText: input.result.sourceText,
        suggestionText: input.result.suggestionText,
        metadata: input.result.metadata,
      },
      technical: readTechnicalSnapshot(input.result.metadata),
      coreSnapshot: null,
      passed_expectations: [],
      failed_expectations: [],
      expectation_summary: {
        passed: 0,
        failed: 0,
        not_evaluable: 0,
        future_reserved: 0,
      },
      scenario_group_summary: buildScenarioGroupSummary(input.scenario),
      cost_summary: {
        tokens: null,
        input_tokens: null,
        output_tokens: null,
        cost: null,
        latency: null,
      },
      direct_basis_summary: {
        direct_basis_status: null,
        primary_basis_count: 0,
        eligible_primary_basis_count: 0,
        selected_law_families: [],
      },
      comparison: null,
      law_basis_review: {
        overall_status: null,
        fail_count: 0,
        warn_count: 0,
        pass_count: 0,
        flag_codes: [],
        failed_flag_codes: [],
        warn_flag_codes: [],
      },
    };
  }

  return {
    scenarioId: input.scenario.id,
    scenarioTitle: input.scenario.title,
    scenarioGroup: input.scenario.scenarioGroup,
    targetFlow: input.scenario.targetFlow,
    inputText: input.scenario.inputText,
    expectedBehavior: input.scenario.expectedBehavior,
    status: input.result.status,
    executionMode: "full_generation",
    message: input.result.message,
    answer: null,
    rewrite: null,
    technical: readTechnicalSnapshot(input.result.metadata),
    coreSnapshot: null,
    passed_expectations: [],
    failed_expectations: [],
    expectation_summary: {
      passed: 0,
      failed: 0,
      not_evaluable: 0,
      future_reserved: 0,
    },
    scenario_group_summary: buildScenarioGroupSummary(input.scenario),
    cost_summary: {
      tokens: null,
      input_tokens: null,
      output_tokens: null,
      cost: null,
      latency: null,
    },
    direct_basis_summary: {
      direct_basis_status: null,
      primary_basis_count: 0,
      eligible_primary_basis_count: 0,
      selected_law_families: [],
    },
    comparison: null,
    law_basis_review: {
      overall_status: null,
      fail_count: 0,
      warn_count: 0,
      pass_count: 0,
      flag_codes: [],
      failed_flag_codes: [],
      warn_flag_codes: [],
    },
  };
}

function buildErrorResultFromScenario(
  scenario: AILegalCoreTestScenario,
  message: string,
): InternalAILegalCoreTestRunResult {
  return {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    scenarioGroup: scenario.scenarioGroup,
    targetFlow: scenario.targetFlow,
    inputText: scenario.inputText,
    expectedBehavior: scenario.expectedBehavior,
    status: "error",
    executionMode: "full_generation",
    message,
    answer: null,
    rewrite: null,
    technical: {
      usedSources: [],
      confidence: null,
      insufficientData: null,
      tokens: null,
      costUsd: null,
      latencyMs: null,
      sentToReview: false,
      reviewPriority: null,
    },
    coreSnapshot: null,
    passed_expectations: [],
    failed_expectations: [],
    expectation_summary: {
      passed: 0,
      failed: 0,
      not_evaluable: 0,
      future_reserved: 0,
    },
    scenario_group_summary: buildScenarioGroupSummary(scenario),
    cost_summary: {
      tokens: null,
      input_tokens: null,
      output_tokens: null,
      cost: null,
      latency: null,
    },
    direct_basis_summary: {
      direct_basis_status: null,
      primary_basis_count: 0,
      eligible_primary_basis_count: 0,
      selected_law_families: [],
    },
    comparison: null,
    law_basis_review: {
      overall_status: null,
      fail_count: 0,
      warn_count: 0,
      pass_count: 0,
      flag_codes: [],
      failed_flag_codes: [],
      warn_flag_codes: [],
    },
  };
}

function selectScenariosForRun(input: {
  scenarioGroup: AILegalCoreScenarioGroupKey;
  scenarioId?: string;
  runTarget: z.infer<typeof runTargetSchema>;
}) {
  if (input.runTarget === "scenario") {
    const scenario = input.scenarioId ? getAILegalCoreTestScenarioById(input.scenarioId) : null;

    if (!scenario || !scenario.isActive) {
      return [];
    }

    return [scenario];
  }

  return listActiveAILegalCoreTestScenariosByGroup(input.scenarioGroup).slice(
    0,
    RUN_GROUP_SCENARIO_LIMIT,
  );
}

function mapResultStatusToRunResultStatus(
  result: InternalAILegalCoreTestRunResult,
): "success" | "failure" | "unavailable" {
  if (result.status === "answered" || result.status === "no_norms" || result.status === "core_only") {
    return "success";
  }

  if (result.status === "no_corpus" || result.status === "unavailable") {
    return "unavailable";
  }

  return "failure";
}

export async function runInternalAILegalCoreScenariosAction(
  _previousState: InternalAILegalCoreActionState,
  formData: FormData,
  dependencies: InternalAILegalCoreActionDependencies = defaultDependencies,
): Promise<InternalAILegalCoreActionState> {
  try {
    const protectedContext = await dependencies.requireSuperAdminAccountContext(
      "/internal/ai-legal-core",
    );
    const parsed = aiLegalCoreTestRunInputSchema.parse({
      serverSlug: String(formData.get("serverSlug") ?? ""),
      lawVersionSelection: String(formData.get("lawVersionSelection") ?? ""),
      actorContext: String(formData.get("actorContext") ?? ""),
      answerMode: String(formData.get("answerMode") ?? ""),
      executionMode:
        typeof formData.get("executionMode") === "string"
          ? String(formData.get("executionMode"))
          : undefined,
      scenarioGroup: String(formData.get("scenarioGroup") ?? ""),
      scenarioId:
        typeof formData.get("scenarioId") === "string" ? String(formData.get("scenarioId")) : undefined,
      runTarget: String(formData.get("runTarget") ?? ""),
    });
    const server = await dependencies.getServerByCode(parsed.serverSlug);

    if (!server) {
      return {
        status: "error",
        errorMessage: "Выбранный сервер недоступен для internal AI Legal Core tests.",
        fieldErrors: {
          serverSlug: "Нужен активный сервер с assistant corpus.",
        },
        runSummary: null,
        law_basis_review_summary: null,
        results: [],
      };
    }

    const scenarios = selectScenariosForRun(parsed);
    const executionMode = parsed.executionMode ?? "full_generation";

    if (scenarios.length === 0) {
      return {
        status: "error",
        errorMessage:
          parsed.runTarget === "scenario"
            ? "Не удалось найти активный test scenario для запуска."
            : "В выбранной группе пока нет активных test scenarios, доступных в текущем implementation slice.",
        fieldErrors: {
          scenarioGroup:
            parsed.runTarget === "group"
              ? "Для этой группы пока нет доступных сценариев."
              : undefined,
          scenarioId:
            parsed.runTarget === "scenario"
              ? "Выбери активный сценарий."
              : undefined,
        },
        runSummary: null,
        law_basis_review_summary: null,
        results: [],
      };
    }

    const testRunId = dependencies.createId();
    const results: InternalAILegalCoreTestRunResult[] = [];

    await dependencies.syncAITestScenarios({
      scenarios: listActiveAILegalCoreTestScenarios(),
    });
    await dependencies.createAITestRun({
      id: testRunId,
      startedByAccountId: protectedContext.account.id,
      serverId: server.id,
      lawVersion: parsed.lawVersionSelection,
      status: "running",
      startedAt: dependencies.now(),
    });

    for (const scenario of scenarios) {
      try {
        if (scenario.targetFlow === "server_legal_assistant") {
          const result = await dependencies.generateServerLegalAssistantAnswer({
            serverId: server.id,
            serverCode: server.code,
            serverName: server.name,
            question: scenario.inputText,
            actorContext: parsed.actorContext,
            responseModeOverride: parsed.answerMode,
            accountId: protectedContext.account.id,
            guestSessionId: null,
            testRunContext: {
              run_kind: "internal_ai_legal_core_test",
              server_id: server.id,
              server_code: server.code,
              test_run_id: testRunId,
              test_scenario_id: scenario.id,
              test_scenario_group: scenario.scenarioGroup,
              test_scenario_title: scenario.title,
              law_version_selection: parsed.lawVersionSelection,
            },
            internalExecutionMode:
              executionMode === "core_only"
                ? "core_only"
                : executionMode === "compact_generation"
                  ? "compact_generation"
                  : "full_generation",
          });

          let actionResult = buildActionResultFromScenario({
            scenario,
            result,
          });
          const aiRequest = await dependencies.findLatestAIRequestByTestRunContext({
            testRunId,
            testScenarioId: scenario.id,
            accountId: protectedContext.account.id,
            serverId: server.id,
          });
          const coreSnapshot = readCoreSnapshot({
            requestPayloadJson: aiRequest?.requestPayloadJson,
            responsePayloadJson: aiRequest?.responsePayloadJson,
          });

          if (executionMode === "core_only") {
            actionResult = {
              ...actionResult,
              executionMode: "core_only",
              coreSnapshot,
            };
          } else if (executionMode === "compact_generation") {
            actionResult = {
              ...actionResult,
              executionMode: "compact_generation",
              coreSnapshot,
            };
          } else {
            actionResult = {
              ...actionResult,
              coreSnapshot,
            };
          }
          actionResult = attachInternalRunnerSummaries({
            scenario,
            result: actionResult,
          });

          await dependencies.createAITestRunResult({
            testRunId,
            testScenarioId: scenario.id,
            aiGenerationId: aiRequest?.id ?? null,
            status: mapResultStatusToRunResultStatus(actionResult),
            riskLevel: actionResult.technical.reviewPriority,
            passedBasicChecks:
              !actionResult.technical.sentToReview &&
              (actionResult.status === "answered" ||
                actionResult.status === "no_norms" ||
                actionResult.status === "core_only"),
            sentToReview: actionResult.technical.sentToReview,
          });
          results.push(actionResult);
        } else {
          const result = await dependencies.runInternalDocumentTextImprovementScenario({
            serverId: server.id,
            serverCode: server.code,
            serverName: server.name,
            sourceText: scenario.inputText,
            actorContext: parsed.actorContext,
            responseMode: parsed.answerMode,
            accountId: protectedContext.account.id,
            testRunContext: {
              run_kind: "internal_ai_legal_core_test",
              server_id: server.id,
              server_code: server.code,
              test_run_id: testRunId,
              test_scenario_id: scenario.id,
              test_scenario_group: scenario.scenarioGroup,
              test_scenario_title: scenario.title,
              law_version_selection: parsed.lawVersionSelection,
            },
          });

          const actionResult = buildRewriteResultFromScenario({
            scenario,
            result,
          });
          const aiRequest = await dependencies.findLatestAIRequestByTestRunContext({
            testRunId,
            testScenarioId: scenario.id,
            accountId: protectedContext.account.id,
            serverId: server.id,
          });

          await dependencies.createAITestRunResult({
            testRunId,
            testScenarioId: scenario.id,
            aiGenerationId: aiRequest?.id ?? null,
            status: mapResultStatusToRunResultStatus(actionResult),
            riskLevel: actionResult.technical.reviewPriority,
            passedBasicChecks:
              !actionResult.technical.sentToReview && actionResult.status === "answered",
            sentToReview: actionResult.technical.sentToReview,
          });
          results.push(
            attachInternalRunnerSummaries({
              scenario,
              result: actionResult,
            }),
          );
        }
      } catch {
        const errorResult = buildErrorResultFromScenario(
          scenario,
          "Во время прогона этого сценария произошла внутренняя ошибка.",
        );

        await dependencies.createAITestRunResult({
          testRunId,
          testScenarioId: scenario.id,
          aiGenerationId: null,
          status: "failure",
          riskLevel: null,
          passedBasicChecks: false,
          sentToReview: false,
        });
        results.push(
          attachInternalRunnerSummaries({
            scenario,
            result: errorResult,
          }),
        );
      }
    }

    const comparisons = await dependencies.getAILegalCoreScenarioComparisons({
      scenarioIds: results.map((result) => result.scenarioId),
      serverId: server.id,
      lawVersionSelection: parsed.lawVersionSelection,
    });
    const resultsWithComparisons = results.map((result) => ({
      ...result,
      comparison: comparisons.get(result.scenarioId) ?? null,
    }));
    await dependencies.completeAITestRun({
      id: testRunId,
      status: resultsWithComparisons.some((result) => result.status === "error") ? "failure" : "success",
      completedAt: dependencies.now(),
    });

    return {
      status: "success",
      errorMessage: null,
      fieldErrors: {},
      runSummary: {
        testRunId,
        serverCode: server.code,
        serverName: server.name,
        scenarioCount: resultsWithComparisons.length,
        sentToReviewCount: resultsWithComparisons.filter((result) => result.technical.sentToReview).length,
        completedAt: dependencies.now().toISOString(),
      },
      scenario_group_summary: buildAggregateScenarioGroupSummary(resultsWithComparisons),
      cost_summary: buildAggregateCostSummary(resultsWithComparisons),
      direct_basis_summary: buildAggregateDirectBasisSummary(resultsWithComparisons),
      law_basis_review_summary: buildAggregateLawBasisReviewSummary(resultsWithComparisons),
      results: resultsWithComparisons,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors = error.flatten().fieldErrors;

      return {
        status: "error",
        errorMessage: null,
        fieldErrors: {
          serverSlug: fieldErrors.serverSlug?.[0],
          scenarioGroup: fieldErrors.scenarioGroup?.[0],
          scenarioId: fieldErrors.scenarioId?.[0],
        },
        runSummary: null,
        scenario_group_summary: null,
        cost_summary: null,
        direct_basis_summary: null,
        law_basis_review_summary: null,
        results: [],
      };
    }

    throw error;
  }
}
