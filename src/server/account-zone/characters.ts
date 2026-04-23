import { getServers } from "@/db/repositories/server.repository";
import { listCharactersForAccount } from "@/db/repositories/character.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import { readCharacterProfileData } from "@/lib/ogp/generation-contract";
import {
  buildAccountCharactersBridgeHref,
  buildAccountCharactersFocusHref,
} from "@/lib/routes/account-characters";
import { requireProtectedAccountContext } from "@/server/auth/protected";

type AccountCharactersViewerSummary = {
  accountId: string;
  email: string;
  login: string;
};

export type AccountCharactersCharacterSummary = {
  id: string;
  fullName: string;
  nickname: string;
  passportNumber: string;
  roleKeys: string[];
  accessFlagKeys: string[];
  isProfileComplete: boolean;
  hasProfileData: boolean;
  compactProfileSummary: string | null;
  profileNote: string | null;
  profileSignature: string | null;
  position: string | null;
  address: string | null;
  phone: string | null;
  icEmail: string | null;
  passportImageUrl: string | null;
  isDefaultForServer: boolean;
};

export type AccountCharactersServerGroup = {
  server: {
    id: string;
    code: string;
    slug: string;
    name: string;
  };
  characterCount: number;
  defaultCharacterId: string | null;
  defaultCharacterLabel: string | null;
  createBridgeHref: string;
  focusHref: string;
  isFocused: boolean;
  characters: AccountCharactersCharacterSummary[];
};

export type AccountCharactersOverviewContext = {
  viewer: AccountCharactersViewerSummary;
  focusedServerCode: string | null;
  serverGroups: AccountCharactersServerGroup[];
};

function countProfileDataFields(input: unknown): number {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return 0;
  }

  return Object.values(input).reduce((count, value) => {
    if (value === null || value === undefined) {
      return count;
    }

    if (typeof value === "string" && value.trim().length === 0) {
      return count;
    }

    if (Array.isArray(value) && value.length === 0) {
      return count;
    }

    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length === 0
    ) {
      return count;
    }

    return count + 1;
  }, 0);
}

function buildCompactProfileSummary(profileDataJson: unknown): {
  hasProfileData: boolean;
  compactProfileSummary: string | null;
  profileNote: string | null;
  profileSignature: string | null;
  position: string | null;
  address: string | null;
  phone: string | null;
  icEmail: string | null;
  passportImageUrl: string | null;
} {
  const fieldCount = countProfileDataFields(profileDataJson);
  const profileData = readCharacterProfileData(profileDataJson);
  const profileSignature = profileData.signature;
  const profileNote = profileData.note;
  const position = profileData.position || null;
  const address = profileData.address || null;
  const phone = profileData.phone || null;
  const icEmail = profileData.icEmail || null;
  const passportImageUrl = profileData.passportImageUrl || null;

  if (fieldCount === 0) {
    return {
      hasProfileData: false,
      compactProfileSummary: null,
      profileNote,
      profileSignature,
      position,
      address,
      phone,
      icEmail,
      passportImageUrl,
    };
  }

  return {
    hasProfileData: true,
    compactProfileSummary:
      fieldCount === 1
        ? "Сохранено 1 дополнительное поле профиля"
        : `Сохранено ${fieldCount} дополнительных полей профиля`,
    profileNote,
    profileSignature,
    position,
    address,
    phone,
    icEmail,
    passportImageUrl,
  };
}

function buildViewerSummary(input: {
  account: {
    id: string;
    email: string;
    login: string;
  };
}): AccountCharactersViewerSummary {
  return {
    accountId: input.account.id,
    email: input.account.email,
    login: input.account.login,
  };
}

export async function getAccountCharactersOverviewContext(input: {
  nextPath: string;
  focusedServerCode?: string | null;
}): Promise<AccountCharactersOverviewContext> {
  const { account } = await requireProtectedAccountContext(input.nextPath, undefined, {
    allowMustChangePassword: true,
  });
  const focusedServerCode = input.focusedServerCode?.trim().toLowerCase() || null;

  const [servers, characters, userServerStates] = await Promise.all([
    getServers(),
    listCharactersForAccount(account.id),
    getUserServerStates(account.id),
  ]);

  const serverGroups = servers.map((server) => {
    const serverCharacters = characters.filter((character) => character.serverId === server.id);
    const serverState =
      userServerStates.find((state) => state.serverId === server.id && state.activeCharacterId) ?? null;
    const defaultCharacter =
      serverState?.activeCharacterId
        ? serverCharacters.find((character) => character.id === serverState.activeCharacterId) ?? null
        : null;

    return {
      server: {
        id: server.id,
        code: server.code,
        slug: server.code,
        name: server.name,
      },
      characterCount: serverCharacters.length,
      defaultCharacterId: defaultCharacter?.id ?? null,
      defaultCharacterLabel: defaultCharacter
        ? `${defaultCharacter.fullName} (${defaultCharacter.passportNumber})`
        : null,
      createBridgeHref: buildAccountCharactersBridgeHref(server.code),
      focusHref: buildAccountCharactersFocusHref(server.code),
      isFocused: focusedServerCode === server.code.toLowerCase(),
      characters: serverCharacters.map((character) => {
        const profileDataSummary = buildCompactProfileSummary(character.profileDataJson);

        return {
          id: character.id,
          fullName: character.fullName,
          nickname: character.nickname,
          passportNumber: character.passportNumber,
          roleKeys: character.roles.map((role) => role.roleKey),
          accessFlagKeys: character.accessFlags.map((flag) => flag.flagKey),
          isProfileComplete: character.isProfileComplete,
          hasProfileData: profileDataSummary.hasProfileData,
          compactProfileSummary: profileDataSummary.compactProfileSummary,
          profileNote: profileDataSummary.profileNote,
          profileSignature: profileDataSummary.profileSignature,
          position: profileDataSummary.position,
          address: profileDataSummary.address,
          phone: profileDataSummary.phone,
          icEmail: profileDataSummary.icEmail,
          passportImageUrl: profileDataSummary.passportImageUrl,
          isDefaultForServer: defaultCharacter?.id === character.id,
        };
      }),
    };
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
