import { CharacterManagementSection } from "@/components/product/characters/character-management-section";
import { ProtectedShellOverviewSection } from "@/components/product/shell/protected-shell-overview-section";
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
    <div className="space-y-6">
      <ProtectedShellOverviewSection
        activeCharacterId={shellContext.activeCharacter?.id ?? null}
        activeCharacterName={shellContext.activeCharacter?.fullName ?? null}
        activeServerName={shellContext.activeServer?.name ?? null}
        characters={shellContext.characters.map((character) => ({
          id: character.id,
          fullName: character.fullName,
          passportNumber: character.passportNumber,
        }))}
        status={resolvedSearchParams?.status}
        servers={shellContext.servers.map((server) => ({
          id: server.id,
          name: server.name,
        }))}
      />

      <CharacterManagementSection
        activeCharacterId={shellContext.activeCharacter?.id ?? null}
        activeServerId={shellContext.activeServer?.id ?? null}
        activeServerName={shellContext.activeServer?.name ?? null}
        characters={shellContext.characters.map((character) => ({
          id: character.id,
          fullName: character.fullName,
          nickname: character.nickname,
          passportNumber: character.passportNumber,
        }))}
        status={resolvedSearchParams?.status}
      />
    </div>
  );
}
