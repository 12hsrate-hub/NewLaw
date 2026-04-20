import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/app-shell/context", () => ({
  getAppShellContext: vi.fn(),
}));

vi.mock("@/db/repositories/law-source-index.repository", () => ({
  listLawSourceIndexes: vi.fn(),
}));

import AdminLawsPage from "@/app/(protected-admin)/app/admin-laws/page";
import { listLawSourceIndexes } from "@/db/repositories/law-source-index.repository";
import { getAppShellContext } from "@/server/app-shell/context";

describe("/app/admin-laws", () => {
  it("рендерит super_admin-only law source management screen", async () => {
    vi.mocked(getAppShellContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "admin@example.com",
        login: "admin_user",
        isSuperAdmin: true,
        mustChangePassword: false,
      },
      activeServer: {
        id: "server-1",
        name: "Downtown",
      },
      activeCharacter: null,
      characters: [],
      servers: [
        {
          id: "server-1",
          name: "Downtown",
        },
      ],
      currentPath: "/app/admin-laws",
    } as never);
    vi.mocked(listLawSourceIndexes).mockResolvedValue([
      {
        id: "source-1",
        serverId: "server-1",
        indexUrl: "https://forum.gta5rp.com/forums/laws",
        isEnabled: true,
        lastDiscoveredAt: null,
        lastDiscoveryStatus: null,
        lastDiscoveryError: null,
      },
    ] as never);

    const html = renderToStaticMarkup(
      await AdminLawsPage({
        searchParams: Promise.resolve({
          status: "law-source-created",
        }),
      }),
    );

    expect(getAppShellContext).toHaveBeenCalledWith("/app/admin-laws");
    expect(html).toContain("Internal Source Management");
    expect(html).toContain("Downtown");
    expect(html).toContain("https://forum.gta5rp.com/forums/laws");
  });
});
