import {
  FORUM_GTA5RP_PROVIDER_KEY,
  forumValidationResultSchema,
  type ForumSessionPayload,
  type ForumValidationResult,
} from "@/schemas/forum-integration";

const FORUM_BASE_URL = `https://${FORUM_GTA5RP_PROVIDER_KEY}`;
const FORUM_VALIDATE_URL = `${FORUM_BASE_URL}/`;

type FetchLike = typeof fetch;

function stripHtml(input: string) {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function extractForumUserId(html: string) {
  const matches = [
    html.match(/data-user-id="([0-9]+)"/i)?.[1],
    html.match(/\/members\/[^"' ]+\.([0-9]+)\/?/i)?.[1],
    html.match(/memberTooltip--userId[=:]"?([0-9]+)"/i)?.[1],
  ];

  return matches.find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
}

function extractForumUsername(html: string) {
  const rawValue =
    html.match(/data-username="([^"]+)"/i)?.[1] ??
    html.match(/<meta property="profile:username" content="([^"]+)"/i)?.[1] ??
    html.match(/href="\/members\/[^"]+"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ??
    null;

  if (!rawValue) {
    return null;
  }

  const normalized = decodeHtmlEntities(stripHtml(rawValue)).trim();

  return normalized.length > 0 ? normalized : null;
}

function isAuthenticatedForumHtml(html: string, identity: { forumUserId: string | null; forumUsername: string | null }) {
  if (identity.forumUserId || identity.forumUsername) {
    return true;
  }

  return [
    /href="\/logout\//i,
    /data-logged-in="true"/i,
    /p-navgroup-link--user/i,
    /href="\/account\//i,
  ].some((pattern) => pattern.test(html));
}

function buildInvalidSummary(input: {
  responseStatus?: number;
  connectionError?: boolean;
}) {
  if (input.connectionError) {
    return "Не удалось связаться с forum.gta5rp.com для проверки сохранённой session.";
  }

  if (typeof input.responseStatus === "number" && input.responseStatus >= 500) {
    return "Форум временно недоступен и не подтвердил сохранённую session.";
  }

  return "Форум не подтвердил авторизованную session. Подключите новую Cookie header заново.";
}

export function parseGta5RpForumIdentity(html: string) {
  return {
    forumUserId: extractForumUserId(html),
    forumUsername: extractForumUsername(html),
  };
}

export async function validateGta5RpForumSession(
  payload: ForumSessionPayload,
  dependencies: {
    fetch?: FetchLike;
  } = {},
): Promise<ForumValidationResult> {
  const fetcher = dependencies.fetch ?? fetch;

  try {
    const response = await fetcher(FORUM_VALIDATE_URL, {
      headers: {
        Cookie: payload.cookieHeader,
        "User-Agent": "Lawyer5RP Forum Integration Validator/1.0",
      },
      redirect: "follow",
      cache: "no-store",
    });
    const html = await response.text();
    const identity = parseGta5RpForumIdentity(html);

    if (!response.ok) {
      return forumValidationResultSchema.parse({
        isValid: false,
        forumUserId: identity.forumUserId,
        forumUsername: identity.forumUsername,
        errorSummary: buildInvalidSummary({
          responseStatus: response.status,
        }),
      });
    }

    const isValid = isAuthenticatedForumHtml(html, identity);

    return forumValidationResultSchema.parse({
      isValid,
      forumUserId: identity.forumUserId,
      forumUsername: identity.forumUsername,
      errorSummary: isValid ? null : buildInvalidSummary({ responseStatus: response.status }),
    });
  } catch {
    return forumValidationResultSchema.parse({
      isValid: false,
      forumUserId: null,
      forumUsername: null,
      errorSummary: buildInvalidSummary({
        connectionError: true,
      }),
    });
  }
}
