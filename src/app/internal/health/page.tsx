import {
  InternalAccessDeniedState,
  InternalSectionSkeleton,
} from "@/components/product/internal/internal-shell";
import { getInternalAccessContext } from "@/server/internal/access";

export default async function InternalHealthPage() {
  const accessContext = await getInternalAccessContext("/internal/health");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  return (
    <InternalSectionSkeleton
      eyebrow="Internal health"
      title="Health"
      description="Здесь later появится internal health summary по corpus, assistant status и runtime readiness без раздувания в full diagnostics suite."
    />
  );
}
