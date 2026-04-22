import { AccountCharactersOverview } from "@/components/product/characters/account-characters-overview";
import { getAccountCharactersOverviewContext } from "@/server/account-zone/characters";

export const dynamic = "force-dynamic";

type AccountCharactersPageProps = {
  searchParams?: Promise<{
    server?: string;
    status?: string;
  }>;
};

export default async function AccountCharactersPage({
  searchParams,
}: AccountCharactersPageProps) {
  const resolvedSearchParams = await searchParams;
  const context = await getAccountCharactersOverviewContext({
    nextPath: "/account/characters",
    focusedServerCode: resolvedSearchParams?.server ?? null,
  });

  return (
    <AccountCharactersOverview
      context={context}
      status={resolvedSearchParams?.status ?? null}
    />
  );
}
