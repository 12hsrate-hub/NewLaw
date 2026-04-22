-- CreateEnum
CREATE TYPE "OgpForumSyncState" AS ENUM (
  'not_published',
  'current',
  'outdated',
  'failed',
  'manual_untracked'
);

-- CreateEnum
CREATE TYPE "OgpForumPublicationOperation" AS ENUM ('publish_create');

-- CreateEnum
CREATE TYPE "OgpForumPublicationAttemptStatus" AS ENUM ('started', 'succeeded', 'failed');

-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "forumLastPublishedAt" TIMESTAMP(3),
ADD COLUMN "forumLastSyncError" TEXT,
ADD COLUMN "forumPostId" TEXT,
ADD COLUMN "forumPublishedBbcodeHash" TEXT,
ADD COLUMN "forumSyncState" "OgpForumSyncState" NOT NULL DEFAULT 'not_published',
ADD COLUMN "forumThreadId" TEXT;

-- CreateTable
CREATE TABLE "OgpForumPublicationAttempt" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "accountId" UUID NOT NULL,
  "operation" "OgpForumPublicationOperation" NOT NULL,
  "status" "OgpForumPublicationAttemptStatus" NOT NULL,
  "forumThreadId" TEXT,
  "forumPostId" TEXT,
  "errorCode" TEXT,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OgpForumPublicationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_documentType_forumSyncState_createdAt_idx"
ON "Document"("documentType", "forumSyncState", "createdAt");

-- CreateIndex
CREATE INDEX "OgpForumPublicationAttempt_documentId_createdAt_idx"
ON "OgpForumPublicationAttempt"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "OgpForumPublicationAttempt_accountId_createdAt_idx"
ON "OgpForumPublicationAttempt"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "OgpForumPublicationAttempt_operation_status_createdAt_idx"
ON "OgpForumPublicationAttempt"("operation", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "OgpForumPublicationAttempt"
ADD CONSTRAINT "OgpForumPublicationAttempt_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OgpForumPublicationAttempt"
ADD CONSTRAINT "OgpForumPublicationAttempt_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
