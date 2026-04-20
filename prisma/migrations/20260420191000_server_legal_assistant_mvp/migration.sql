-- CreateEnum
CREATE TYPE "AIRequestStatus" AS ENUM ('success', 'failure', 'unavailable');

-- CreateEnum
CREATE TYPE "AssistantGuestAnswerStatus" AS ENUM ('answered', 'no_norms');

-- CreateTable
CREATE TABLE "AssistantGuestSession" (
  "id" TEXT NOT NULL,
  "guestToken" TEXT NOT NULL,
  "ipHash" TEXT NOT NULL,
  "userAgentHash" TEXT NOT NULL,
  "usedFreeQuestionAt" TIMESTAMP(3),
  "lastServerId" TEXT,
  "questionText" TEXT,
  "answerMarkdown" TEXT,
  "answerMetadataJson" JSONB,
  "answerStatus" "AssistantGuestAnswerStatus",
  "lastAnsweredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AssistantGuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRequest" (
  "id" TEXT NOT NULL,
  "accountId" UUID,
  "serverId" TEXT,
  "guestSessionId" TEXT,
  "featureKey" TEXT NOT NULL,
  "providerKey" TEXT,
  "proxyKey" TEXT,
  "model" TEXT,
  "requestPayloadJson" JSONB,
  "responsePayloadJson" JSONB,
  "status" "AIRequestStatus" NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AIRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantGuestSession_guestToken_key" ON "AssistantGuestSession"("guestToken");

-- CreateIndex
CREATE INDEX "AssistantGuestSession_ipHash_userAgentHash_usedFreeQuestionAt_idx" ON "AssistantGuestSession"("ipHash", "userAgentHash", "usedFreeQuestionAt");

-- CreateIndex
CREATE INDEX "AssistantGuestSession_lastServerId_usedFreeQuestionAt_idx" ON "AssistantGuestSession"("lastServerId", "usedFreeQuestionAt");

-- CreateIndex
CREATE INDEX "AIRequest_featureKey_createdAt_idx" ON "AIRequest"("featureKey", "createdAt");

-- CreateIndex
CREATE INDEX "AIRequest_accountId_createdAt_idx" ON "AIRequest"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRequest_serverId_createdAt_idx" ON "AIRequest"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRequest_guestSessionId_createdAt_idx" ON "AIRequest"("guestSessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssistantGuestSession"
ADD CONSTRAINT "AssistantGuestSession_lastServerId_fkey"
FOREIGN KEY ("lastServerId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRequest"
ADD CONSTRAINT "AIRequest_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRequest"
ADD CONSTRAINT "AIRequest_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRequest"
ADD CONSTRAINT "AIRequest_guestSessionId_fkey"
FOREIGN KEY ("guestSessionId") REFERENCES "AssistantGuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
