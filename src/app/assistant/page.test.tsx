import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/server.repository", () => ({
  listAssistantServers: vi.fn(),
}));

vi.mock("@/server/legal-assistant/viewer", () => ({
  getAssistantViewerContext: vi.fn(),
}));

import AssistantLandingPage from "@/app/assistant/page";
import { listAssistantServers } from "@/db/repositories/server.repository";
import { getAssistantViewerContext } from "@/server/legal-assistant/viewer";

describe("/assistant page", () => {
  it("рендерит отдельный assistant module вне /app", async () => {
    vi.mocked(getAssistantViewerContext).mockResolvedValue({
      user: null,
      account: null,
      isAuthenticated: false,
    });
    vi.mocked(listAssistantServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
        hasCurrentLawCorpus: true,
        currentPrimaryLawCount: 2,
      },
    ]);

    const html = renderToStaticMarkup(await AssistantLandingPage());

    expect(html).toContain("Юридический помощник по законам сервера");
    expect(html).toContain("Blackberry");
    expect(html).toContain("/assistant/blackberry");
  });
});
