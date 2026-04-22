import {
  InternalAccessDeniedState,
} from "@/components/product/internal/internal-shell";
import { InternalHealthSection } from "@/components/product/internal/internal-health-section";
import { getInternalAccessContext } from "@/server/internal/access";
import { getInternalHealthContext } from "@/server/internal/health";

export default async function InternalHealthPage() {
  const accessContext = await getInternalAccessContext("/internal/health");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  const context = await getInternalHealthContext();

  return <InternalHealthSection context={context} />;
}
