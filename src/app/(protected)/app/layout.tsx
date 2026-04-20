import type { ReactNode } from "react";

import { AppShellHeader } from "@/components/product/shell/app-shell-header";
import { PageContainer } from "@/components/ui/page-container";
import { getAppShellContext } from "@/server/app-shell/context";

type ProtectedAppLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ProtectedAppLayout({
  children,
}: ProtectedAppLayoutProps) {
  const shellContext = await getAppShellContext("/app");

  return (
    <PageContainer>
      <main className="min-h-screen px-6 py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <AppShellHeader
            accountEmail={shellContext.account.email}
            accountLogin={shellContext.account.login}
            activeCharacterId={shellContext.activeCharacter?.id ?? null}
            activeCharacterName={shellContext.activeCharacter?.fullName ?? null}
            activeServerId={shellContext.activeServer?.id ?? null}
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
            currentPath={shellContext.currentPath}
            isSuperAdmin={shellContext.account.isSuperAdmin}
            mustChangePassword={shellContext.account.mustChangePassword}
          />
          {children}
        </div>
      </main>
    </PageContainer>
  );
}
