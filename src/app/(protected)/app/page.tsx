import { ProtectedShellOverviewSection } from "@/components/product/shell/protected-shell-overview-section";
import { getAppShellContext } from "@/server/app-shell/context";

export default async function ProtectedAppPage() {
  const shellContext = await getAppShellContext("/app");

  return (
    <ProtectedShellOverviewSection
      activeCharacterId={shellContext.activeCharacter?.id ?? null}
      activeCharacterName={shellContext.activeCharacter?.fullName ?? null}
      activeServerName={shellContext.activeServer?.name ?? null}
      characters={shellContext.characters.map((character) => ({
        id: character.id,
        fullName: character.fullName,
        passportNumber: character.passportNumber,
      }))}
      servers={shellContext.servers.map((server) => ({
        id: server.id,
        name: server.name,
      }))}
    />
  );
}
