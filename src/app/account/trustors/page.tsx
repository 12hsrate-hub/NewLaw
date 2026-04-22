import { AccountTrustorsOverview } from "@/components/product/trustors/account-trustors-overview";
import { getAccountTrustorsOverviewContext } from "@/server/account-zone/trustors";

export const dynamic = "force-dynamic";

type AccountTrustorsPageProps = {
  searchParams?: Promise<{
    server?: string;
    status?: string;
  }>;
};

export default async function AccountTrustorsPage({
  searchParams,
}: AccountTrustorsPageProps) {
  const resolvedSearchParams = await searchParams;
  const context = await getAccountTrustorsOverviewContext({
    nextPath: "/account/trustors",
    focusedServerCode: resolvedSearchParams?.server ?? null,
  });

  return (
    <AccountTrustorsOverview
      context={context}
      status={resolvedSearchParams?.status ?? null}
    />
  );
}
