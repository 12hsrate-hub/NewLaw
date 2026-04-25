import { InternalAILegalCoreSection } from "@/components/product/internal/internal-ai-legal-core-section";
import { InternalAccessDeniedState } from "@/components/product/internal/internal-shell";
import type { InternalAILegalCoreActionState } from "@/server/actions/internal-ai-legal-core";
import { getInternalAccessContext } from "@/server/internal/access";
import { getInternalAILegalCorePageContext } from "@/server/internal/ai-legal-core";

const initialState: InternalAILegalCoreActionState = {
  status: "idle",
  errorMessage: null,
  fieldErrors: {},
  runSummary: null,
  results: [],
};

export default async function InternalAILegalCorePage() {
  const accessContext = await getInternalAccessContext("/internal/ai-legal-core");

  if (accessContext.status === "denied") {
    return <InternalAccessDeniedState accountLogin={accessContext.viewer.login} />;
  }

  const context = await getInternalAILegalCorePageContext();

  return <InternalAILegalCoreSection context={context} initialState={initialState} />;
}
