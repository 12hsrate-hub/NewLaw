import { Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";

type CreateAssistantGuestSessionInput = {
  guestToken: string;
  ipHash: string;
  userAgentHash: string;
};

type SaveAssistantGuestAnswerInput = {
  sessionId: string;
  serverId: string;
  questionText: string;
  answerMarkdown: string;
  answerMetadataJson: Record<string, unknown>;
  answerStatus: "answered" | "no_norms";
  answeredAt: Date;
};

export async function getAssistantGuestSessionByToken(guestToken: string) {
  return prisma.assistantGuestSession.findUnique({
    where: {
      guestToken,
    },
  });
}

export async function findAssistantGuestSessionByFingerprint(input: {
  ipHash: string;
  userAgentHash: string;
}) {
  return prisma.assistantGuestSession.findFirst({
    where: {
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
    },
    orderBy: [{ usedFreeQuestionAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createAssistantGuestSession(input: CreateAssistantGuestSessionInput) {
  return prisma.assistantGuestSession.create({
    data: {
      guestToken: input.guestToken,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
    },
  });
}

export async function saveAssistantGuestAnswer(input: SaveAssistantGuestAnswerInput) {
  return prisma.assistantGuestSession.update({
    where: {
      id: input.sessionId,
    },
    data: {
      lastServerId: input.serverId,
      questionText: input.questionText,
      answerMarkdown: input.answerMarkdown,
      answerMetadataJson: input.answerMetadataJson as Prisma.InputJsonValue,
      answerStatus: input.answerStatus,
      lastAnsweredAt: input.answeredAt,
      usedFreeQuestionAt: input.answeredAt,
    },
  });
}
