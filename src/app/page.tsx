import { ProductDashboard } from "@/components/product/home/product-dashboard";
import { PrimaryShell } from "@/components/product/shell/primary-shell";
import { PageContainer } from "@/components/ui/page-container";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { getHomeDashboardContext } from "@/server/home/dashboard";
import { getPrimaryShellContext } from "@/server/primary-shell/context";

export default async function HomePage() {
  const protectedContext = await requireProtectedAccountContext("/");
  const shellContext = await getPrimaryShellContext({
    currentPath: "/",
    protectedContext,
  });
  const dashboardContext = await getHomeDashboardContext({
    shellContext,
  });

  return (
    <PrimaryShell context={shellContext}>
      <PageContainer as="main" contentClassName="space-y-6" variant="wide">
        <ProductDashboard context={dashboardContext} />
      </PageContainer>
    </PrimaryShell>
  );
}
