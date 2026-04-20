-- CreateEnum
CREATE TYPE "AccountSecurityReason" AS ENUM ('admin_reset', 'security_policy');

-- CreateEnum
CREATE TYPE "AuditActionKey" AS ENUM (
  'forgot_password_requested',
  'password_reset_completed',
  'password_changed_self',
  'password_reset_admin_temp',
  'email_change_requested_self',
  'email_change_completed',
  'email_changed_admin',
  'recovery_email_sent_admin'
);

-- CreateEnum
CREATE TYPE "AuditLogStatus" AS ENUM ('success', 'failure');

-- AlterTable
ALTER TABLE "Account"
ADD COLUMN "login" TEXT,
ADD COLUMN "pendingEmail" TEXT,
ADD COLUMN "pendingEmailRequestedAt" TIMESTAMP(3),
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mustChangePasswordReason" "AccountSecurityReason",
ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

DO $$
DECLARE
  account_record RECORD;
  candidate_login TEXT;
  stable_suffix TEXT;
  reserved_logins TEXT[] := ARRAY[
    'admin',
    'root',
    'support',
    'api',
    'auth',
    'login',
    'logout',
    'sign-in',
    'sign-up',
    'app',
    'security',
    'settings',
    'docs',
    'forum',
    'ai',
    'test',
    'system',
    'null',
    'undefined',
    'me'
  ];
BEGIN
  FOR account_record IN
    SELECT "id", "email"
    FROM "Account"
    WHERE "login" IS NULL
    ORDER BY "createdAt" ASC, "id" ASC
  LOOP
    stable_suffix := SUBSTRING(REPLACE(account_record."id", '-', '') FROM 1 FOR 8);
    candidate_login := LOWER(SPLIT_PART(account_record."email", '@', 1));
    candidate_login := REGEXP_REPLACE(candidate_login, '[^a-z0-9_]+', '_', 'g');
    candidate_login := REGEXP_REPLACE(candidate_login, '_+', '_', 'g');
    candidate_login := REGEXP_REPLACE(candidate_login, '^_+|_+$', '', 'g');
    candidate_login := LEFT(candidate_login, 32);

    IF candidate_login = '' OR LENGTH(candidate_login) < 3 OR candidate_login = ANY(reserved_logins) THEN
      candidate_login := 'user_' || stable_suffix;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "Account"
      WHERE "login" = candidate_login
        AND "id" <> account_record."id"
    ) THEN
      candidate_login := LEFT(candidate_login, 23) || '_' || stable_suffix;
    END IF;

    WHILE candidate_login = ANY(reserved_logins) OR EXISTS (
      SELECT 1
      FROM "Account"
      WHERE "login" = candidate_login
        AND "id" <> account_record."id"
    )
    LOOP
      candidate_login := 'user_' || stable_suffix;
    END LOOP;

    UPDATE "Account"
    SET "login" = candidate_login
    WHERE "id" = account_record."id";
  END LOOP;
END $$;

-- AlterTable
ALTER TABLE "Account"
ALTER COLUMN "login" SET NOT NULL;

-- CreateTable
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actionKey" "AuditActionKey" NOT NULL,
  "status" "AuditLogStatus" NOT NULL,
  "actorAccountId" UUID,
  "targetAccountId" UUID,
  "comment" TEXT,
  "metadataJson" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_login_key" ON "Account"("login");

-- CreateIndex
CREATE INDEX "AuditLog_actionKey_createdAt_idx" ON "AuditLog"("actionKey", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorAccountId_createdAt_idx" ON "AuditLog"("actorAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetAccountId_createdAt_idx" ON "AuditLog"("targetAccountId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_actorAccountId_fkey"
FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_targetAccountId_fkey"
FOREIGN KEY ("targetAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
