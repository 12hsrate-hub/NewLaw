-- CreateEnum
CREATE TYPE "LawKind" AS ENUM ('primary', 'supplement');

-- CreateEnum
CREATE TYPE "LawVersionStatus" AS ENUM ('imported_draft', 'current', 'superseded');

-- CreateEnum
CREATE TYPE "LawImportRunStatus" AS ENUM ('running', 'success', 'failure');

-- CreateEnum
CREATE TYPE "LawImportRunMode" AS ENUM ('discovery', 'import_law');

-- CreateEnum
CREATE TYPE "LawBlockType" AS ENUM ('section', 'chapter', 'article', 'appendix', 'unstructured');

-- CreateTable
CREATE TABLE "LawSourceIndex" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "indexUrl" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastDiscoveredAt" TIMESTAMP(3),
  "lastDiscoveryStatus" "LawImportRunStatus",
  "lastDiscoveryError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LawSourceIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Law" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "lawKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "topicUrl" TEXT NOT NULL,
  "topicExternalId" TEXT NOT NULL,
  "lawKind" "LawKind" NOT NULL,
  "relatedPrimaryLawId" TEXT,
  "currentVersionId" TEXT,
  "isExcluded" BOOLEAN NOT NULL DEFAULT false,
  "classificationOverride" "LawKind",
  "internalNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Law_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawVersion" (
  "id" TEXT NOT NULL,
  "lawId" TEXT NOT NULL,
  "status" "LawVersionStatus" NOT NULL DEFAULT 'imported_draft',
  "normalizedFullText" TEXT NOT NULL,
  "sourceSnapshotHash" TEXT NOT NULL,
  "normalizedTextHash" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "confirmedByAccountId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LawVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawSourcePost" (
  "id" TEXT NOT NULL,
  "lawVersionId" TEXT NOT NULL,
  "postExternalId" TEXT NOT NULL,
  "postUrl" TEXT NOT NULL,
  "postOrder" INTEGER NOT NULL,
  "authorName" TEXT,
  "postedAt" TIMESTAMP(3),
  "rawHtml" TEXT NOT NULL,
  "rawText" TEXT NOT NULL,
  "normalizedTextFragment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LawSourcePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawBlock" (
  "id" TEXT NOT NULL,
  "lawVersionId" TEXT NOT NULL,
  "blockType" "LawBlockType" NOT NULL,
  "blockOrder" INTEGER NOT NULL,
  "blockTitle" TEXT,
  "blockText" TEXT NOT NULL,
  "parentBlockId" TEXT,
  "articleNumberNormalized" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LawBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawImportRun" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "sourceIndexId" TEXT,
  "mode" "LawImportRunMode" NOT NULL,
  "status" "LawImportRunStatus" NOT NULL,
  "lockKey" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "summary" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LawImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LawSourceIndex_serverId_indexUrl_key" ON "LawSourceIndex"("serverId", "indexUrl");

-- CreateIndex
CREATE INDEX "LawSourceIndex_serverId_isEnabled_idx" ON "LawSourceIndex"("serverId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Law_serverId_lawKey_key" ON "Law"("serverId", "lawKey");

-- CreateIndex
CREATE UNIQUE INDEX "Law_serverId_topicExternalId_key" ON "Law"("serverId", "topicExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "Law_currentVersionId_key" ON "Law"("currentVersionId");

-- CreateIndex
CREATE INDEX "Law_serverId_lawKind_isExcluded_idx" ON "Law"("serverId", "lawKind", "isExcluded");

-- CreateIndex
CREATE UNIQUE INDEX "LawVersion_lawId_normalizedTextHash_key" ON "LawVersion"("lawId", "normalizedTextHash");

-- CreateIndex
CREATE INDEX "LawVersion_lawId_status_importedAt_idx" ON "LawVersion"("lawId", "status", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LawSourcePost_lawVersionId_postExternalId_key" ON "LawSourcePost"("lawVersionId", "postExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "LawSourcePost_lawVersionId_postOrder_key" ON "LawSourcePost"("lawVersionId", "postOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LawBlock_lawVersionId_blockOrder_key" ON "LawBlock"("lawVersionId", "blockOrder");

-- CreateIndex
CREATE INDEX "LawBlock_lawVersionId_blockType_blockOrder_idx" ON "LawBlock"("lawVersionId", "blockType", "blockOrder");

-- CreateIndex
CREATE INDEX "LawBlock_lawVersionId_articleNumberNormalized_idx" ON "LawBlock"("lawVersionId", "articleNumberNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "LawImportRun_lockKey_key" ON "LawImportRun"("lockKey");

-- CreateIndex
CREATE INDEX "LawImportRun_serverId_status_startedAt_idx" ON "LawImportRun"("serverId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "LawImportRun_sourceIndexId_status_startedAt_idx" ON "LawImportRun"("sourceIndexId", "status", "startedAt");

-- AddForeignKey
ALTER TABLE "LawSourceIndex"
ADD CONSTRAINT "LawSourceIndex_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Law"
ADD CONSTRAINT "Law_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Law"
ADD CONSTRAINT "Law_relatedPrimaryLawId_fkey"
FOREIGN KEY ("relatedPrimaryLawId") REFERENCES "Law"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawVersion"
ADD CONSTRAINT "LawVersion_lawId_fkey"
FOREIGN KEY ("lawId") REFERENCES "Law"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawVersion"
ADD CONSTRAINT "LawVersion_confirmedByAccountId_fkey"
FOREIGN KEY ("confirmedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Law"
ADD CONSTRAINT "Law_currentVersionId_fkey"
FOREIGN KEY ("currentVersionId") REFERENCES "LawVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawSourcePost"
ADD CONSTRAINT "LawSourcePost_lawVersionId_fkey"
FOREIGN KEY ("lawVersionId") REFERENCES "LawVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawBlock"
ADD CONSTRAINT "LawBlock_lawVersionId_fkey"
FOREIGN KEY ("lawVersionId") REFERENCES "LawVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawBlock"
ADD CONSTRAINT "LawBlock_parentBlockId_fkey"
FOREIGN KEY ("parentBlockId") REFERENCES "LawBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawImportRun"
ADD CONSTRAINT "LawImportRun_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawImportRun"
ADD CONSTRAINT "LawImportRun_sourceIndexId_fkey"
FOREIGN KEY ("sourceIndexId") REFERENCES "LawSourceIndex"("id") ON DELETE SET NULL ON UPDATE CASCADE;
