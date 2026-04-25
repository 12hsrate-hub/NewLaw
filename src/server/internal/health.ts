import { listLawSourceIndexes } from "@/db/repositories/law-source-index.repository";
import { listPrecedentSourceTopicsForAdminReview } from "@/db/repositories/precedent-source-topic.repository";
import { listServerDirectoryServers } from "@/db/repositories/server.repository";
import { getAIQualityReviewRuntimeEnv } from "@/schemas/env";
import { getHealthPayload } from "@/server/http/health";
import { getInternalAIQualityReviewPreview } from "@/server/internal/ai-quality-review";
import {
  resolveAssistantStatus,
  type ServerAssistantStatus,
} from "@/server/server-directory/context";

type InternalHealthWarning = {
  level: "warning";
  message: string;
};

export type InternalHealthRuntimeSummary = ReturnType<typeof getHealthPayload>;

export type InternalHealthAIQualityReviewSummary = {
  enabled: boolean;
  mode: "off" | "log_only" | "full";
  dailyRequestLimit: number | null;
  dailyCostLimitUsd: number | null;
};

export type InternalHealthServerSummary = {
  id: string;
  code: string;
  slug: string;
  name: string;
  assistantStatus: ServerAssistantStatus;
  currentPrimaryLawCount: number;
  enabledLawSourceCount: number;
  totalLawSourceCount: number;
  precedentTopicCount: number;
  currentPrecedentCount: number;
  warnings: InternalHealthWarning[];
};

export type InternalHealthContext = {
  runtime: InternalHealthRuntimeSummary;
  aiQualityReview: InternalHealthAIQualityReviewSummary;
  aiQualityReviewPreview: Awaited<ReturnType<typeof getInternalAIQualityReviewPreview>>;
  serverSummaries: InternalHealthServerSummary[];
  warnings: InternalHealthWarning[];
};

function buildServerWarnings(input: {
  assistantStatus: ServerAssistantStatus;
  hasLawDiscoveryFailure: boolean;
  hasPrecedentDiscoveryFailure: boolean;
  hasPrecedentImportFailure: boolean;
}): InternalHealthWarning[] {
  const warnings: InternalHealthWarning[] = [];

  switch (input.assistantStatus) {
    case "no_corpus":
      warnings.push({
        level: "warning",
        message: "Нет usable corpus для normal assistant flow.",
      });
      break;
    case "corpus_bootstrap_incomplete":
      warnings.push({
        level: "warning",
        message: "Corpus собран частично и ещё не считается fully ready.",
      });
      break;
    case "corpus_stale":
      warnings.push({
        level: "warning",
        message: "Corpus помечен как stale и требует внимания.",
      });
      break;
    case "assistant_disabled":
      warnings.push({
        level: "warning",
        message: "Assistant по серверу сейчас отключён.",
      });
      break;
    case "maintenance_mode":
      warnings.push({
        level: "warning",
        message: "Сервер находится в maintenance mode.",
      });
      break;
    case "current_corpus_ready":
      break;
  }

  if (input.hasLawDiscoveryFailure) {
    warnings.push({
      level: "warning",
      message: "Есть recent law discovery failure.",
    });
  }

  if (input.hasPrecedentDiscoveryFailure) {
    warnings.push({
      level: "warning",
      message: "Есть recent precedent discovery failure.",
    });
  }

  if (input.hasPrecedentImportFailure) {
    warnings.push({
      level: "warning",
      message: "Есть recent precedent import failure.",
    });
  }

  return warnings;
}

