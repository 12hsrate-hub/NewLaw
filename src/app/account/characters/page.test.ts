import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/account-zone/characters", () => ({
  getAccountCharactersOverviewContext: vi.fn(),
}));

vi.mock("@/components/product/characters/character-form-card", () => ({
  CharacterFormCard: (props: { mode: string; surface?: string }) =>
    `CharacterFormCard:${props.mode}:${props.surface ?? "app_shell"}`,
}));

import AccountCharactersPage from "@/app/account/characters/page";
import { getAccountCharactersOverviewContext } from "@/server/account-zone/characters";

describe("/account/characters page", () => {
  it("рендерит grouped-by-server overview route без превращения account zone в server workflow hub", async () => {
    vi.mocked(getAccountCharactersOverviewContext).mockResolvedValue({
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
      focusedServerCode: "blackberry",
      serverGroups: [
        {
          server: {
            id: "server-1",
            code: "blackberry",
            slug: "blackberry",
            name: "Blackberry",
          },
          characterCount: 1,
          defaultCharacterId: "character-1",
          defaultCharacterLabel: "Игорь Юристов (AA-001)",
          createBridgeHref: "/app",
          focusHref: "/account/characters?server=blackberry",
          isFocused: true,
          characters: [
            {
              id: "character-1",
              fullName: "Игорь Юристов",
              nickname: "Игорь Юристов",
              passportNumber: "AA-001",
              roleKeys: ["lawyer"],
              accessFlagKeys: ["advocate"],
              isProfileComplete: true,
              hasProfileData: true,
              compactProfileSummary: "Сохранено 2 дополнительных полей профиля",
              profileNote: "Профиль для account zone",
              profileSignature: "И. Юристов",
              isDefaultForServer: true,
            },
          ],
        },
        {
          server: {
            id: "server-2",
            code: "rainbow",
            slug: "rainbow",
            name: "Rainbow",
          },
          characterCount: 0,
          defaultCharacterId: null,
          defaultCharacterLabel: null,
          createBridgeHref: "/app",
          focusHref: "/account/characters?server=rainbow",
          isFocused: false,
          characters: [],
        },
      ],
    });

    const html = renderToStaticMarkup(
      await AccountCharactersPage({
        searchParams: Promise.resolve({
          server: "blackberry",
          status: "character-created",
        }),
      }),
    );

    expect(getAccountCharactersOverviewContext).toHaveBeenCalledWith({
      nextPath: "/account/characters",
      focusedServerCode: "blackberry",
    });
    expect(html).toContain("Персонажи аккаунта");
    expect(html).toContain("Blackberry");
    expect(html).toContain("Default for server");
    expect(html).toContain("Адвокатский доступ");
    expect(html).toContain("Сохранено 2 дополнительных полей профиля");
    expect(html).toContain("Карточка персонажа сохранена в account zone");
    expect(html).toContain("Создать персонажа на этом сервере");
    expect(html).toContain("И. Юристов");
    expect(html).toContain("Transitional `/app`");
    expect(html).not.toContain("OGP complaints");
    expect(html).not.toContain("Claims");
  });

  it("следует auth guard и пробрасывает redirect при отсутствии доступа", async () => {
    vi.mocked(getAccountCharactersOverviewContext).mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AccountCharactersPage({})).rejects.toThrow("NEXT_REDIRECT");
  });
});
