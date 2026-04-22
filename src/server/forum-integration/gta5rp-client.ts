import {
  FORUM_GTA5RP_PROVIDER_KEY,
  forumPublishCreateResultSchema,
  forumValidationResultSchema,
  type ForumPublishCreateResult,
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

function resolveForumUrl(input: string, baseUrl: string) {
  return new URL(input, baseUrl).toString();
}

function extractFormAction(html: string, baseUrl: string) {
  const rawAction =
    html.match(/<form[^>]+action="([^"]+)"[^>]*class="[^"]*message-form[^"]*"/i)?.[1] ??
    html.match(/<form[^>]+class="[^"]*message-form[^"]*"[^>]+action="([^"]+)"/i)?.[1] ??
    html.match(/<form[^>]+action="([^"]+add-thread[^"]*)"/i)?.[1] ??
    null;

  return rawAction ? resolveForumUrl(rawAction, baseUrl) : null;
}

function extractHiddenInputValue(html: string, inputName: string) {
  const escapedName = inputName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return (
    html.match(new RegExp(`<input[^>]+name="${escapedName}"[^>]+value="([^"]*)"`, "i"))?.[1] ??
    html.match(new RegExp(`<input[^>]+value="([^"]*)"[^>]+name="${escapedName}"`, "i"))?.[1] ??
    null
  );
}

function extractTextareaFieldName(html: string) {
  return (
    html.match(/<textarea[^>]+name="([^"]+)"[^>]*class="[^"]*input[^"]*"/i)?.[1] ??
    html.match(/<textarea[^>]+name="([^"]+)"/i)?.[1] ??
    "message"
  );
}

function extractTitleFieldName(html: string) {
  return (
    html.match(/<input[^>]+name="([^"]+)"[^>]+type="text"[^>]*placeholder="[^"]*title/i)?.[1] ??
    html.match(/<input[^>]+name="([^"]+)"[^>]+name="title"/i)?.[1] ??
    "title"
  );
}

function extractJsonRedirect(text: string, baseUrl: string) {
  try {
    const parsed = JSON.parse(text) as { redirect?: string; url?: string };
    const rawRedirect = parsed.redirect ?? parsed.url ?? null;

    return rawRedirect ? resolveForumUrl(rawRedirect, baseUrl) : null;
  } catch {
    return null;
  }
}

function extractThreadIdFromUrl(url: string) {
  const parsed = url.match(/\/threads\/(?:[^/.]+\.)?([0-9]+)(?:\/|$|\?)/i)?.[1];

  return parsed ?? null;
}

function extractPostIdFromHtml(html: string) {
  return (
    html.match(/id="js-post-([0-9]+)"/i)?.[1] ??
    html.match(/data-content="post-([0-9]+)"/i)?.[1] ??
    html.match(/href="#post-([0-9]+)"/i)?.[1] ??
    null
  );
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

export async function createGta5RpForumThreadFromBbcode(
  input: {
    sessionPayload: ForumSessionPayload;
    threadFormUrl: string;
    title: string;
    bbcode: string;
  },
  dependencies: {
    fetch?: FetchLike;
  } = {},
): Promise<ForumPublishCreateResult> {
  const fetcher = dependencies.fetch ?? fetch;
  const userAgent = "Lawyer5RP Forum Publisher/1.0";

  const formResponse = await fetcher(input.threadFormUrl, {
    headers: {
      Cookie: input.sessionPayload.cookieHeader,
      "User-Agent": userAgent,
    },
    redirect: "follow",
    cache: "no-store",
  });
  const formHtml = await formResponse.text();
  const identity = parseGta5RpForumIdentity(formHtml);

  if (!formResponse.ok || !isAuthenticatedForumHtml(formHtml, identity)) {
    throw new Error("Forum session недействительна для publish create.");
  }

  const actionUrl = extractFormAction(formHtml, input.threadFormUrl);
  const xfToken = extractHiddenInputValue(formHtml, "_xfToken");

  if (!actionUrl || !xfToken) {
    throw new Error("Форум не отдал publish form action или _xfToken.");
  }

  const titleFieldName = extractTitleFieldName(formHtml);
  const messageFieldName = extractTextareaFieldName(formHtml);
  const formBody = new URLSearchParams();

  formBody.set(titleFieldName, input.title);
  formBody.set(messageFieldName, input.bbcode);
  formBody.set("_xfToken", xfToken);
  formBody.set("_xfResponseType", "json");

  const requestUri = extractHiddenInputValue(formHtml, "_xfRequestUri");
  const withData = extractHiddenInputValue(formHtml, "_xfWithData");

  if (requestUri) {
    formBody.set("_xfRequestUri", requestUri);
  }

  if (withData) {
    formBody.set("_xfWithData", withData);
  }

  const publishResponse = await fetcher(actionUrl, {
    method: "POST",
    headers: {
      Cookie: input.sessionPayload.cookieHeader,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": userAgent,
      Referer: input.threadFormUrl,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: formBody.toString(),
    redirect: "manual",
    cache: "no-store",
  });
  const publishText = await publishResponse.text();
  const publicationUrl =
    publishResponse.headers.get("location") ??
    extractJsonRedirect(publishText, FORUM_BASE_URL) ??
    null;

  if (!publicationUrl) {
    throw new Error("Форум не вернул publication URL после create publish.");
  }

  const normalizedPublicationUrl = resolveForumUrl(publicationUrl, FORUM_BASE_URL);
  const threadIdFromUrl = extractThreadIdFromUrl(normalizedPublicationUrl);
  const threadPageResponse = await fetcher(normalizedPublicationUrl, {
    headers: {
      Cookie: input.sessionPayload.cookieHeader,
      "User-Agent": userAgent,
    },
    redirect: "follow",
    cache: "no-store",
  });
  const threadPageHtml = await threadPageResponse.text();
  const threadIdentity = parseGta5RpForumIdentity(threadPageHtml);

  if (!threadPageResponse.ok || !isAuthenticatedForumHtml(threadPageHtml, threadIdentity)) {
    throw new Error("Форум не подтвердил опубликованный thread после create publish.");
  }

  const forumThreadId = threadIdFromUrl ?? extractThreadIdFromUrl(threadPageResponse.url);
  const forumPostId = extractPostIdFromHtml(threadPageHtml);

  if (!forumThreadId || !forumPostId) {
    throw new Error("Не удалось извлечь forum thread/post identity после create publish.");
  }

  return forumPublishCreateResultSchema.parse({
    publicationUrl: normalizedPublicationUrl,
    forumThreadId,
    forumPostId,
  });
}
