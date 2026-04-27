const DEFAULT_SERVER_SWITCH_REDIRECT = "/servers";

type ResolveServerSwitchRedirectTargetInput = {
  redirectTo: string;
  selectedServerSlug: string;
};

function isSafeInternalPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//");
}

function parseInternalPath(path: string) {
  if (!isSafeInternalPath(path)) {
    return null;
  }

  try {
    return new URL(path, "https://lawyer5rp.local");
  } catch {
    return null;
  }
}

function serializePath(url: URL) {
  return `${url.pathname}${url.search}`;
}

export function getSafeServerSwitchRedirectBase(redirectTo: string) {
  const parsed = parseInternalPath(redirectTo);

  if (!parsed) {
    return DEFAULT_SERVER_SWITCH_REDIRECT;
  }

  return serializePath(parsed);
}

export function resolveServerSwitchRedirectTarget(
  input: ResolveServerSwitchRedirectTargetInput,
) {
  const safeRedirectBase = getSafeServerSwitchRedirectBase(input.redirectTo);
  const parsed = parseInternalPath(safeRedirectBase);

  if (!parsed) {
    return DEFAULT_SERVER_SWITCH_REDIRECT;
  }

  const pathname = parsed.pathname;
  const normalizedServerSlug = encodeURIComponent(input.selectedServerSlug);

  if (pathname === "/assistant") {
    return "/assistant";
  }

  if (/^\/assistant\/[^/]+$/.test(pathname)) {
    return `/assistant/${normalizedServerSlug}`;
  }

  if (pathname === "/servers") {
    return "/servers";
  }

  if (/^\/servers\/[^/]+$/.test(pathname)) {
    return `/servers/${normalizedServerSlug}`;
  }

  if (/^\/servers\/[^/]+\/documents(?:\/.*)?$/.test(pathname)) {
    return `/servers/${normalizedServerSlug}/documents`;
  }

  if (pathname.startsWith("/account")) {
    const params = new URLSearchParams(parsed.search);

    if (params.has("server")) {
      params.delete("server");
      params.set("server", input.selectedServerSlug);
    }

    const nextQuery = params.toString();

    return nextQuery ? `${pathname}?${nextQuery}` : pathname;
  }

  if (pathname.startsWith("/app")) {
    return serializePath(parsed);
  }

  return serializePath(parsed);
}
