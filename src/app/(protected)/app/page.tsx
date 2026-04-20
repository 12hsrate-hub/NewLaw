import { CharacterManagementSection } from "@/components/product/characters/character-management-section";
import { getAppShellContext } from "@/server/app-shell/context";

type ProtectedAppPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function ProtectedAppPage({
  searchParams,
}: ProtectedAppPageProps) {
  const shellContext = await getAppShellContext("/app");
  const resolvedSearchParams = await searchParams;

  return (
    <CharacterManagementSection
      activeCharacterId={shellContext.activeCharacter?.id ?? null}
      activeServerId={shellContext.activeServer?.id ?? null}
      activeServerName={shellContext.activeServer?.name ?? null}
      characters={shellContext.characters.map((character) => ({
        id: character.id,
        fullName: character.fullName,
        nickname: character.nickname,
        passportNumber: character.passportNumber,
        roles: character.roles.map((role) => ({
          roleKey: role.roleKey,
        })),
        accessFlags: character.accessFlags.map((flag) => ({
          flagKey: flag.flagKey,
        })),
      }))}
      status={resolvedSearchParams?.status}
    />
  );
}
