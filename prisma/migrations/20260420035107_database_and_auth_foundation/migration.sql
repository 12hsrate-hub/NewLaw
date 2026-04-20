-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CharacterRoleKey" AS ENUM ('citizen', 'lawyer');

-- CreateEnum
CREATE TYPE "CharacterAccessFlagKey" AS ENUM ('advocate', 'server_editor', 'server_admin', 'tester');

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserServerState" (
    "id" TEXT NOT NULL,
    "accountId" UUID NOT NULL,
    "serverId" TEXT NOT NULL,
    "activeCharacterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserServerState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "accountId" UUID NOT NULL,
    "serverId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "passportNumber" TEXT NOT NULL,
    "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
    "profileDataJson" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterRole" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "roleKey" "CharacterRoleKey" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterAccessFlag" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "flagKey" "CharacterAccessFlagKey" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterAccessFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Server_code_key" ON "Server"("code");

-- CreateIndex
CREATE INDEX "UserServerState_serverId_idx" ON "UserServerState"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "UserServerState_accountId_serverId_key" ON "UserServerState"("accountId", "serverId");

-- CreateIndex
CREATE INDEX "Character_accountId_serverId_deletedAt_idx" ON "Character"("accountId", "serverId", "deletedAt");

-- CreateIndex
CREATE INDEX "Character_accountId_serverId_passportNumber_idx" ON "Character"("accountId", "serverId", "passportNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterRole_characterId_roleKey_key" ON "CharacterRole"("characterId", "roleKey");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterAccessFlag_characterId_flagKey_key" ON "CharacterAccessFlag"("characterId", "flagKey");

-- AddForeignKey
ALTER TABLE "UserServerState" ADD CONSTRAINT "UserServerState_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserServerState" ADD CONSTRAINT "UserServerState_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserServerState" ADD CONSTRAINT "UserServerState_activeCharacterId_fkey" FOREIGN KEY ("activeCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRole" ADD CONSTRAINT "CharacterRole_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterAccessFlag" ADD CONSTRAINT "CharacterAccessFlag_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

