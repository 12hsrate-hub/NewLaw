import { redirect } from "next/navigation";

import { buildAppSecurityCompatibilityRedirectPath } from "@/lib/routes/account-security";
import { requireProtectedAccountContext } from "@/server/auth/protected";

type ProtectedSecurityPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProtectedSecurityPage({
  searchParams,
}: ProtectedSecurityPageProps) {
  await requireProtectedAccountContext("/app/security", undefined, {
    allowMustChangePassword: true,
  });

  redirect(buildAppSecurityCompatibilityRedirectPath(await searchParams));
}
