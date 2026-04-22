import {
  InternalAccessDeniedState,
  InternalSectionSkeleton,
} from "@/components/product/internal/internal-shell";
import { getInternalAccessContext } from "@/server/internal/access";

export default async function InternalPrecedentsPage() {
  const accessContext = await getInternalAccessContext("/internal/precedents");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  return (
    <InternalSectionSkeleton
      eyebrow="Internal precedents"
      title="Precedents Corpus"
      description="Здесь later переедут precedent source topics, import workflow и current/validity review из transitional `/app/admin-laws`."
    />
  );
}
