import {
  getAIBehaviorRulesRegistry,
  getAIFixInstructionTemplate,
} from "@/server/legal-core/behavior-rules-registry";
import {
  getAIConfirmedIssuesRegistry,
  type AIConfirmedIssue,
} from "@/server/legal-core/confirmed-issues-registry";
import {
  getAIRegressionGateItems,
  getAIRegressionGateRules,
} from "@/server/legal-core/regression-gate";
import { getInternalAIQualityReviewPreview } from "@/server/internal/ai-quality-review";

type InternalAIReviewServerAdminView = {
  accessRole: "server_admin";
  visibility: "anonymized_statistics";
  queuedCount: number;
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  analytics: Awaited<ReturnType<typeof getInternalAIQualityReviewPreview>>["analytics"];
};

type InternalAIReviewTesterExample = {
  id: string;
  featureKey: string;
  priority: "low" | "medium" | "high";
  rootCause: string;
  flags: string[];
  reviewItems: string[];
  issueClusterKey: string | null;
  availableChain: {
    hasRawInput: boolean;
    hasNormalizedInput: boolean;
    retrievedSourcesCount: number;
    hasFinalOutput: boolean;
  };
};

type InternalAIReviewTesterView = {
  accessRole: "tester";
  visibility: "sanitized_test_examples";
  examples: InternalAIReviewTesterExample[];
};

export type InternalAIReviewPageContext = {
  reviewPreview: Awaited<ReturnType<typeof getInternalAIQualityReviewPreview>>;
  accessViews: {
    superAdmin: {
      accessRole: "super_admin";
      visibility: "full_raw";
    };
    serverAdmin: InternalAIReviewServerAdminView;
    tester: InternalAIReviewTesterView;
  };
  behaviorRules: ReturnType<typeof getAIBehaviorRulesRegistry>;
  confirmedIssues: AIConfirmedIssue[];
  fixInstructionTemplate: ReturnType<typeof getAIFixInstructionTemplate>;
  regressionGateItems: ReturnType<typeof getAIRegressionGateItems>;
  regressionGateRules: ReturnType<typeof getAIRegressionGateRules>;
  workflowNotes: string[];
};

function buildServerAdminView(
  reviewPreview: Awaited<ReturnType<typeof getInternalAIQualityReviewPreview>>,
): InternalAIReviewServerAdminView {
  return {
    accessRole: "server_admin",
    visibility: "anonymized_statistics",
    queuedCount: reviewPreview.queuedCount,
    byPriority: reviewPreview.byPriority,
    analytics: reviewPreview.analytics,
  };
}

function buildTesterView(
  reviewPreview: Awaited<ReturnType<typeof getInternalAIQualityReviewPreview>>,
): InternalAIReviewTesterView {
  return {
    accessRole: "tester",
    visibility: "sanitized_test_examples",
    examples: reviewPreview.recentQueuedItems.map((item) => ({
      id: item.id,
      featureKey: item.featureKey,
      priority: item.priority,
      rootCause: item.rootCause,
      flags: item.flags,
      reviewItems: item.reviewItems,
      issueClusterKey: item.issueClusterKey,
      availableChain: {
        hasRawInput: item.caseChain.rawInput !== null,
        hasNormalizedInput: item.caseChain.normalizedInput !== null,
        retrievedSourcesCount: item.caseChain.retrievedSources.length,
        hasFinalOutput: item.caseChain.finalOutputPreview !== null || item.outputPreview !== null,
      },
    })),
  };
}

export async function getInternalAIReviewPageContext(): Promise<InternalAIReviewPageContext> {
  const reviewPreview = await getInternalAIQualityReviewPreview();

  return {
    reviewPreview,
    accessViews: {
      superAdmin: {
        accessRole: "super_admin",
        visibility: "full_raw",
      },
      serverAdmin: buildServerAdminView(reviewPreview),
      tester: buildTesterView(reviewPreview),
    },
    behaviorRules: getAIBehaviorRulesRegistry(),
    confirmedIssues: getAIConfirmedIssuesRegistry(),
    fixInstructionTemplate: getAIFixInstructionTemplate(),
    regressionGateItems: getAIRegressionGateItems(),
    regressionGateRules: getAIRegressionGateRules(),
    workflowNotes: [
      "Подтверждённая проблема не считается закрытой без fix_instruction и regression follow-up.",
      "AI Behavior Rules остаются repo-managed source of truth и меняются только через PR и commit.",
      "AI Quality Review не меняет production-логику автоматически даже при high-risk кейсе.",
    ],
  };
}
