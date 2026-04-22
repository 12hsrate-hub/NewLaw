import {
  InternalAccessDeniedState,
} from "@/components/product/internal/internal-shell";
import { AdminSecuritySection } from "@/components/product/admin-security/admin-security-section";
import { findAccountForAdminSearch } from "@/server/admin-security/account-search";
import { getInternalAccessContext } from "@/server/internal/access";

type InternalSecurityPageProps = {
  searchParams?: Promise<{
    identifier?: string;
  }>;
};

export default async function InternalSecurityPage({
  searchParams,
}: InternalSecurityPageProps) {
  const accessContext = await getInternalAccessContext("/internal/security");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  const resolvedSearchParams = await searchParams;
  const searchResult = await findAccountForAdminSearch(resolvedSearchParams?.identifier);

  return (
    <AdminSecuritySection
      actionsReturnPath="/internal/security"
      searchActionPath="/internal/security"
      searchResult={searchResult}
    />
  );
}
