import { listTrustorsForAccount } from "@/db/repositories/trustor.repository";
import { getServers } from "@/db/repositories/server.repository";
import { buildAccountTrustorsFocusHref } from "@/lib/routes/account-trustors";
import { requireProtectedAccountContext } from "@/server/auth/protected";

type AccountTrustorsViewerSummary = {
  accountId: string;
  email: string;
  login: string;
};

export type AccountTrustorSummary = {
  id: string;
  fullName: string;
  passportNumber: string;
  phone: string | null;
  note: string | null;
  isRepresentativeReady: boolean;
};

export type AccountTrustorsServerGroup = {
  server: {
    id: string;
    code: string;
    slug: string;
    name: string;
  };
  trustorCount: number;
  focusHref: string;
  isFocused: boolean;
  trustors: AccountTrustorSummary[];
};

export type AccountTrustorsOverviewContext = {
  viewer: AccountTrustorsViewerSummary;
  focusedServerCode: string | null;
  serverGroups: AccountTrustorsServerGroup[];
};

function buildViewerSummary(input: {
  account: {
    id: string;
    email: string;
    login: string;
  };
}): AccountTrustorsViewerSummary {
  return {
    accountId: input.account.id,
    email: input.account.email,
    login: input.account.login,
  };
}

function isRepresentativeReady(input: { fullName: string; passportNumber: string }) {
  return input.fullName.trim().length > 0 && input.passportNumber.trim().length > 0;
}

export async function getAccountTrustorsOverviewContext(input: {
  nextPath: string;
  focusedServerCode?: string | null;
}): Promise<AccountTrustorsOverviewContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const focusedServerCode = input.focusedServerCode?.trim().toLowerCase() || null;
  const [servers, trustors] = await Promise.all([
    getServers(),
    listTrustorsForAccount(account.id),
  ]);

  const serverGroups = servers.map((server) => {
    const serverTrustors = trustors.filter((trustor) => trustor.serverId === server.id);

    return {
      server: {
        id: server.id,
        code: server.code,
        slug: server.code,
        name: server.name,
      },
      trustorCount: serverTrustors.length,
      focusHref: buildAccountTrustorsFocusHref(server.code),
      isFocused: focusedServerCode === server.code.toLowerCase(),
      trustors: serverTrustors.map((trustor) => ({
        id: trustor.id,
        fullName: trustor.fullName,
        passportNumber: trustor.passportNumber,
        phone: trustor.phone,
        note: trustor.note,
        isRepresentativeReady: isRepresentativeReady({
          fullName: trustor.fullName,
          passportNumber: trustor.passportNumber,
        }),
      })),
    } satisfies AccountTrustorsServerGroup;
  });

  serverGroups.sort((left, right) => {
    if (left.isFocused !== right.isFocused) {
      return left.isFocused ? -1 : 1;
    }

    return left.server.name.localeCompare(right.server.name, "ru");
  });

  return {
    viewer: buildViewerSummary({ account }),
    focusedServerCode,
    serverGroups,
  };
}
