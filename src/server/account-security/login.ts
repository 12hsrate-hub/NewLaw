import { accountLoginCandidateSchema, accountLoginSchema, reservedAccountLogins } from "@/schemas/account-security";

function normalizeInput(value: string) {
  return value.trim().toLowerCase();
}

function collapseLoginCandidate(value: string) {
  return normalizeInput(value)
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createStableSuffix(accountId: string) {
  return accountId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) || "account";
}

function trimLoginToLimit(value: string) {
  return value.slice(0, 32);
}

export function normalizeAccountLogin(input: string) {
  return accountLoginSchema.parse(input);
}

export function isReservedAccountLogin(login: string) {
  const normalizedLogin = normalizeInput(login);

  return reservedAccountLogins.includes(
    normalizedLogin as (typeof reservedAccountLogins)[number],
  );
}

export function sanitizeLoginCandidate(input: string) {
  return collapseLoginCandidate(input);
}

export function createLoginBackfillBase(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const candidate = collapseLoginCandidate(localPart);

  return candidate;
}

export function createFallbackLogin(accountId: string) {
  return trimLoginToLimit(`user_${createStableSuffix(accountId)}`);
}

export function createBackfillLoginSeed(email: string, accountId: string) {
  const candidate = trimLoginToLimit(createLoginBackfillBase(email));

  if (!candidate) {
    return createFallbackLogin(accountId);
  }

  if (!accountLoginCandidateSchema.safeParse(candidate).success || isReservedAccountLogin(candidate)) {
    return createFallbackLogin(accountId);
  }

  return candidate;
}

export function createUniqueLoginVariant(baseLogin: string, accountId: string) {
  const suffix = createStableSuffix(accountId);
  const normalizedBase = sanitizeLoginCandidate(baseLogin) || "user";
  const maxBaseLength = 32 - (suffix.length + 1);

  return `${normalizedBase.slice(0, maxBaseLength)}_${suffix}`;
}

export async function resolveAccountLoginWithFallback(input: {
  requestedLogin?: string | null;
  email: string;
  accountId: string;
  isLoginTaken: (login: string) => Promise<boolean>;
  allowRequestedConflictFallback?: boolean;
}) {
  const requestedLogin = input.requestedLogin?.trim() ?? "";
  const parsedRequestedLogin = requestedLogin ? accountLoginSchema.safeParse(requestedLogin) : null;

  if (parsedRequestedLogin?.success) {
    const normalizedRequestedLogin = parsedRequestedLogin.data;

    if (!(await input.isLoginTaken(normalizedRequestedLogin))) {
      return normalizedRequestedLogin;
    }

    if (!input.allowRequestedConflictFallback) {
      return null;
    }
  }

  const backfillSeed = createBackfillLoginSeed(input.email, input.accountId);

  if (!(await input.isLoginTaken(backfillSeed))) {
    return backfillSeed;
  }

  const fallbackLogin = createUniqueLoginVariant(backfillSeed, input.accountId);

  if (!(await input.isLoginTaken(fallbackLogin))) {
    return fallbackLogin;
  }

  const finalFallback = createFallbackLogin(`${input.accountId}${Date.now().toString(36)}`);

  if (!(await input.isLoginTaken(finalFallback))) {
    return finalFallback;
  }

  return null;
}
