import {
  InternalAccessDeniedState,
  InternalSectionSkeleton,
} from "@/components/product/internal/internal-shell";
import { getInternalAccessContext } from "@/server/internal/access";

export default async function InternalSecurityPage() {
  const accessContext = await getInternalAccessContext("/internal/security");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  return (
    <InternalSectionSkeleton
      eyebrow="Internal security"
      title="Admin Security"
      description="Здесь later переедут admin account lookup и security actions над чужими аккаунтами. Self-service `/account/security` при этом остаётся отдельной user zone."
    />
  );
}
