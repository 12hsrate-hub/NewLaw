import { ZodError } from "zod";

import { createAuditLog } from "@/db/repositories/audit-log.repository";
import {
  getForumSessionConnectionByAccount,
  updateForumSessionConnectionState,
  upsertForumSessionConnection,
} from "@/db/repositories/forum-session-connection.repository";
import { hasLiveForumIntegrationRuntimeEnv } from "@/schemas/env";
import {
  buildDisconnectedForumConnectionSummary,
  FORUM_GTA5RP_PROVIDER_KEY,
  forumConnectionSummarySchema,
  normalizeForumSessionInput,
  type ForumConnectionSummary,
  type ForumValidationResult,
} from "@/schemas/forum-integration";
import { validateGta5RpForumSession } from "@/server/forum-integration/gta5rp-client";
import {
  decryptForumSessionPayload,
  encryptForumSessionPayload,
} from "@/server/forum-integration/session-crypto";

export class ForumIntegrationUnavailableError extends Error {}
export class ForumConnectionNotFoundError extends Error {}

function buildForumConnectionSummary(record: {
  providerKey: string;
  state: "connected_unvalidated" | "valid" | "invalid" | "disabled";
  forumUserId: string | null;
  forumUsername: string | null;
  validatedAt: Date | null;
  lastValidationError: string | null;
  disabledAt: Date | null;
} | null): ForumConnectionSummary {
  if (!record) {
    return buildDisconnectedForumConnectionSummary();
  }

  return forumConnectionSummarySchema.parse({
    providerKey: record.providerKey,
    state: record.state,
    forumUserId: record.forumUserId,
    forumUsername: record.forumUsername,
    validatedAt: record.validatedAt?.toISOString() ?? null,
    lastValidationError: record.lastValidationError,
    disabledAt: record.disabledAt?.toISOString() ?? null,
  });
}

function getForumIntegrationEnvSnapshot() {
  return {
    FORUM_SESSION_ENCRYPTION_KEY: process.env.FORUM_SESSION_ENCRYPTION_KEY,
  };
}

function assertForumIntegrationConfigured() {
  if (!hasLiveForumIntegrationRuntimeEnv(getForumIntegrationEnvSnapshot())) {
    throw new ForumIntegrationUnavailableError(
      "FORUM_SESSION_ENCRYPTION_KEY не настроен для server-side forum integration.",
    );
  }
}

function buildSafeValidationMetadata(result: ForumValidationResult) {
  return {
    providerKey: FORUM_GTA5RP_PROVIDER_KEY,
    connectionState: result.isValid ? "valid" : "invalid",
    forumUserId: result.forumUserId,
    forumUsername: result.forumUsername,
    errorSummary: result.errorSummary,
  };
}

export async function getAccountForumConnectionSummary(
  accountId: string,
  dependencies: {
    getForumSessionConnectionByAccount?: typeof getForumSessionConnectionByAccount;
  } = {},
) {
  const loadConnection =
    dependencies.getForumSessionConnectionByAccount ?? getForumSessionConnectionByAccount;

  const connection = await loadConnection({
    accountId,
    providerKey: FORUM_GTA5RP_PROVIDER_KEY,
  });

  return buildForumConnectionSummary(connection);
}

export async function saveAccountForumConnection(input: {
  accountId: string;
  rawSessionInput: string;
}, dependencies: {
  upsertForumSessionConnection?: typeof upsertForumSessionConnection;
  encryptForumSessionPayload?: typeof encryptForumSessionPayload;
  createAuditLog?: typeof createAuditLog;
} = {}) {
  const upsertConnection =
    dependencies.upsertForumSessionConnection ?? upsertForumSessionConnection;
  const encryptPayload =
    dependencies.encryptForumSessionPayload ?? encryptForumSessionPayload;
  const auditLogger = dependencies.createAuditLog ?? createAuditLog;

  try {
    assertForumIntegrationConfigured();
    const normalizedPayload = normalizeForumSessionInput(input.rawSessionInput);
    const encryptedSessionPayload = encryptPayload(normalizedPayload);
    const connection = await upsertConnection({
      accountId: input.accountId,
      providerKey: FORUM_GTA5RP_PROVIDER_KEY,
      encryptedSessionPayload,
      state: "connected_unvalidated",
    });

    await auditLogger({
      actionKey: "forum_connection_saved",
      status: "success",
      actorAccountId: input.accountId,
      targetAccountId: input.accountId,
      metadataJson: {
        providerKey: FORUM_GTA5RP_PROVIDER_KEY,
        connectionState: "connected_unvalidated",
      },
    });

    return buildForumConnectionSummary(connection);
  } catch (error) {
    await auditLogger({
      actionKey: "forum_connection_saved",
      status: "failure",
      actorAccountId: input.accountId,
      targetAccountId: input.accountId,
      metadataJson: {
        providerKey: FORUM_GTA5RP_PROVIDER_KEY,
        stage: "save",
        errorSummary:
          error instanceof ForumIntegrationUnavailableError
            ? error.message
            : error instanceof ZodError
              ? "Session input не прошёл безопасную валидацию."
              : "Не удалось сохранить forum session connection.",
      },
    });

    throw error;
  }
}

