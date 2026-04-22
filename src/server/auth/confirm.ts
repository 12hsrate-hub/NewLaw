import type { EmailOtpType } from "@supabase/supabase-js";

import {
  defaultAuthenticatedLandingPath,
  parseEmailConfirmationInput,
} from "@/lib/auth/email-auth";
import { createAuditLog } from "@/db/repositories/audit-log.repository";
import {
  buildRecoveryExpiredPath,
  buildRecoveryInvalidPath,
} from "@/server/auth/recovery";
import { buildStatusPath } from "@/lib/auth/email-auth";
import { syncAccountFromSupabaseUser } from "@/server/auth/account";

type AuthenticatedConfirmUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    login?: unknown;
  } | null;
} | null;

type ConfirmationClientLike = {
  auth: {
    verifyOtp: (input: {
      token_hash: string;
      type: EmailOtpType;
    }) => Promise<{
      error: {
        code?: string;
        message?: string;
        status?: number;
      } | null;
    }>;
    getUser: () => Promise<{
      data: {
        user: AuthenticatedConfirmUser;
      };
      error: Error | null;
    }>;
  };
};

type ConfirmDependencies = {
  syncAccountFromSupabaseUser: typeof syncAccountFromSupabaseUser;
  createAuditLog: typeof createAuditLog;
};

const defaultDependencies: ConfirmDependencies = {
  syncAccountFromSupabaseUser,
  createAuditLog,
};

type AuthConfirmResult = {
  redirectPath: string;
  setRecoveryAccessCookie?: boolean;
  status: "success" | "expired" | "invalid";
};

function buildConfirmationInvalidPath() {
  return buildStatusPath("/sign-in", "confirmation-invalid");
}

function buildConfirmationExpiredPath() {
  return buildStatusPath("/sign-in", "confirmation-expired");
}

function buildEmailChangeInvalidPath() {
  return buildStatusPath("/sign-in", "email-change-invalid");
}

function buildEmailChangeExpiredPath() {
  return buildStatusPath("/sign-in", "email-change-expired");
}

function buildEmailChangeSuccessPath() {
  return buildStatusPath("/app/security", "email-change-confirmed");
}

function mapConfirmErrorToStatus(error: {
  code?: string;
  message?: string;
}) {
  const normalizedMessage = error.message?.toLowerCase() ?? "";

  if (
    error.code === "otp_expired" ||
    normalizedMessage.includes("expired") ||
    normalizedMessage.includes("invalid or has expired")
  ) {
    return "expired" as const;
  }

  return "invalid" as const;
}

function buildConfirmErrorPath(type: EmailOtpType | null, status: "expired" | "invalid") {
  if (type === "recovery") {
    return status === "expired" ? buildRecoveryExpiredPath() : buildRecoveryInvalidPath();
  }

  if (type === "email_change") {
    return status === "expired" ? buildEmailChangeExpiredPath() : buildEmailChangeInvalidPath();
  }

  return status === "expired"
    ? buildConfirmationExpiredPath()
    : buildConfirmationInvalidPath();
}

export function readAuthConfirmQuery(url: URL) {
  return parseEmailConfirmationInput({
    tokenHash: url.searchParams.get("token_hash"),
    type: url.searchParams.get("type"),
    nextPath: url.searchParams.get("next") ?? defaultAuthenticatedLandingPath,
  });
}

export async function confirmEmailFromUrl(
  client: ConfirmationClientLike,
  url: URL,
  dependencies: ConfirmDependencies = defaultDependencies,
): Promise<AuthConfirmResult> {
  const parsed = readAuthConfirmQuery(url);

  if (!parsed.tokenHash || !parsed.type) {
    return {
      status: "invalid",
      redirectPath: buildConfirmationInvalidPath(),
    };
  }

  const { error } = await client.auth.verifyOtp({
    token_hash: parsed.tokenHash,
    type: parsed.type,
  });

  if (error) {
    const status = mapConfirmErrorToStatus(error);

    return {
      status,
      redirectPath: buildConfirmErrorPath(parsed.type, status),
    };
  }

  if (parsed.type === "recovery") {
    return {
      status: "success",
      redirectPath: "/reset-password",
      setRecoveryAccessCookie: true,
    };
  }

  if (parsed.type === "email_change") {
    const { data } = await client.auth.getUser();

    if (data.user?.id && data.user.email) {
      await dependencies.syncAccountFromSupabaseUser(data.user);
      await dependencies.createAuditLog({
        actionKey: "email_change_completed",
        status: "success",
        actorAccountId: data.user.id,
        targetAccountId: data.user.id,
        metadataJson: {
          flow: "self_service",
        },
      });
    }

    return {
      status: "success",
      redirectPath: buildEmailChangeSuccessPath(),
    };
  }

  return {
    status: "success",
    redirectPath: parsed.nextPath,
  };
}
