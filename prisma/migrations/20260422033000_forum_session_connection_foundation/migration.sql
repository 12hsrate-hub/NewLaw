ALTER TYPE "AuditActionKey" ADD VALUE IF NOT EXISTS 'forum_connection_saved';
ALTER TYPE "AuditActionKey" ADD VALUE IF NOT EXISTS 'forum_connection_validated';
ALTER TYPE "AuditActionKey" ADD VALUE IF NOT EXISTS 'forum_connection_disabled';

CREATE TYPE "ForumConnectionState" AS ENUM (
  'connected_unvalidated',
  'valid',
  'invalid',
  'disabled'
);

CREATE TABLE "ForumSessionConnection" (
  "id" TEXT NOT NULL,
  "accountId" UUID NOT NULL,
  "providerKey" TEXT NOT NULL,
  "state" "ForumConnectionState" NOT NULL,
  "encryptedSessionPayload" TEXT,
  "forumUserId" TEXT,
  "forumUsername" TEXT,
  "validatedAt" TIMESTAMP(3),
  "lastValidationError" TEXT,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ForumSessionConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ForumSessionConnection_accountId_providerKey_key"
ON "ForumSessionConnection"("accountId", "providerKey");

CREATE INDEX "ForumSessionConnection_providerKey_state_idx"
ON "ForumSessionConnection"("providerKey", "state");

ALTER TABLE "ForumSessionConnection"
ADD CONSTRAINT "ForumSessionConnection_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
