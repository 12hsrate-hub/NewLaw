import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { getForumIntegrationRuntimeEnv } from "@/schemas/env";
import {
  forumSessionPayloadSchema,
  type ForumSessionPayload,
} from "@/schemas/forum-integration";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_VERSION = "v1";

function deriveEncryptionKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function getEncryptionSecret(overrideSecret?: string) {
  if (overrideSecret) {
    return overrideSecret;
  }

  return getForumIntegrationRuntimeEnv().FORUM_SESSION_ENCRYPTION_KEY;
}

export function encryptForumSessionPayload(
  payload: ForumSessionPayload,
  overrideSecret?: string,
) {
  const plaintext = JSON.stringify(forumSessionPayloadSchema.parse(payload));
  const secret = getEncryptionSecret(overrideSecret);
  const key = deriveEncryptionKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptForumSessionPayload(
  encryptedPayload: string,
  overrideSecret?: string,
) {
  const [version, ivEncoded, authTagEncoded, ciphertextEncoded] = encryptedPayload.split(".");

  if (
    version !== ENCRYPTION_VERSION ||
    !ivEncoded ||
    !authTagEncoded ||
    !ciphertextEncoded
  ) {
    throw new Error("Unsupported encrypted forum session payload.");
  }

  const secret = getEncryptionSecret(overrideSecret);
  const key = deriveEncryptionKey(secret);
  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(ivEncoded, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  return forumSessionPayloadSchema.parse(JSON.parse(decrypted) as unknown);
}
