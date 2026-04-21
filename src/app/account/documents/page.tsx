import { AccountDocumentsPersistedOverview } from "@/components/product/document-area/document-persistence";
import { getAccountDocumentsOverviewContext } from "@/server/document-area/context";

export const dynamic = "force-dynamic";

export default async function AccountDocumentsPage() {
  const context = await getAccountDocumentsOverviewContext("/account/documents");

  return <AccountDocumentsPersistedOverview documents={context.documents} servers={context.servers} />;
}
