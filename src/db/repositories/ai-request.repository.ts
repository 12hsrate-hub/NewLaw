import { Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type CreateAIRequestInput = {
  accountId?: string | null;
  serverId?: string | null;
  guestSessionId?: string | null;
  featureKey: string;
  providerKey?: string | null;
  proxyKey?: string | null;
  model?: string | null;
  requestPayloadJson?: Record<string, unknown> | null;
  responsePayloadJson?: Record<string, unknown> | null;
  status: "success" | "failure" | "unavailable";
  errorMessage?: string | null;
};

export async function createAIRequest(input: CreateAIRequestInput) {
  return prisma.aIRequest.create({
    data: {
      accountId: input.accountId ?? null,
      serverId: input.serverId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      featureKey: input.featureKey,
      providerKey: input.providerKey ?? null,
      proxyKey: input.proxyKey ?? null,
      model: input.model ?? null,
      requestPayloadJson: input.requestPayloadJson
        ? (input.requestPayloadJson as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      responsePayloadJson: input.responsePayloadJson
        ? (input.responsePayloadJson as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
    },
  });
}

export async function listRecentAIRequests(input?: { take?: number }) {
  return prisma.aIRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: input?.take ?? 50,
    select: {
      id: true,
      featureKey: true,
      model: true,
      status: true,
      createdAt: true,
      requestPayloadJson: true,
      responsePayloadJson: true,
      account: {
        select: {
          id: true,
          login: true,
          email: true,
        },
      },
      server: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });
}

export async function getAIQualityReviewUsageSince(input: { since: Date }) {
  const requests = await prisma.aIRequest.findMany({
    where: {
      createdAt: {
        gte: input.since,
      },
    },
    select: {
      responsePayloadJson: true,
    },
  });

  let reviewerAttemptCount = 0;
  let reviewerCostUsd = 0;

  for (const request of requests) {
    const responsePayloadJson = isRecord(request.responsePayloadJson)
      ? request.responsePayloadJson
      : null;
    const aiQualityReview =
      responsePayloadJson && isRecord(responsePayloadJson.ai_quality_review)
        ? responsePayloadJson.ai_quality_review
        : null;
    const layers = aiQualityReview && isRecord(aiQualityReview.layers) ? aiQualityReview.layers : null;
    const aiReviewer = layers && isRecord(layers.ai_reviewer) ? layers.ai_reviewer : null;
    const status = aiReviewer?.status;

    if (
      status === "completed" ||
      status === "unavailable" ||
      status === "invalid_output"
    ) {
      reviewerAttemptCount += 1;
    }

    if (status === "completed" && aiReviewer) {
      reviewerCostUsd += readNumber(aiReviewer.cost_usd) ?? 0;
    }
  }

  return {
    reviewerAttemptCount,
    reviewerCostUsd: Number(reviewerCostUsd.toFixed(6)),
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export async function findLatestAIRequestByTestRunContext(input: {
  testRunId: string;
  testScenarioId: string;
  accountId?: string | null;
  serverId?: string | null;
  take?: number;
}) {
  const requests = await prisma.aIRequest.findMany({
    where: {
      ...(input.accountId ? { accountId: input.accountId } : {}),
      ...(input.serverId ? { serverId: input.serverId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 30,
    select: {
      id: true,
      createdAt: true,
      requestPayloadJson: true,
      responsePayloadJson: true,
    },
  });

  for (const request of requests) {
    const requestPayloadJson = isRecord(request.requestPayloadJson) ? request.requestPayloadJson : null;
    const testRunContext =
      requestPayloadJson && isRecord(requestPayloadJson.test_run_context)
        ? requestPayloadJson.test_run_context
        : null;

    if (!testRunContext) {
      continue;
    }

    if (
      readString(testRunContext.test_run_id) === input.testRunId &&
      readString(testRunContext.test_scenario_id) === input.testScenarioId
    ) {
      return request;
    }
  }

  return null;
}
