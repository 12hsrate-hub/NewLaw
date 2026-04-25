import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/app-shell/context", () => ({
  getAppShellContext: vi.fn(),
}));

import ProtectedAppPage from "@/app/(protected)/app/page";
import { getAppShellContext } from "@/server/app-shell/context";

describe("/app protected shell page", () => {
  it("рендерит transitional compatibility surface вместо основного workspace", async () => {
    vi.mocked(getAppShellContext).mockResolvedValue({
      account: {
        id: "1b8b1ea8-a6fd-4b6e-9447-fac7da607925",
        email: "user@example.com",
        login: "user_login",
        isSuperAdmin: false,
      },
      activeServer: {
        id: "server-1",
        name: "Downtown",
      },
      activeCharacter: {
        id: "character-1",
        fullName: "Alice Stone",
      },
      characters: [
        {
          accessFlags: [{ flagKey: "advocate" }],
          id: "character-1",
          fullName: "Alice Stone",
          nickname: "Alice Stone",
          passportNumber: "A-001",
          roles: [{ roleKey: "lawyer" }],
        },
      ],
      servers: [
        {
          id: "server-1",
          name: "Downtown",
        },
      ],
    } as never);

    const html = renderToStaticMarkup(await ProtectedAppPage({}));

    expect(getAppShellContext).toHaveBeenCalledWith("/app");
    expect(html).toContain("`/app` больше не основной рабочий контур");
    expect(html).toContain("Transitional Compatibility Route");
    expect(html).toContain("Alice Stone");
    expect(html).toContain("Downtown");
    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/account/characters"');
    expect(html).toContain('href="/account/documents"');
    expect(html).toContain('href="/account/trustors"');
    expect(html).toContain('href="/assistant"');
    expect(html).toContain('href="/servers"');
    expect(html).not.toContain('href="/internal"');
    expect(html).not.toContain("Управление персонажами");
  });

  it("показывает ссылку на internal только для super_admin", async () => {
    vi.mocked(getAppShellContext).mockResolvedValue({
      account: {
        id: "1b8b1ea8-a6fd-4b6e-9447-fac7da607925",
        email: "admin@example.com",
        login: "admin_login",
        isSuperAdmin: true,
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
    } as never);

    const html = renderToStaticMarkup(await ProtectedAppPage({}));

    expect(html).toContain('href="/internal"');
  });
});
