import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

import AccountLandingPage from "@/app/account/page";
import { requireProtectedAccountContext } from "@/server/auth/protected";

describe("/account page", () => {
  it("рендерит account overview без превращения зоны в dashboard или главный рабочий кабинет", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
    } as never);

    const html = renderToStaticMarkup(await AccountLandingPage());

    expect(html).toContain("Аккаунт");
    expect(html).toContain("Здесь собраны настройки аккаунта, безопасность, доступы и служебные обзорные разделы.");
    expect(html).toContain("Безопасность и данные аккаунта");
    expect(html).toContain("Персонажи");
    expect(html).toContain("Доверители");
    expect(html).toContain("Обзор документов");
    expect(html).toContain('href="/account/security"');
    expect(html).toContain('href="/account/characters"');
    expect(html).toContain('href="/account/trustors"');
    expect(html).toContain('href="/account/documents"');
    expect(html).not.toContain("Открыть юридического помощника");
    expect(html).not.toContain("Кабинет адвоката");
    expect(html).not.toContain("Личный кабинет");
  });

  it("показывает служебный раздел только super_admin", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "admin@example.com",
        login: "admin",
        isSuperAdmin: true,
        mustChangePassword: false,
      },
    } as never);

    const html = renderToStaticMarkup(await AccountLandingPage());

    expect(html).toContain("Доступы и заявки");
    expect(html).toContain('href="/internal/access-requests"');
    expect(html).toContain("Открыть заявки на доступ");
  });
});
