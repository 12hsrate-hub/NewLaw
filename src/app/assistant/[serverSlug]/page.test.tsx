import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/server.repository", () => ({
  getServerByCode: vi.fn(),
  listAssistantServers: vi.fn(),
}));

vi.mock("@/server/legal-assistant/viewer", () => ({
  getAssistantViewerContext: vi.fn(),
}));

vi.mock("@/server/legal-assistant/guest-session", () => ({
  getAssistantGuestUsageState: vi.fn(),
}));

vi.mock("@/components/product/legal-assistant/assistant-question-form", () => ({
  AssistantQuestionForm: ({
    serverSlug,
    serverName,
  }: {
    serverSlug: string;
    serverName: string;
  }) => <div>{`assistant-form:${serverSlug}:${serverName}`}</div>,
}));

import AssistantServerPage from "@/app/assistant/[serverSlug]/page";
import { getServerByCode, listAssistantServers } from "@/db/repositories/server.repository";
import { getAssistantGuestUsageState } from "@/server/legal-assistant/guest-session";
import { getAssistantViewerContext } from "@/server/legal-assistant/viewer";

describe("/assistant/[serverSlug] page", () => {
  it("берёт server context из route param, а не из /app shell", async () => {
    vi.mocked(listAssistantServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
        hasCurrentLawCorpus: true,
        currentPrimaryLawCount: 2,
      },
    ]);
    vi.mocked(getServerByCode).mockResolvedValue({
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
      isActive: true,
      sortOrder: 1,
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    });
    vi.mocked(getAssistantViewerContext).mockResolvedValue({
      user: null,
      account: null,
      isAuthenticated: false,
    });
    vi.mocked(getAssistantGuestUsageState).mockResolvedValue({
      guestToken: null,
      fingerprint: {
        ipAddress: "127.0.0.1",
        userAgent: "Vitest",
        ipHash: "ip-hash",
        userAgentHash: "ua-hash",
      },
      session: null,
      hasGuestQuestionAvailable: true,
      savedAnswer: null,
    });

    const html = renderToStaticMarkup(
      await AssistantServerPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(getServerByCode).toHaveBeenCalledWith("blackberry");
    expect(html).toContain("assistant-form:blackberry:Blackberry");
  });

  it("показывает unavailable state, если у сервера нет current corpus", async () => {
    vi.mocked(listAssistantServers).mockResolvedValue([
      {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
        hasCurrentLawCorpus: false,
        currentPrimaryLawCount: 0,
      },
    ]);
    vi.mocked(getServerByCode).mockResolvedValue({
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
      isActive: true,
      sortOrder: 1,
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    });
    vi.mocked(getAssistantViewerContext).mockResolvedValue({
      user: null,
      account: null,
      isAuthenticated: false,
    });
    vi.mocked(getAssistantGuestUsageState).mockResolvedValue({
      guestToken: null,
      fingerprint: {
        ipAddress: "127.0.0.1",
        userAgent: "Vitest",
        ipHash: "ip-hash",
        userAgentHash: "ua-hash",
      },
      session: null,
      hasGuestQuestionAvailable: true,
      savedAnswer: null,
    });

    const html = renderToStaticMarkup(
      await AssistantServerPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
        }),
      }),
    );

    expect(html).toContain("пока нет подтвержденного current law corpus");
  });
});
