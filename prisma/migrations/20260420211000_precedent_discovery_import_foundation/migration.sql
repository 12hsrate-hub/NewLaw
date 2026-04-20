-- CreateEnum
CREATE TYPE "PrecedentImportRunStatus" AS ENUM ('running', 'success', 'failure');

-- CreateEnum
CREATE TYPE "PrecedentImportRunMode" AS ENUM ('discovery', 'import_source_topic');

-- CreateTable
CREATE TABLE "PrecedentImportRun" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "sourceIndexId" TEXT,
  "sourceTopicId" TEXT,
  "mode" "PrecedentImportRunMode" NOT NULL,
  "status" "PrecedentImportRunStatus" NOT NULL,
  "lockKey" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "summary" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PrecedentImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrecedentImportRun_lockKey_key" ON "PrecedentImportRun"("lockKey");

-- CreateIndex
CREATE INDEX "PrecedentImportRun_serverId_status_startedAt_idx" ON "PrecedentImportRun"("serverId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "PrecedentImportRun_sourceIndexId_status_startedAt_idx" ON "PrecedentImportRun"("sourceIndexId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "PrecedentImportRun_sourceTopicId_status_startedAt_idx" ON "PrecedentImportRun"("sourceTopicId", "status", "startedAt");

-- AddForeignKey
ALTER TABLE "PrecedentImportRun"
ADD CONSTRAINT "PrecedentImportRun_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecedentImportRun"
ADD CONSTRAINT "PrecedentImportRun_sourceIndexId_fkey"
FOREIGN KEY ("sourceIndexId") REFERENCES "LawSourceIndex"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecedentImportRun"
ADD CONSTRAINT "PrecedentImportRun_sourceTopicId_fkey"
FOREIGN KEY ("sourceTopicId") REFERENCES "PrecedentSourceTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
