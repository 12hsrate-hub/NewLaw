-- CreateTable
CREATE TABLE "Trustor" (
    "id" TEXT NOT NULL,
    "accountId" UUID NOT NULL,
    "serverId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passportNumber" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trustor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trustor_accountId_createdAt_idx" ON "Trustor"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "Trustor_accountId_serverId_deletedAt_idx" ON "Trustor"("accountId", "serverId", "deletedAt");

-- CreateIndex
CREATE INDEX "Trustor_serverId_deletedAt_idx" ON "Trustor"("serverId", "deletedAt");

-- AddForeignKey
ALTER TABLE "Trustor" ADD CONSTRAINT "Trustor_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trustor" ADD CONSTRAINT "Trustor_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
