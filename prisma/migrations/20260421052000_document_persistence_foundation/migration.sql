-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ogp_complaint', 'rehabilitation', 'lawsuit');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'generated', 'published');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "accountId" UUID NOT NULL,
    "serverId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'draft',
    "formSchemaVersion" TEXT NOT NULL,
    "snapshotCapturedAt" TIMESTAMP(3) NOT NULL,
    "authorSnapshotJson" JSONB NOT NULL,
    "formPayloadJson" JSONB,
    "lastGeneratedBbcode" TEXT,
    "generatedAt" TIMESTAMP(3),
    "generatedLawVersion" TEXT,
    "generatedTemplateVersion" TEXT,
    "generatedFormSchemaVersion" TEXT,
    "publicationUrl" TEXT,
    "isSiteForumSynced" BOOLEAN NOT NULL DEFAULT false,
    "isModifiedAfterGeneration" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_accountId_createdAt_idx" ON "Document"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_accountId_serverId_documentType_createdAt_idx" ON "Document"("accountId", "serverId", "documentType", "createdAt");

-- CreateIndex
CREATE INDEX "Document_serverId_documentType_status_createdAt_idx" ON "Document"("serverId", "documentType", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
