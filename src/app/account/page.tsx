import { AccountZoneFoundationIntro } from "@/components/product/document-area/document-area-foundation";
import { requireProtectedAccountContext } from "@/server/auth/protected";

export default async function AccountLandingPage() {
  await requireProtectedAccountContext("/account", undefined, {
    allowMustChangePassword: true,
  });

  return <AccountZoneFoundationIntro />;
}
