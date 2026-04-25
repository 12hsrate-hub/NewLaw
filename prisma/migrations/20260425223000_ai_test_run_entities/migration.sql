CREATE TYPE "AITestRunStatus" AS ENUM ('running', 'success', 'failure');

CREATE TYPE "AITestRunResultStatus" AS ENUM ('success', 'failure', 'unavailable');

CREATE TABLE "AITestScenario" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "inputText" TEXT NOT NULL,
  "expectedBehavior" TEXT NOT NULL,
  "scenarioGroup" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "actorContext" TEXT NOT NULL,
  "answerMode" TEXT NOT NULL,
  "targetFlow" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AITestScenario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AITestRun" (
  "id" TEXT NOT NULL,
  "startedByAccountId" UUID NOT NULL,
  "serverId" TEXT NOT NULL,
  "lawVersion" TEXT NOT NULL,
  "status" "AITestRunStatus" NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AITestRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AITestRunResult" (
  "id" TEXT NOT NULL,
  "testRunId" TEXT NOT NULL,
  "testScenarioId" TEXT NOT NULL,
  "aiGenerationId" TEXT,
  "status" "AITestRunResultStatus" NOT NULL,
  "riskLevel" TEXT,
  "passedBasicChecks" BOOLEAN NOT NULL,
  "sentToReview" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AITestRunResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AITestRunResult_aiGenerationId_key" ON "AITestRunResult"("aiGenerationId");
CREATE UNIQUE INDEX "AITestRunResult_testRunId_testScenarioId_key" ON "AITestRunResult"("testRunId", "testScenarioId");

CREATE INDEX "AITestScenario_scenarioGroup_isActive_idx" ON "AITestScenario"("scenarioGroup", "isActive");
CREATE INDEX "AITestScenario_targetFlow_isActive_idx" ON "AITestScenario"("targetFlow", "isActive");
CREATE INDEX "AITestRun_startedByAccountId_startedAt_idx" ON "AITestRun"("startedByAccountId", "startedAt");
CREATE INDEX "AITestRun_serverId_startedAt_idx" ON "AITestRun"("serverId", "startedAt");
CREATE INDEX "AITestRun_status_startedAt_idx" ON "AITestRun"("status", "startedAt");
CREATE INDEX "AITestRunResult_status_createdAt_idx" ON "AITestRunResult"("status", "createdAt");
CREATE INDEX "AITestRunResult_riskLevel_createdAt_idx" ON "AITestRunResult"("riskLevel", "createdAt");
CREATE INDEX "AITestRunResult_sentToReview_createdAt_idx" ON "AITestRunResult"("sentToReview", "createdAt");

ALTER TABLE "AITestRun"
ADD CONSTRAINT "AITestRun_startedByAccountId_fkey"
FOREIGN KEY ("startedByAccountId") REFERENCES "Account"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AITestRun"
ADD CONSTRAINT "AITestRun_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AITestRunResult"
ADD CONSTRAINT "AITestRunResult_testRunId_fkey"
FOREIGN KEY ("testRunId") REFERENCES "AITestRun"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AITestRunResult"
ADD CONSTRAINT "AITestRunResult_testScenarioId_fkey"
FOREIGN KEY ("testScenarioId") REFERENCES "AITestScenario"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AITestRunResult"
ADD CONSTRAINT "AITestRunResult_aiGenerationId_fkey"
FOREIGN KEY ("aiGenerationId") REFERENCES "AIRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
