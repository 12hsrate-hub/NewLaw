ALTER TABLE "Character"
ADD COLUMN "activeSignatureId" TEXT;

ALTER TABLE "Document"
ADD COLUMN "signatureSnapshotJson" JSONB;

CREATE TABLE "CharacterSignature" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Character_activeSignatureId_key" ON "Character"("activeSignatureId");
CREATE UNIQUE INDEX "CharacterSignature_storagePath_key" ON "CharacterSignature"("storagePath");
CREATE INDEX "CharacterSignature_characterId_createdAt_idx" ON "CharacterSignature"("characterId", "createdAt");
CREATE INDEX "CharacterSignature_characterId_isActive_createdAt_idx" ON "CharacterSignature"("characterId", "isActive", "createdAt");

ALTER TABLE "Character"
ADD CONSTRAINT "Character_activeSignatureId_fkey"
FOREIGN KEY ("activeSignatureId") REFERENCES "CharacterSignature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CharacterSignature"
ADD CONSTRAINT "CharacterSignature_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
