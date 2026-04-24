CREATE TYPE "CharacterAccessRequestType" AS ENUM ('advocate_access');

CREATE TYPE "CharacterAccessRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE "CharacterAccessRequest" (
    "id" TEXT NOT NULL,
    "accountId" UUID NOT NULL,
    "serverId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "requestType" "CharacterAccessRequestType" NOT NULL,
    "status" "CharacterAccessRequestStatus" NOT NULL DEFAULT 'pending',
    "requestComment" TEXT,
    "reviewComment" TEXT,
    "reviewedByAccountId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CharacterAccessRequest_accountId_createdAt_idx"
ON "CharacterAccessRequest"("accountId", "createdAt");

CREATE INDEX "CharacterAccessRequest_serverId_status_createdAt_idx"
ON "CharacterAccessRequest"("serverId", "status", "createdAt");

CREATE INDEX "CharacterAccessRequest_characterId_requestType_status_createdAt_idx"
ON "CharacterAccessRequest"("characterId", "requestType", "status", "createdAt");

CREATE INDEX "CharacterAccessRequest_reviewedByAccountId_reviewedAt_idx"
ON "CharacterAccessRequest"("reviewedByAccountId", "reviewedAt");

ALTER TABLE "CharacterAccessRequest"
ADD CONSTRAINT "CharacterAccessRequest_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CharacterAccessRequest"
ADD CONSTRAINT "CharacterAccessRequest_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CharacterAccessRequest"
ADD CONSTRAINT "CharacterAccessRequest_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CharacterAccessRequest"
ADD CONSTRAINT "CharacterAccessRequest_reviewedByAccountId_fkey"
FOREIGN KEY ("reviewedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
