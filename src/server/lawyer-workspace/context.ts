import { getCharactersByServer } from "@/db/repositories/character.repository";
import { getServerByCode } from "@/db/repositories/server.repository";
import { listTrustorsForAccountAndServer } from "@/db/repositories/trustor.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { resolveActiveCharacterId } from "@/server/app-shell/state";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import {
  buildDocumentEntryCapabilities,
  buildWorkspaceCapabilities,
  type DocumentEntryCapabilities,
  type WorkspaceCapabilities,
} from "@/server/navigation/capabilities";
import { buildAccountCharactersFocusHref } from "@/lib/routes/account-characters";
import { buildAccountTrustorsFocusHref } from "@/lib/routes/account-trustors";

type CharacterRecord = Awaited<ReturnType<typeof getCharactersByServer>>[number];

type LawyerWorkspaceAccountSummary = {
  id: string;
  email: string;
  login: string;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
};

type LawyerWorkspaceServerSummary = {
  id: string;
  code: string;
  slug: string;
  name: string;
};

type LawyerWorkspaceSelectedCharacterSummary = {
  id: string;
  fullName: string;
  passportNumber: string;
  source: "last_used" | "first_available";
};

type LawyerWorkspaceCompatibilityHrefs = {
  trustorsHref: string;
  charactersHref: string;
  attorneyRequestsHref: string;
  attorneyRequestCreateHref: string;
  agreementsHref: string;
  agreementCreateHref: string;
};

type LawyerWorkspaceBaseContext = {
  account: LawyerWorkspaceAccountSummary;
  server: LawyerWorkspaceServerSummary;
  trustorCount: number;
  workspaceCapabilities: WorkspaceCapabilities;
  documentEntryCapabilities: DocumentEntryCapabilities;
  compatibilityHrefs: LawyerWorkspaceCompatibilityHrefs;
};

type LawyerWorkspaceReadyContext = LawyerWorkspaceBaseContext & {
  status: "ready";
  selectedCharacter: LawyerWorkspaceSelectedCharacterSummary;
};

type LawyerWorkspaceNoCharactersContext = LawyerWorkspaceBaseContext & {
  status: "no_characters";
  selectedCharacter: null;
};

type LawyerWorkspaceNoAdvocateAccessContext = LawyerWorkspaceBaseContext & {
  status: "no_advocate_access";
  selectedCharacter: LawyerWorkspaceSelectedCharacterSummary;
};

type LawyerWorkspaceServerNotFoundContext = {
  status: "server_not_found";
  account: LawyerWorkspaceAccountSummary;
  requestedServerSlug: string;
};

export type LawyerWorkspaceRouteContext =
  | LawyerWorkspaceReadyContext
  | LawyerWorkspaceNoCharactersContext
  | LawyerWorkspaceNoAdvocateAccessContext
  | LawyerWorkspaceServerNotFoundContext;

function buildAccountSummary(input: {
  account: LawyerWorkspaceAccountSummary;
}): LawyerWorkspaceAccountSummary {
  return {
    id: input.account.id,
    email: input.account.email,
    login: input.account.login,
    isSuperAdmin: input.account.isSuperAdmin,
    mustChangePassword: input.account.mustChangePassword,
  };
}

function resolveSelectedCharacter(input: {
  serverId: string;
  characters: CharacterRecord[];
  serverStates: Awaited<ReturnType<typeof getUserServerStates>>;
}) {
  const activeCharacterId = resolveActiveCharacterId(
    input.serverId,
    input.characters,
    input.serverStates,
  );
  const activeCharacter = activeCharacterId
    ? input.characters.find((character) => character.id === activeCharacterId) ?? null
    : null;

  if (activeCharacter) {
    return {
      character: activeCharacter,
      source: "last_used" as const,
    };
  }

  const firstCharacter = input.characters[0] ?? null;

  if (!firstCharacter) {
    return null;
  }

  return {
    character: firstCharacter,
    source: "first_available" as const,
  };
}

