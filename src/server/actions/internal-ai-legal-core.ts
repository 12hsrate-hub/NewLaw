"use server";

import { ZodError, z } from "zod";

import { getServerByCode } from "@/db/repositories/server.repository";
import { requireSuperAdminAccountContext } from "@/server/auth/protected";
import {
  legalCoreActorContexts,
  legalCoreResponseModes,
} from "@/server/legal-core/metadata";
import {
  aiLegalCoreScenarioGroupKeys,
  getAILegalCoreTestScenarioById,
  listActiveAILegalCoreTestScenariosByGroup,
  type AILegalCoreScenarioGroupKey,
  type AILegalCoreScenarioTargetFlow,
  type AILegalCoreTestScenario,
} from "@/server/legal-core/test-scenarios-registry";
import { runInternalDocumentTextImprovementScenario } from "@/server/legal-core/internal-document-text-improvement";
import { generateServerLegalAssistantAnswer } from "@/server/legal-assistant/answer-pipeline";
import {
  getAILegalCoreScenarioComparisons,
  type AILegalCoreScenarioComparison,
} from "@/server/internal/ai-legal-core-history";

const RUN_GROUP_SCENARIO_LIMIT = 4;

const runTargetSchema = z.enum(["scenario", "group"]);
const lawVersionSelectionSchema = z.literal("current_snapshot_only");

const aiLegalCoreTestRunInputSchema = z.object({
  serverSlug: z.string().trim().min(1).max(64),
  lawVersionSelection: lawVersionSelectionSchema,
  actorContext: z.enum(legalCoreActorContexts),
  answerMode: z.enum(legalCoreResponseModes),
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
  status: "answered" | "no_norms" | "no_corpus" | "unavailable" | "error";
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
  results: InternalAILegalCoreTestRunResult[];
};

type InternalAILegalCoreActionDependencies = {
  requireSuperAdminAccountContext: typeof requireSuperAdminAccountContext;
  getServerByCode: typeof getServerByCode;
  generateServerLegalAssistantAnswer: typeof generateServerLegalAssistantAnswer;
  runInternalDocumentTextImprovementScenario: typeof runInternalDocumentTextImprovementScenario;
  getAILegalCoreScenarioComparisons: typeof getAILegalCoreScenarioComparisons;
  now: () => Date;
  createId: () => string;
};

const defaultDependencies: InternalAILegalCoreActionDependencies = {
  requireSuperAdminAccountContext,
  getServerByCode,
  generateServerLegalAssistantAnswer,
  runInternalDocumentTextImprovementScenario,
  getAILegalCoreScenarioComparisons,
  now: () => new Date(),
  createId: () => crypto.randomUUID(),
};

function readMetadataObject(metadata: Record<string, unknown> | null | undefined) {
  return metadata && typeof metadata === "object" ? metadata : null;
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
      comparison: null,
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
    message: input.result.message,
    answer: null,
    rewrite: null,
    technical: readTechnicalSnapshot(input.result.metadata),
    comparison: null,
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
      message: null,
      answer: null,
      rewrite: {
        sourceText: input.result.sourceText,
        suggestionText: input.result.suggestionText,
        metadata: input.result.metadata,
      },
      technical: readTechnicalSnapshot(input.result.metadata),
      comparison: null,
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
    message: input.result.message,
    answer: null,
    rewrite: null,
    technical: readTechnicalSnapshot(input.result.metadata),
    comparison: null,
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
    comparison: null,
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
        results: [],
      };
    }

    const scenarios = selectScenariosForRun(parsed);

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
        results: [],
      };
    }

    const testRunId = dependencies.createId();
    const results: InternalAILegalCoreTestRunResult[] = [];

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
              test_run_id: testRunId,
              test_scenario_id: scenario.id,
              test_scenario_group: scenario.scenarioGroup,
              test_scenario_title: scenario.title,
              law_version_selection: parsed.lawVersionSelection,
            },
          });

          results.push(
            buildActionResultFromScenario({
              scenario,
              result,
            }),
          );
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
              test_run_id: testRunId,
              test_scenario_id: scenario.id,
              test_scenario_group: scenario.scenarioGroup,
              test_scenario_title: scenario.title,
              law_version_selection: parsed.lawVersionSelection,
            },
          });

          results.push(
            buildRewriteResultFromScenario({
              scenario,
              result,
            }),
          );
        }
      } catch {
        results.push(
          buildErrorResultFromScenario(
            scenario,
            "Во время прогона этого сценария произошла внутренняя ошибка.",
          ),
        );
      }
    }

    const comparisons = await dependencies.getAILegalCoreScenarioComparisons({
      scenarioIds: results.map((result) => result.scenarioId),
    });
    const resultsWithComparisons = results.map((result) => ({
      ...result,
      comparison: comparisons.get(result.scenarioId) ?? null,
    }));

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
        results: [],
      };
    }

    throw error;
  }
}
