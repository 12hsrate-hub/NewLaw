import { InternalAIReviewSection } from "@/components/product/internal/internal-ai-review-section";
import { InternalAccessDeniedState } from "@/components/product/internal/internal-shell";
import { getInternalAccessContext } from "@/server/internal/access";
import { getInternalAIReviewPageContext } from "@/server/internal/ai-review";

export default async function InternalAIReviewPage() {
  const accessContext = await getInternalAccessContext("/internal/ai-review");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  const context = await getInternalAIReviewPageContext();

  return <InternalAIReviewSection context={context} />;
}