export async function getInternalHealthContext(): Promise<InternalHealthContext> {
  const [runtime, servers, sourceIndexes, precedentSourceTopics, aiQualityReviewPreview] =
    await Promise.all([
    getHealthPayload(),
    listServerDirectoryServers(),
    listLawSourceIndexes(),
    listPrecedentSourceTopicsForAdminReview(),
    getInternalAIQualityReviewPreview(),
  ]);
  const aiQualityReviewRuntime = getAIQualityReviewRuntimeEnv();
  const aiQualityReview = {
    enabled:
      aiQualityReviewRuntime.AI_REVIEW_ENABLED && aiQualityReviewRuntime.AI_REVIEW_MODE !== "off",
    mode: aiQualityReviewRuntime.AI_REVIEW_MODE,
    dailyRequestLimit: aiQualityReviewRuntime.AI_REVIEW_DAILY_REQUEST_LIMIT ?? null,
    dailyCostLimitUsd: aiQualityReviewRuntime.AI_REVIEW_DAILY_COST_LIMIT_USD ?? null,
  } satisfies InternalHealthAIQualityReviewSummary;
  const globalWarnings: InternalHealthWarning[] = [];

  if (!aiQualityReview.enabled || aiQualityReview.mode === "off") {
    globalWarnings.push({
      level: "warning",
      message: "AI Quality Review bootstrap сейчас выключен.",
    });
  } else if (aiQualityReview.mode === "log_only") {
    globalWarnings.push({
      level: "warning",
      message: "AI Quality Review работает только в log_only режиме без полной очереди для super_admin.",
    });
  }

  if (aiQualityReview.dailyRequestLimit === null && aiQualityReview.dailyCostLimitUsd === null) {
    globalWarnings.push({
      level: "warning",
      message: "AI Quality Review bootstrap запущен без configured daily limits.",
    });
  }

  const serverSummaries = servers.map((server) => {
    const assistantStatus = resolveAssistantStatus(server);
    const serverLawSourceIndexes = sourceIndexes.filter(
      (sourceIndex) => sourceIndex.serverId === server.id,
    );
    const serverPrecedentSourceTopics = precedentSourceTopics.filter(
      (sourceTopic) => sourceTopic.serverId === server.id,
    );
    const hasLawDiscoveryFailure = serverLawSourceIndexes.some(
      (sourceIndex) =>
        sourceIndex.isEnabled && sourceIndex.lastDiscoveryStatus === "failure",
    );
    const hasPrecedentDiscoveryFailure = serverPrecedentSourceTopics.some(
      (sourceTopic) => sourceTopic.lastDiscoveryStatus === "failure",
    );
    const hasPrecedentImportFailure = serverPrecedentSourceTopics.some(
      (sourceTopic) => sourceTopic.importRuns[0]?.status === "failure",
    );
    const currentPrimaryLawCount = server.laws.filter(
      (law) =>
        law.lawKind === "primary" &&
        !law.isExcluded &&
        law.classificationOverride !== "supplement" &&
        law.currentVersionId,
    ).length;
    const currentPrecedentCount = serverPrecedentSourceTopics.reduce(
      (count, sourceTopic) =>
        count +
        sourceTopic.precedents.filter(
          (precedent) =>
            precedent.currentVersionId &&
            (precedent.validityStatus === "applicable" ||
              precedent.validityStatus === "limited"),
        ).length,
      0,
    );

    const warnings = buildServerWarnings({
      assistantStatus,
      hasLawDiscoveryFailure,
      hasPrecedentDiscoveryFailure,
      hasPrecedentImportFailure,
    });

    return {
      id: server.id,
      code: server.code,
      slug: server.code,
      name: server.name,
      assistantStatus,
      currentPrimaryLawCount,
      enabledLawSourceCount: serverLawSourceIndexes.filter(
        (sourceIndex) => sourceIndex.isEnabled,
      ).length,
      totalLawSourceCount: serverLawSourceIndexes.length,
      precedentTopicCount: serverPrecedentSourceTopics.length,
      currentPrecedentCount,
      warnings,
    } satisfies InternalHealthServerSummary;
  });

  return {
    runtime,
    aiQualityReview,
    aiQualityReviewPreview,
    serverSummaries,
    warnings: [
      ...globalWarnings,
      ...serverSummaries.flatMap((serverSummary) => serverSummary.warnings),
    ],
  };
}
