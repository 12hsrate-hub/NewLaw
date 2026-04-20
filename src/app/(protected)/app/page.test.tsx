import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/app-shell/context", () => ({
  getAppShellContext: vi.fn(),
}));

import ProtectedAppPage from "@/app/(protected)/app/page";
import { getAppShellContext } from "@/server/app-shell/context";

describe("/app protected shell page", () => {
  it("рендерит read-only shell для авторизованного пользователя", async () => {
    vi.mocked(getAppShellContext).mockResolvedValue({
      account: {
        id: "1b8b1ea8-a6fd-4b6e-9447-fac7da607925",
        email: "user@example.com",
        login: "user_login",
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
          id: "character-1",
          fullName: "Alice Stone",
          passportNumber: "A-001",
        },
      ],
      servers: [
        {
          id: "server-1",
          name: "Downtown",
        },
      ],
    } as never);

    const html = renderToStaticMarkup(await ProtectedAppPage());

    expect(getAppShellContext).toHaveBeenCalledWith("/app");
    expect(html).toContain("Read-only контур `/app`");
    expect(html).toContain("Alice Stone");
    expect(html).toContain("Downtown");
  });
});
