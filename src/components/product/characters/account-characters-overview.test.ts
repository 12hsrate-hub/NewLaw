import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/product/characters/character-form-card", () => ({
  CharacterFormCard: (props: { mode: string; selectionBehavior?: string; surface?: string }) =>
    `CharacterFormCard:${props.mode}:${props.selectionBehavior ?? "app_shell"}:${props.surface ?? "app_shell"}`,
}));

import { AccountCharactersOverview } from "@/components/product/characters/account-characters-overview";

describe("account characters overview", () => {
  it("рендерит grouped-by-server create/edit entry points внутри account zone без превращения страницы в workflow hub", () => {
    const html = renderToStaticMarkup(
      createElement(AccountCharactersOverview, {
        context: {
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
              createBridgeHref: "/account/characters?server=blackberry#create-character-blackberry",
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
                  position: "Адвокат",
                  address: "Дом 10",
                  phone: "123-45-67",
                  icEmail: "lawyer@example.com",
                  passportImageUrl: "https://example.com/passport.png",
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
              createBridgeHref: "/account/characters?server=rainbow#create-character-rainbow",
              focusHref: "/account/characters?server=rainbow",
              isFocused: false,
              characters: [],
            },
          ],
        },
        status: "character-created",
      }),
    );

    expect(html).toContain("Персонажи аккаунта");
    expect(html).toContain("CharacterFormCard:create:account_zone:account_zone");
    expect(html).toContain("CharacterFormCard:edit:account_zone:account_zone");
    expect(html).toContain('/account/characters?server=blackberry#create-character-blackberry');
    expect(html).toContain("Карточка персонажа сохранена в account zone");
    expect(html).toContain("Profile note");
    expect(html).toContain("Персонажей пока нет");
    expect(html).not.toContain("Assistant");
    expect(html).not.toContain("Documents hub");
  });
});
