ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'attorney_request';

ALTER TABLE "Document" ADD COLUMN "trustorId" TEXT;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_trustorId_fkey"
  FOREIGN KEY ("trustorId") REFERENCES "Trustor"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Document_accountId_trustorId_documentType_createdAt_idx"
  ON "Document"("accountId", "trustorId", "documentType", "createdAt");
