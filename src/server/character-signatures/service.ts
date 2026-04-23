import { randomUUID } from "node:crypto";

import sharp from "sharp";

import {
  clearCharacterActiveSignatureRecord,
  createAndActivateCharacterSignatureRecord,
} from "@/db/repositories/character-signature.repository";
import { getCharacterByIdForAccount } from "@/db/repositories/character.repository";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import {
  characterSignatureAllowedMimeTypes,
  characterSignatureBucketName,
  characterSignatureRecommendedWarning,
  characterSignatureUploadLimits,
} from "@/schemas/character-signature";
import {
  documentSignatureSnapshotSchema,
  type DocumentSignatureSnapshot,
} from "@/schemas/document";

const mimeToExtension: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

let bucketEnsured = false;

export class CharacterSignatureAccessDeniedError extends Error {
  constructor() {
    super("Управлять подписью можно только в профиле своего персонажа.");
    this.name = "CharacterSignatureAccessDeniedError";
  }
}

export class CharacterSignatureMissingFileError extends Error {
  constructor() {
    super("Выберите файл подписи и попробуйте снова.");
    this.name = "CharacterSignatureMissingFileError";
  }
}

export class CharacterSignatureInvalidFormatError extends Error {
  constructor() {
    super("Подпись должна быть в формате PNG, JPG/JPEG или WEBP.");
    this.name = "CharacterSignatureInvalidFormatError";
  }
}

export class CharacterSignatureFileTooLargeError extends Error {
  constructor() {
    super("Файл подписи должен быть не больше 1 МБ.");
    this.name = "CharacterSignatureFileTooLargeError";
  }
}

export class CharacterSignatureDimensionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterSignatureDimensionsError";
  }
}

export class CharacterSignatureStorageUnavailableError extends Error {
  constructor() {
    super("Не удалось сохранить подпись персонажа. Попробуйте ещё раз позже.");
    this.name = "CharacterSignatureStorageUnavailableError";
  }
}

