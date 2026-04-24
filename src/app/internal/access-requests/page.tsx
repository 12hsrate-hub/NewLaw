import { InternalAccessDeniedState } from "@/components/product/internal/internal-shell";
import { InternalAccessRequestsSection } from "@/components/product/internal/internal-access-requests-section";
import { getInternalAccessContext } from "@/server/internal/access";
import { getInternalAccessRequestsContext } from "@/server/internal/access-requests";

type InternalAccessRequestsPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function InternalAccessRequestsPage({
  searchParams,
}: InternalAccessRequestsPageProps) {
  const accessContext = await getInternalAccessContext("/internal/access-requests");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  const [resolvedSearchParams, context] = await Promise.all([
    searchParams,
    getInternalAccessRequestsContext(),
  ]);

  return (
    <InternalAccessRequestsSection
      context={context}
      status={resolvedSearchParams?.status ?? null}
    />
  );
}
