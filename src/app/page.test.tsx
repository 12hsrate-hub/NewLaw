import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, usePathnameMock, useSearchParamsMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  usePathnameMock: vi.fn(),
  useSearchParamsMock: vi.fn(),
}));

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();

  return {
    ...actual,
    redirect: redirectMock,
    usePathname: usePathnameMock,
    useSearchParams: useSearchParamsMock,
  };
});

vi.mock("@/server/auth/helpers", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

vi.mock("@/server/primary-shell/context", () => ({
  getPrimaryShellContext: vi.fn(),
}));

vi.mock("@/server/home/dashboard", () => ({
  getHomeDashboardContext: vi.fn(),
}));

import HomePage from "@/app/page";
import { getCurrentUser } from "@/server/auth/helpers";
import { requireProtectedAccountContext } from "@/server/auth/protected";
import { getHomeDashboardContext } from "@/server/home/dashboard";
import { getPrimaryShellContext } from "@/server/primary-shell/context";

describe("/ page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("для гостя сохраняет redirect на /sign-in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await HomePage();

    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
    expect(requireProtectedAccountContext).not.toHaveBeenCalled();
  });

  it("для авторизованного пользователя рендерит dashboard на / с primary shell", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "lawyer_user",
        isSuperAdmin: true,
        mustChangePassword: false,
      },
    } as never);
    vi.mocked(getPrimaryShellContext).mockResolvedValue({
      viewer: {
        isAuthenticated: true,
        accountLogin: "lawyer_user",
        accountEmail: "user@example.com",
        isSuperAdmin: true,
      },
      currentPath: "/",
      availableServers: [
        {
          id: "server-1",
          name: "Blackberry",
          slug: "blackberry",
        },
      ],
      activeServer: {
        id: "server-1",
        name: "Blackberry",
        slug: "blackberry",
      },
      navigation: {
        documentsHref: "/servers/blackberry/documents",
        lawyerWorkspaceHref: "/servers/blackberry/lawyer",
        internalHref: "/internal",
      },
    });
    vi.mocked(getHomeDashboardContext).mockResolvedValue({
      activeServer: {
        name: "Blackberry",
        slug: "blackberry",
      },
      quickActions: {
        assistantHref: "/assistant",
        documentsHref: "/servers/blackberry/documents",
        documentsHelperText: null,
        lawyerWorkspaceHref: "/servers/blackberry/lawyer",
        serversHref: "/servers",
        accountHref: "/account",
        internalHref: "/internal",
      },
      tools: {
        assistant: {
          href: "/assistant",
          helperText: "Активный сервер: Blackberry. При необходимости его можно сменить в шапке.",
        },
        documents: {
          href: "/servers/blackberry/documents",
          actionLabel: "Открыть документы",
          helperText:
            "Раздел можно открыть уже сейчас, но для жалоб и исков сначала нужен персонаж на этом сервере.",
        },
        servers: {
          href: "/servers",
        },
        account: {
          href: "/account",
        },
        lawyer: {
          href: "/servers/blackberry/lawyer",
        },
        internal: {
          href: "/internal",
        },
      },
      placeholders: {
        requiresAttention: "На активном сервере для жалоб и исков сначала нужен персонаж.",
        recentActivity:
          "История последних действий появится здесь в отдельной линии развития, без перегрузки главной страницы.",
      },
    });

    const html = renderToStaticMarkup(await HomePage());

    expect(requireProtectedAccountContext).toHaveBeenCalledWith("/");
    expect(getPrimaryShellContext).toHaveBeenCalledWith({
      currentPath: "/",
      protectedContext: {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
        account: {
          id: "account-1",
          email: "user@example.com",
          login: "lawyer_user",
          isSuperAdmin: true,
          mustChangePassword: false,
        },
      },
    });
    expect(html).toContain("Lawyer5RP");
    expect(html).toContain("Панель инструментов");
    expect(html).toContain("Открыть юридический помощник");
    expect(html).toContain("Создать документ");
    expect(html).toContain("Открыть адвокатский кабинет");
    expect(html).toContain("Открыть серверы");
    expect(html).toContain("Открыть настройки аккаунта");
    expect(html).toContain("Служебная зона");
    expect(html).toContain("Требуется внимание");
    expect(html).toContain("Последняя активность");
    expect(html).toContain("Активный сервер: Blackberry");
    expect(html).toContain("Доверители, договоры, адвокатские запросы и работа в интересах доверителя.");
  });

  it("для mustChangePassword пользователя сохраняет существующий security flow", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });
    vi.mocked(requireProtectedAccountContext).mockImplementation(async () => {
      redirectMock("/account/security?status=must-change-password");
      throw new Error("redirected");
    });

    await expect(HomePage()).rejects.toThrow("redirected");

    expect(redirectMock).toHaveBeenCalledWith("/account/security?status=must-change-password");
    expect(getPrimaryShellContext).not.toHaveBeenCalled();
    expect(getHomeDashboardContext).not.toHaveBeenCalled();
  });
});