export async function validateAccountForumConnection(input: {
  accountId: string;
}, dependencies: {
  getForumSessionConnectionByAccount?: typeof getForumSessionConnectionByAccount;
  updateForumSessionConnectionState?: typeof updateForumSessionConnectionState;
  decryptForumSessionPayload?: typeof decryptForumSessionPayload;
  validateGta5RpForumSession?: typeof validateGta5RpForumSession;
  createAuditLog?: typeof createAuditLog;
  now?: () => Date;
} = {}) {
  const loadConnection =
    dependencies.getForumSessionConnectionByAccount ?? getForumSessionConnectionByAccount;
  const updateConnection =
    dependencies.updateForumSessionConnectionState ?? updateForumSessionConnectionState;
  const decryptPayload =
    dependencies.decryptForumSessionPayload ?? decryptForumSessionPayload;
  const validateSession =
    dependencies.validateGta5RpForumSession ?? validateGta5RpForumSession;
  const auditLogger = dependencies.createAuditLog ?? createAuditLog;
  const now = dependencies.now ?? (() => new Date());

  assertForumIntegrationConfigured();

  const connection = await loadConnection({
    accountId: input.accountId,
    providerKey: FORUM_GTA5RP_PROVIDER_KEY,
  });

  if (!connection) {
    await auditLogger({
      actionKey: "forum_connection_validated",
      status: "failure",
      actorAccountId: input.accountId,
      targetAccountId: input.accountId,
      metadataJson: {
        providerKey: FORUM_GTA5RP_PROVIDER_KEY,
        connectionState: "not_connected",
        errorSummary: "Forum session ещё не подключена.",
      },
    });
    throw new ForumConnectionNotFoundError("Сначала подключите forum session.");
  }

  if (connection.state === "disabled") {
    await auditLogger({
      actionKey: "forum_connection_validated",
      status: "failure",
      actorAccountId: input.accountId,
      targetAccountId: input.accountId,
      metadataJson: {
        providerKey: FORUM_GTA5RP_PROVIDER_KEY,
        connectionState: "disabled",
        errorSummary: "Forum session отключена и требует нового подключения.",
      },
    });

    return buildForumConnectionSummary(connection);
  }

  if (!connection.encryptedSessionPayload) {
    const updatedConnection = await updateConnection({
      connectionId: connection.id,
      state: "invalid",
      forumUserId: connection.forumUserId,
      forumUsername: connection.forumUsername,
      validatedAt: connection.validatedAt,
      lastValidationError:
        "Сохранённая forum session недоступна. Подключите новую Cookie header заново.",
      disabledAt: null,
      encryptedSessionPayload: null,
    });

    await auditLogger({
      actionKey: "forum_connection_validated",
      status: "failure",
      actorAccountId: input.accountId,
      targetAccountId: input.accountId,
      metadataJson: {
        providerKey: FORUM_GTA5RP_PROVIDER_KEY,
        connectionState: "invalid",
        errorSummary: updatedConnection.lastValidationError,
      },
    });

    return buildForumConnectionSummary(updatedConnection);
  }

  let validationResult: ForumValidationResult;

  try {
    const payload = decryptPayload(connection.encryptedSessionPayload);

    validationResult = await validateSession(payload);
  } catch {
    validationResult = {
      isValid: false,
      forumUserId: connection.forumUserId,
      forumUsername: connection.forumUsername,
      errorSummary:
        "Сохранённую session не удалось расшифровать текущим server-side ключом. Подключите новую Cookie header заново.",
    };
  }

  const updatedConnection = await updateConnection({
    connectionId: connection.id,
    state: validationResult.isValid ? "valid" : "invalid",
    forumUserId: validationResult.forumUserId,
    forumUsername: validationResult.forumUsername,
    validatedAt: validationResult.isValid ? now() : connection.validatedAt,
    lastValidationError: validationResult.isValid ? null : validationResult.errorSummary,
    disabledAt: null,
  });

  await auditLogger({
    actionKey: "forum_connection_validated",
    status: validationResult.isValid ? "success" : "failure",
    actorAccountId: input.accountId,
    targetAccountId: input.accountId,
    metadataJson: buildSafeValidationMetadata(validationResult),
  });

  return buildForumConnectionSummary(updatedConnection);
}

export async function disableAccountForumConnection(input: {
  accountId: string;
}, dependencies: {
  getForumSessionConnectionByAccount?: typeof getForumSessionConnectionByAccount;
  updateForumSessionConnectionState?: typeof updateForumSessionConnectionState;
  createAuditLog?: typeof createAuditLog;
  now?: () => Date;
} = {}) {
  const loadConnection =
    dependencies.getForumSessionConnectionByAccount ?? getForumSessionConnectionByAccount;
  const updateConnection =
    dependencies.updateForumSessionConnectionState ?? updateForumSessionConnectionState;
  const auditLogger = dependencies.createAuditLog ?? createAuditLog;
  const now = dependencies.now ?? (() => new Date());

  const connection = await loadConnection({
    accountId: input.accountId,
    providerKey: FORUM_GTA5RP_PROVIDER_KEY,
  });

  if (!connection) {
    return buildDisconnectedForumConnectionSummary();
  }

  const updatedConnection = await updateConnection({
    connectionId: connection.id,
    state: "disabled",
    forumUserId: connection.forumUserId,
    forumUsername: connection.forumUsername,
    validatedAt: connection.validatedAt,
    lastValidationError: null,
    disabledAt: now(),
    encryptedSessionPayload: null,
  });

  await auditLogger({
    actionKey: "forum_connection_disabled",
    status: "success",
    actorAccountId: input.accountId,
    targetAccountId: input.accountId,
    metadataJson: {
      providerKey: FORUM_GTA5RP_PROVIDER_KEY,
      connectionState: "disabled",
    },
  });

  return buildForumConnectionSummary(updatedConnection);
}
