import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";

import {
  createAssistantGuestSession,
  findAssistantGuestSessionByFingerprint,
  getAssistantGuestSessionByToken,
  saveAssistantGuestAnswer,
} from "@/db/repositories/assistant-guest-session.repository";
import { assistantGuestTokenSchema } from "@/schemas/legal-assistant";

const assistantGuestCookieName = "lawyer5rp_assistant_guest";
const assistantGuestCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

type GuestSessionDependencies = {
  getAssistantGuestSessionByToken: typeof getAssistantGuestSessionByToken;
  findAssistantGuestSessionByFingerprint: typeof findAssistantGuestSessionByFingerprint;
  createAssistantGuestSession: typeof createAssistantGuestSession;
  saveAssistantGuestAnswer: typeof saveAssistantGuestAnswer;
  createGuestToken: () => string;
  now: () => Date;
};

const defaultDependencies: GuestSessionDependencies = {
  getAssistantGuestSessionByToken,
  findAssistantGuestSessionByFingerprint,
  createAssistantGuestSession,
  saveAssistantGuestAnswer,
  createGuestToken: () => randomBytes(24).toString("base64url"),
  now: () => new Date(),
};

export type AssistantGuestAnswerSnapshot = {
  questionText: string;
  answerMarkdown: string;
  answerMetadataJson: Record<string, unknown> | null;
  answerStatus: "answered" | "no_norms";
  lastAnsweredAt: Date | null;
};

export function getAssistantGuestCookieName() {
  return assistantGuestCookieName;
}

export function hashAssistantGuestValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeAssistantGuestIpAddress(input: string | null | undefined) {
  const rawValue = input?.split(",")[0]?.trim();

  return rawValue && rawValue.length > 0 ? rawValue : "unknown-ip";
}

export function normalizeAssistantGuestUserAgent(input: string | null | undefined) {
  const rawValue = input?.trim();

  return rawValue && rawValue.length > 0 ? rawValue : "unknown-user-agent";
}

function readAssistantGuestToken(cookieValue: string | undefined) {
  if (!cookieValue) {
    return null;
  }

  const parsed = assistantGuestTokenSchema.safeParse(cookieValue);

  return parsed.success ? parsed.data : null;
}

export async function getAssistantGuestRequestFingerprint() {
  const headerStore = await headers();
  const ipAddress = normalizeAssistantGuestIpAddress(
    headerStore.get("x-forwarded-for") ??
      headerStore.get("x-real-ip") ??
      headerStore.get("cf-connecting-ip"),
  );
  const userAgent = normalizeAssistantGuestUserAgent(headerStore.get("user-agent"));

  return {
    ipAddress,
    userAgent,
    ipHash: hashAssistantGuestValue(ipAddress),
    userAgentHash: hashAssistantGuestValue(userAgent),
  };
}

export async function getAssistantGuestUsageState(
  dependencies: GuestSessionDependencies = defaultDependencies,
) {
  const cookieStore = await cookies();
  const guestToken = readAssistantGuestToken(cookieStore.get(assistantGuestCookieName)?.value);
  const fingerprint = await getAssistantGuestRequestFingerprint();
  const tokenSession = guestToken
    ? await dependencies.getAssistantGuestSessionByToken(guestToken)
    : null;
  const fingerprintSession = await dependencies.findAssistantGuestSessionByFingerprint({
    ipHash: fingerprint.ipHash,
    userAgentHash: fingerprint.userAgentHash,
  });
  const matchedSession =
    tokenSession &&
    tokenSession.ipHash === fingerprint.ipHash &&
    tokenSession.userAgentHash === fingerprint.userAgentHash
      ? tokenSession
      : null;
  const activeSession = matchedSession ?? fingerprintSession ?? null;

  return {
    guestToken,
    fingerprint,
    session: activeSession,
    hasGuestQuestionAvailable: !activeSession?.usedFreeQuestionAt,
    savedAnswer:
      activeSession?.questionText &&
      activeSession.answerMarkdown &&
      activeSession.answerStatus
        ? ({
            questionText: activeSession.questionText,
            answerMarkdown: activeSession.answerMarkdown,
            answerMetadataJson:
              activeSession.answerMetadataJson && typeof activeSession.answerMetadataJson === "object"
                ? (activeSession.answerMetadataJson as Record<string, unknown>)
                : null,
            answerStatus: activeSession.answerStatus,
            lastAnsweredAt: activeSession.lastAnsweredAt,
          } satisfies AssistantGuestAnswerSnapshot)
        : null,
  };
}

export async function ensureAssistantGuestSession(
  dependencies: GuestSessionDependencies = defaultDependencies,
) {
  const cookieStore = await cookies();
  const usageState = await getAssistantGuestUsageState(dependencies);

  if (usageState.session) {
    if (!usageState.guestToken || usageState.guestToken !== usageState.session.guestToken) {
      cookieStore.set(assistantGuestCookieName, usageState.session.guestToken, {
        httpOnly: true,
        maxAge: assistantGuestCookieMaxAgeSeconds,
        path: "/assistant",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return usageState.session;
  }

  const guestToken = dependencies.createGuestToken();
  const session = await dependencies.createAssistantGuestSession({
    guestToken,
    ipHash: usageState.fingerprint.ipHash,
    userAgentHash: usageState.fingerprint.userAgentHash,
  });

  cookieStore.set(assistantGuestCookieName, guestToken, {
    httpOnly: true,
    maxAge: assistantGuestCookieMaxAgeSeconds,
    path: "/assistant",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return session;
}

export async function storeAssistantGuestAnswer(
  input: {
    serverId: string;
    questionText: string;
    answerMarkdown: string;
    answerMetadataJson: Record<string, unknown>;
    answerStatus: "answered" | "no_norms";
  },
  dependencies: GuestSessionDependencies = defaultDependencies,
) {
  const session = await ensureAssistantGuestSession(dependencies);
  const answeredAt = dependencies.now();

  return dependencies.saveAssistantGuestAnswer({
    sessionId: session.id,
    serverId: input.serverId,
    questionText: input.questionText,
    answerMarkdown: input.answerMarkdown,
    answerMetadataJson: input.answerMetadataJson,
    answerStatus: input.answerStatus,
    answeredAt,
  });
}
