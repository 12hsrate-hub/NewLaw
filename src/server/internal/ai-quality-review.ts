import { listRecentAIRequests } from "@/db/repositories/ai-request.repository";

type ReviewQueuePriority = "low" | "medium" | "high";
type ReviewRootCause =
  | "normalization_issue"
  | "law_basis_issue"
  | "availability_issue"
  | "input_quality_issue"
  | "generation_issue"
  | "unknown";

export type InternalAIQualityReviewQueueItem = {
  id: string;
  createdAt: string;
  featureKey: string;
  model: string | null;
  status: "success" | "failure" | "unavailable";
  queueForSuperAdmin: boolean;
  priority: ReviewQueuePriority;
  rootCause: ReviewRootCause;
  flags: string[];
  issueClusterKey: string | null;
  account: {
    id: string;
    login: string;
    email: string;
  } | null;
  server: {
    id: string;
    code: string;
    name: string;
  } | null;
  outputPreview: string | null;
};

export type InternalAIQualityReviewPreview = {
  queuedCount: number;
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  recentQueuedItems: InternalAIQualityReviewQueueItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readBoolean(value: unknown) {
  return value === true;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function toQueueItem(
  entry: Awaited<ReturnType<typeof listRecentAIRequests>>[number],
): InternalAIQualityReviewQueueItem | null {
  const responsePayloadJson = isRecord(entry.responsePayloadJson) ? entry.responsePayloadJson : null;
  const aiQualityReview = responsePayloadJson && isRecord(responsePayloadJson.ai_quality_review)
    ? responsePayloadJson.ai_quality_review
    : null;

  if (!aiQualityReview) {
    return null;
  }

  const priorityValue = readString(aiQualityReview.risk_level);
  const priority: ReviewQueuePriority =
    priorityValue === "high" || priorityValue === "medium" ? priorityValue : "low";
  const rootCauseValue = readString(aiQualityReview.root_cause);
  const rootCause: ReviewRootCause =
    rootCauseValue === "normalization_issue" ||
    rootCauseValue === "law_basis_issue" ||
    rootCauseValue === "availability_issue" ||
    rootCauseValue === "input_quality_issue" ||
    rootCauseValue === "generation_issue"
      ? rootCauseValue
      : "unknown";
  const caseChain = isRecord(aiQualityReview.case_chain) ? aiQualityReview.case_chain : null;

  return {
    id: entry.id,
    createdAt: entry.createdAt.toISOString(),
    featureKey: entry.featureKey,
    model: entry.model,
    status: entry.status,
    queueForSuperAdmin: readBoolean(aiQualityReview.queue_for_super_admin),
    priority,
    rootCause,
    flags: readStringArray(aiQualityReview.flags),
    issueClusterKey: readString(aiQualityReview.issue_cluster_key),
    account: entry.account
      ? {
          id: entry.account.id,
          login: entry.account.login,
          email: entry.account.email,
        }
      : null,
    server: entry.server
      ? {
          id: entry.server.id,
          code: entry.server.code,
          name: entry.server.name,
        }
      : null,
    outputPreview: caseChain ? readString(caseChain.final_output_preview) : null,
  };
}

export async function getInternalAIQualityReviewPreview(): Promise<InternalAIQualityReviewPreview> {
  const recentRequests = await listRecentAIRequests({ take: 100 });
  const reviewItems = recentRequests.map(toQueueItem).filter((item) => item !== null);
  const queuedItems = reviewItems.filter((item) => item.queueForSuperAdmin);

  return {
    queuedCount: queuedItems.length,
    byPriority: {
      high: queuedItems.filter((item) => item.priority === "high").length,
      medium: queuedItems.filter((item) => item.priority === "medium").length,
      low: queuedItems.filter((item) => item.priority === "low").length,
    },
    recentQueuedItems: queuedItems.slice(0, 5),
  };
}
