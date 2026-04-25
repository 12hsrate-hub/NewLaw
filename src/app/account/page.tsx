import { AccountZoneFoundationIntro } from "@/components/product/document-area/document-area-foundation";
import { requireProtectedAccountContext } from "@/server/auth/protected";

export default async function AccountLandingPage() {
  const { account } = await requireProtectedAccountContext("/account", undefined, {
    allowMustChangePassword: true,
  });

  return <AccountZoneFoundationIntro isSuperAdmin={account.isSuperAdmin} />;
}
