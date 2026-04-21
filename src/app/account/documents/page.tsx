import { AccountDocumentsOverview } from "@/components/product/document-area/document-area-foundation";
import { getAccountDocumentsOverviewContext } from "@/server/document-area/context";

export const dynamic = "force-dynamic";

export default async function AccountDocumentsPage() {
  const context = await getAccountDocumentsOverviewContext("/account/documents");

  return <AccountDocumentsOverview servers={context.servers} />;
}
