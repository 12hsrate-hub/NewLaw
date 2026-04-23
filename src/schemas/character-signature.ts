import { z } from "zod";

export const characterSignatureBucketName = "character-signatures" as const;
export const characterSignatureAllowedMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const characterSignatureRecommendedWarning =
  "Для лучшего отображения в документах рекомендуется использовать PNG с прозрачным фоном." as const;

export const characterSignatureMimeTypeSchema = z.enum(characterSignatureAllowedMimeTypes);

export const characterSignatureUploadLimits = {
  maxFileSizeBytes: 1_000_000,
  minWidth: 300,
  minHeight: 100,
  maxWidth: 1_200,
  maxHeight: 400,
  minAspectRatio: 2,
  maxAspectRatio: 5,
  recommendedWidth: 600,
  recommendedHeight: 200,
} as const;

export const characterSignatureActionInputSchema = z.object({
  characterId: z.string().trim().min(1),
  redirectTo: z.string().trim().min(1),
});

export type CharacterSignatureMimeType = z.infer<typeof characterSignatureMimeTypeSchema>;
