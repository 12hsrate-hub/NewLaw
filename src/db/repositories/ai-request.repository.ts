import { Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";

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
