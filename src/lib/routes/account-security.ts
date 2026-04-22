import { buildStatusPath } from "@/lib/auth/email-auth";

type SearchParamValue = string | string[] | undefined;

type AccountSecurityCompatibilitySearchParams = Record<string, SearchParamValue>;

export const canonicalAccountSecurityPath = "/account/security";

function readFirstSearchParam(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

export function buildAccountSecurityPath(status?: string | null) {
  if (!status) {
    return canonicalAccountSecurityPath;
  }

  return buildStatusPath(canonicalAccountSecurityPath, status);
}

export function buildAppSecurityCompatibilityRedirectPath(
  searchParams?: AccountSecurityCompatibilitySearchParams,
) {
  if (!searchParams) {
    return canonicalAccountSecurityPath;
  }

  const normalizedStatus =
    readFirstSearchParam(searchParams.status) ??
    (readFirstSearchParam(searchParams.denied) === "admin-access"
      ? "admin-access-denied"
      : null);
  const params = new URLSearchParams();

  if (normalizedStatus) {
    params.set("status", normalizedStatus);
  }

  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === "status" || key === "denied") {
      return;
    }

    if (typeof value === "string") {
      params.set(key, value);
      return;
    }

    value?.forEach((item) => {
      params.append(key, item);
    });
  });

  const query = params.toString();

  return query ? `${canonicalAccountSecurityPath}?${query}` : canonicalAccountSecurityPath;
}
