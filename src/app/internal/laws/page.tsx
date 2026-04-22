import {
  InternalAccessDeniedState,
  InternalSectionSkeleton,
} from "@/components/product/internal/internal-shell";
import { getInternalAccessContext } from "@/server/internal/access";

export default async function InternalLawsPage() {
  const accessContext = await getInternalAccessContext("/internal/laws");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  return (
    <InternalSectionSkeleton
      eyebrow="Internal laws"
      title="Law Corpus"
      description="Здесь later переедут law corpus management, current-review controls и retrieval preview из transitional `/app/admin-laws`."
    />
  );
}
