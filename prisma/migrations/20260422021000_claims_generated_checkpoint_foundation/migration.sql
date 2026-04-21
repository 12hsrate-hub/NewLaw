ALTER TABLE "Document"
ADD COLUMN "generatedArtifactJson" JSONB,
ADD COLUMN "generatedArtifactText" TEXT,
ADD COLUMN "generatedOutputFormat" TEXT,
ADD COLUMN "generatedRendererVersion" TEXT;
