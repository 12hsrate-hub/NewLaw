-- CreateEnum
CREATE TYPE "PrecedentSourceTopicDiscoveryStatus" AS ENUM ('running', 'success', 'failure');

-- CreateEnum
CREATE TYPE "PrecedentSourceTopicClassification" AS ENUM ('precedent', 'ignored');

-- CreateEnum
CREATE TYPE "PrecedentVersionStatus" AS ENUM ('imported_draft', 'current', 'superseded');

-- CreateEnum
CREATE TYPE "PrecedentValidityStatus" AS ENUM ('applicable', 'limited', 'obsolete');

-- CreateEnum
CREATE TYPE "PrecedentBlockType" AS ENUM ('facts', 'issue', 'holding', 'reasoning', 'resolution', 'unstructured');

-- CreateTable
CREATE TABLE "PrecedentSourceTopic" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "sourceIndexId" TEXT NOT NULL,
  "topicUrl" TEXT NOT NULL,
  "topicExternalId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "isExcluded" BOOLEAN NOT NULL DEFAULT false,
  "classificationOverride" "PrecedentSourceTopicClassification",
  "internalNote" TEXT,
  "lastDiscoveredAt" TIMESTAMP(3),
  "lastDiscoveryStatus" "PrecedentSourceTopicDiscoveryStatus",
  "lastDiscoveryError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PrecedentSourceTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Precedent" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "precedentSourceTopicId" TEXT NOT NULL,
  "precedentKey" TEXT NOT NULL,
  "displayTitle" TEXT NOT NULL,
  "precedentLocatorKey" TEXT NOT NULL,
  "currentVersionId" TEXT,
  "validityStatus" "PrecedentValidityStatus" NOT NULL DEFAULT 'applicable',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Precedent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecedentVersion" (
  "id" TEXT NOT NULL,
  "precedentId" TEXT NOT NULL,
  "status" "PrecedentVersionStatus" NOT NULL DEFAULT 'imported_draft',
  "normalizedFullText" TEXT NOT NULL,
  "sourceSnapshotHash" TEXT NOT NULL,
  "normalizedTextHash" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "confirmedByAccountId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PrecedentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecedentSourcePost" (
  "id" TEXT NOT NULL,
  "precedentVersionId" TEXT NOT NULL,
  "postExternalId" TEXT NOT NULL,
  "postUrl" TEXT NOT NULL,
  "postOrder" INTEGER NOT NULL,
  "authorName" TEXT,
  "postedAt" TIMESTAMP(3),
  "rawHtml" TEXT NOT NULL,
  "rawText" TEXT NOT NULL,
  "normalizedTextFragment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PrecedentSourcePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecedentBlock" (
  "id" TEXT NOT NULL,
  "precedentVersionId" TEXT NOT NULL,
  "blockType" "PrecedentBlockType" NOT NULL,
  "blockOrder" INTEGER NOT NULL,
  "blockTitle" TEXT,
  "blockText" TEXT NOT NULL,
  "parentBlockId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PrecedentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrecedentSourceTopic_serverId_topicExternalId_key" ON "PrecedentSourceTopic"("serverId", "topicExternalId");

-- CreateIndex
CREATE INDEX "PrecedentSourceTopic_serverId_isExcluded_idx" ON "PrecedentSourceTopic"("serverId", "isExcluded");

-- CreateIndex
CREATE INDEX "PrecedentSourceTopic_sourceIndexId_createdAt_idx" ON "PrecedentSourceTopic"("sourceIndexId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Precedent_serverId_precedentKey_key" ON "Precedent"("serverId", "precedentKey");

-- CreateIndex
CREATE UNIQUE INDEX "Precedent_precedentSourceTopicId_precedentLocatorKey_key" ON "Precedent"("precedentSourceTopicId", "precedentLocatorKey");

-- CreateIndex
CREATE UNIQUE INDEX "Precedent_currentVersionId_key" ON "Precedent"("currentVersionId");

-- CreateIndex
CREATE INDEX "Precedent_serverId_validityStatus_idx" ON "Precedent"("serverId", "validityStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PrecedentVersion_precedentId_normalizedTextHash_key" ON "PrecedentVersion"("precedentId", "normalizedTextHash");

-- CreateIndex
CREATE INDEX "PrecedentVersion_precedentId_status_importedAt_idx" ON "PrecedentVersion"("precedentId", "status", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrecedentSourcePost_precedentVersionId_postExternalId_key" ON "PrecedentSourcePost"("precedentVersionId", "postExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "PrecedentSourcePost_precedentVersionId_postOrder_key" ON "PrecedentSourcePost"("precedentVersionId", "postOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PrecedentBlock_precedentVersionId_blockOrder_key" ON "PrecedentBlock"("precedentVersionId", "blockOrder");

-- CreateIndex
CREATE INDEX "PrecedentBlock_precedentVersionId_blockType_blockOrder_idx" ON "PrecedentBlock"("precedentVersionId", "blockType", "blockOrder");

-- AddForeignKey
ALTER TABLE "PrecedentSourceTopic"
ADD CONSTRAINT "PrecedentSourceTopic_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecedentSourceTopic"
ADD CONSTRAINT "PrecedentSourceTopic_sourceIndexId_fkey"
FOREIGN KEY ("sourceIndexId") REFERENCES "LawSourceIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Precedent"
ADD CONSTRAINT "Precedent_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Precedent"
ADD CONSTRAINT "Precedent_precedentSourceTopicId_fkey"
FOREIGN KEY ("precedentSourceTopicId") REFERENCES "PrecedentSourceTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecedentVersion"
ADD CONSTRAINT "PrecedentVersion_precedentId_fkey"
FOREIGN KEY ("precedentId") REFERENCES "Precedent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecedentVersion"
ADD CONSTRAINT "PrecedentVersion_confirmedByAccountId_fkey"
FOREIGN KEY ("confirmedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Precedent"
ADD CONSTRAINT "Precedent_currentVersionId_fkey"
FOREIGN KEY ("currentVersionId") REFERENCES "PrecedentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecedentSourcePost"
ADD CONSTRAINT "PrecedentSourcePost_precedentVersionId_fkey"
FOREIGN KEY ("precedentVersionId") REFERENCES "PrecedentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecedentBlock"
ADD CONSTRAINT "PrecedentBlock_precedentVersionId_fkey"
FOREIGN KEY ("precedentVersionId") REFERENCES "PrecedentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecedentBlock"
ADD CONSTRAINT "PrecedentBlock_parentBlockId_fkey"
FOREIGN KEY ("parentBlockId") REFERENCES "PrecedentBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
