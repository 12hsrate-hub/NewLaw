import { listTrustorsForAccount } from "@/db/repositories/trustor.repository";
import { listAttorneyRequestDocumentsByAccount } from "@/db/repositories/document.repository";
import { getServers } from "@/db/repositories/server.repository";
import { isOgpTrustorRepresentativeReady } from "@/lib/ogp/generation-contract";
import {
  buildAccountTrustorsCreateHref,
  buildAccountTrustorsFocusHref,
} from "@/lib/routes/account-trustors";
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
  icEmail?: string | null;
  passportImageUrl?: string | null;
  note: string | null;
  isRepresentativeReady: boolean;
  attorneyRequests?: Array<{
    id: string;
    title: string;
    status: "draft" | "generated" | "published";
    serverCode: string;
    updatedAt: string;
  }>;
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
  createBridgeHref: string;
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
  const serverCodeById = new Map(servers.map((server) => [server.id, server.code]));
  let attorneyRequestDocuments: Awaited<ReturnType<typeof listAttorneyRequestDocumentsByAccount>> = [];

  try {
    attorneyRequestDocuments = await listAttorneyRequestDocumentsByAccount(account.id);
  } catch (error) {
    console.error("ACCOUNT_TRUSTORS_ATTORNEY_REQUESTS_LOAD_FAILED", {
      accountId: account.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }

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
      createBridgeHref: buildAccountTrustorsCreateHref(server.code),
      isFocused: focusedServerCode === server.code.toLowerCase(),
      trustors: serverTrustors.map((trustor) => ({
        id: trustor.id,
        fullName: trustor.fullName,
        passportNumber: trustor.passportNumber,
        phone: trustor.phone,
        icEmail: trustor.icEmail,
        passportImageUrl: trustor.passportImageUrl,
        note: trustor.note,
        isRepresentativeReady: isOgpTrustorRepresentativeReady({
          fullName: trustor.fullName,
          passportNumber: trustor.passportNumber,
          phone: trustor.phone,
          icEmail: trustor.icEmail,
          passportImageUrl: trustor.passportImageUrl,
        }),
        attorneyRequests: attorneyRequestDocuments
          .filter(
            (document) =>
              document.trustorId === trustor.id &&
              document.serverId === server.id,
          )
          .map((document) => ({
            id: document.id,
            title: document.title,
            status: document.status,
            serverCode: serverCodeById.get(document.serverId) ?? server.code,
            updatedAt: document.updatedAt.toISOString(),
          })),
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