function buildSelectedCharacterSummary(input: {
  selectedCharacter: CharacterRecord;
  source: "last_used" | "first_available";
}): LawyerWorkspaceSelectedCharacterSummary {
  return {
    id: input.selectedCharacter.id,
    fullName: input.selectedCharacter.fullName,
    passportNumber: input.selectedCharacter.passportNumber,
    source: input.source,
  };
}

function buildCompatibilityHrefs(server: {
  code: string;
  slug: string;
}): LawyerWorkspaceCompatibilityHrefs {
  return {
    trustorsHref: buildAccountTrustorsFocusHref(server.code),
    charactersHref: buildAccountCharactersFocusHref(server.code),
    attorneyRequestsHref: `/servers/${server.slug}/documents/attorney-requests`,
    attorneyRequestCreateHref: `/servers/${server.slug}/documents/attorney-requests/new`,
    agreementsHref: `/servers/${server.slug}/documents/legal-services-agreements`,
    agreementCreateHref: `/servers/${server.slug}/documents/legal-services-agreements/new`,
  };
}

export async function getLawyerWorkspaceRouteContext(input: {
  serverSlug: string;
  nextPath: string;
}): Promise<LawyerWorkspaceRouteContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const accountSummary = buildAccountSummary({ account });
  const server = await getServerByCode(input.serverSlug);

  if (!server) {
    return {
      status: "server_not_found",
      account: accountSummary,
      requestedServerSlug: input.serverSlug,
    };
  }

  const [characters, serverStates, trustors] = await Promise.all([
    getCharactersByServer({
      accountId: account.id,
      serverId: server.id,
    }),
    getUserServerStates(account.id),
    listTrustorsForAccountAndServer({
      accountId: account.id,
      serverId: server.id,
    }),
  ]);
  const selectedCharacterState = resolveSelectedCharacter({
    serverId: server.id,
    characters,
    serverStates,
  });
  const selectedCharacter = selectedCharacterState?.character ?? null;
  const selectedCharacterSummary = selectedCharacterState
    ? buildSelectedCharacterSummary({
        selectedCharacter: selectedCharacterState.character,
        source: selectedCharacterState.source,
      })
    : null;
  const hasAdvocateCharacter =
    selectedCharacter?.accessFlags?.some((flag) => flag.flagKey === "advocate") === true;
  const canCreateAttorneyRequestLegacy =
    selectedCharacter?.roles?.some((role) => role.roleKey === "lawyer") === true;
  const workspaceCapabilities = buildWorkspaceCapabilities({
    isAuthenticated: true,
    hasServer: true,
    hasAssistantMaterials: true,
    hasSelectedCharacter: selectedCharacterSummary !== null,
    hasAdvocateCharacter,
    includeAccessRequestRequired: true,
  });
  const documentEntryCapabilities = buildDocumentEntryCapabilities({
    isAuthenticated: true,
    hasServer: true,
    hasSelectedCharacter: selectedCharacterSummary !== null,
    hasAdvocateCharacter,
    hasTrustorRegistry: trustors.length > 0,
    canCreateAttorneyRequestLegacy,
    compatibilityRequiresTrustorRegistryForLegalServicesAgreement: true,
    includeAccessRequestRequired: true,
  });
  const baseContext: LawyerWorkspaceBaseContext = {
    account: accountSummary,
    server: {
      id: server.id,
      code: server.code,
      slug: server.code,
      name: server.name,
    },
    trustorCount: trustors.length,
    workspaceCapabilities,
    documentEntryCapabilities,
    compatibilityHrefs: buildCompatibilityHrefs({
      code: server.code,
      slug: server.code,
    }),
  };

  if (!selectedCharacterSummary) {
    return {
      status: "no_characters",
      ...baseContext,
      selectedCharacter: null,
    };
  }

  if (!workspaceCapabilities.canOpenLawyerWorkspace) {
    return {
      status: "no_advocate_access",
      ...baseContext,
      selectedCharacter: selectedCharacterSummary,
    };
  }

  return {
    status: "ready",
    ...baseContext,
    selectedCharacter: selectedCharacterSummary,
  };
}