function normalizeMimeType(input: string, fileName: string) {
  const normalizedInput = input.trim().toLowerCase();

  if (normalizedInput === "image/jpg") {
    return "image/jpeg";
  }

  if (characterSignatureAllowedMimeTypes.includes(normalizedInput as (typeof characterSignatureAllowedMimeTypes)[number])) {
    return normalizedInput;
  }

  const fileNameLower = fileName.trim().toLowerCase();

  if (fileNameLower.endsWith(".png")) {
    return "image/png";
  }

  if (fileNameLower.endsWith(".jpg") || fileNameLower.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (fileNameLower.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}

async function ensureCharacterSignatureBucket() {
  if (bucketEnsured) {
    return;
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new CharacterSignatureStorageUnavailableError();
  }

  if (!buckets.some((bucket) => bucket.name === characterSignatureBucketName)) {
    const { error: createError } = await supabase.storage.createBucket(characterSignatureBucketName, {
      public: false,
      fileSizeLimit: characterSignatureUploadLimits.maxFileSizeBytes,
      allowedMimeTypes: [...characterSignatureAllowedMimeTypes],
    });

    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      throw new CharacterSignatureStorageUnavailableError();
    }
  }

  bucketEnsured = true;
}

function buildStoragePath(input: {
  serverId: string;
  characterId: string;
  signatureId: string;
  extension: string;
}) {
  return `servers/${input.serverId}/characters/${input.characterId}/signatures/${input.signatureId}.${input.extension}`;
}

function buildSignatureSnapshot(input: {
  id: string;
  storagePath: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
}) {
  return documentSignatureSnapshotSchema.parse({
    signatureId: input.id,
    storagePath: input.storagePath,
    mimeType: input.mimeType,
    width: input.width,
    height: input.height,
    fileSize: input.fileSize,
  });
}

export function buildCharacterSignatureSnapshotFromActiveSignature(input: {
  activeSignature:
    | {
        id: string;
        storagePath: string;
        mimeType: string;
        width: number;
        height: number;
        fileSize: number;
      }
    | null
    | undefined;
}) {
  if (!input.activeSignature) {
    return null;
  }

  return buildSignatureSnapshot({
    id: input.activeSignature.id,
    storagePath: input.activeSignature.storagePath,
    mimeType: input.activeSignature.mimeType,
    width: input.activeSignature.width,
    height: input.activeSignature.height,
    fileSize: input.activeSignature.fileSize,
  });
}

export async function uploadCharacterSignatureForCharacter(input: {
  accountId: string;
  characterId: string;
  file: File | null;
}) {
  const character = await getCharacterByIdForAccount({
    accountId: input.accountId,
    characterId: input.characterId,
  });

  if (!character) {
    throw new CharacterSignatureAccessDeniedError();
  }

  const file = input.file;

  if (!(file instanceof File) || file.size === 0) {
    throw new CharacterSignatureMissingFileError();
  }

  const mimeType = normalizeMimeType(file.type, file.name);

  if (!mimeType) {
    throw new CharacterSignatureInvalidFormatError();
  }

  if (file.size > characterSignatureUploadLimits.maxFileSizeBytes) {
    throw new CharacterSignatureFileTooLargeError();
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < characterSignatureUploadLimits.minWidth || height < characterSignatureUploadLimits.minHeight) {
    throw new CharacterSignatureDimensionsError(
      "Подпись должна быть не меньше 300×100 px.",
    );
  }

  if (width > characterSignatureUploadLimits.maxWidth || height > characterSignatureUploadLimits.maxHeight) {
    throw new CharacterSignatureDimensionsError(
      "Подпись должна быть не больше 1200×400 px.",
    );
  }

  const aspectRatio = width / height;

  if (
    aspectRatio < characterSignatureUploadLimits.minAspectRatio ||
    aspectRatio > characterSignatureUploadLimits.maxAspectRatio
  ) {
    throw new CharacterSignatureDimensionsError(
      "Подпись должна быть примерно в широком формате: допустимое соотношение сторон от 2:1 до 5:1.",
    );
  }

  await ensureCharacterSignatureBucket();

  const signatureId = randomUUID();
  const extension = mimeToExtension[mimeType];
  const storagePath = buildStoragePath({
    serverId: character.serverId,
    characterId: character.id,
    signatureId,
    extension,
  });
  const supabase = createServiceRoleSupabaseClient();
  const { error: uploadError } = await supabase.storage
    .from(characterSignatureBucketName)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new CharacterSignatureStorageUnavailableError();
  }

  try {
    const createdSignature = await createAndActivateCharacterSignatureRecord({
      id: signatureId,
      characterId: character.id,
      storagePath,
      mimeType,
      width,
      height,
      fileSize: file.size,
    });

    return {
      signature: createdSignature,
      warning:
        mimeType !== "image/png" || metadata.hasAlpha === false
          ? characterSignatureRecommendedWarning
          : null,
      snapshot: buildSignatureSnapshot({
        id: createdSignature.id,
        storagePath: createdSignature.storagePath,
        mimeType: createdSignature.mimeType,
        width: createdSignature.width,
        height: createdSignature.height,
        fileSize: createdSignature.fileSize,
      }),
    };
  } catch (error) {
    await supabase.storage.from(characterSignatureBucketName).remove([storagePath]);
    throw error;
  }
}

export async function detachActiveCharacterSignatureForCharacter(input: {
  accountId: string;
  characterId: string;
}) {
  const character = await getCharacterByIdForAccount({
    accountId: input.accountId,
    characterId: input.characterId,
  });

  if (!character) {
    throw new CharacterSignatureAccessDeniedError();
  }

  if (!character.activeSignature) {
    return null;
  }

  return clearCharacterActiveSignatureRecord({
    characterId: character.id,
    signatureId: character.activeSignature.id,
  });
}

export async function createCharacterSignaturePreviewUrl(storagePath: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.storage
    .from(characterSignatureBucketName)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

export async function loadCharacterSignatureDataUrl(
  signatureSnapshot: DocumentSignatureSnapshot,
) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.storage
    .from(characterSignatureBucketName)
    .download(signatureSnapshot.storagePath);

  if (error || !data) {
    return null;
  }

  const buffer = Buffer.from(await data.arrayBuffer());

  return `data:${signatureSnapshot.mimeType};base64,${buffer.toString("base64")}`;
}
