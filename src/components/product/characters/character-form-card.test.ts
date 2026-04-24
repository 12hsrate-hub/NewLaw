import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/characters", () => ({
  createCharacterAction: vi.fn(),
  updateCharacterAction: vi.fn(),
}));

import { CharacterFormCard } from "@/components/product/characters/character-form-card";

describe("character form card", () => {
  it("в edit-режиме рендерит только профильные поля без self-service ролей и доступов", () => {
    const html = renderToStaticMarkup(
      createElement(CharacterFormCard, {
        defaultValues: {
          accessFlags: ["advocate", "tester"],
          characterId: "character-1",
          fullName: "Alice Stone",
          isProfileComplete: true,
          nickname: "alice.stone",
          passportNumber: "A-001",
          position: "Адвокат",
          phone: "123-45-67",
          icEmail: "alice.stone@example.com",
          passportImageUrl: "https://example.com/passport.png",
          profileNote: "Профиль для account zone",
          roleKeys: ["lawyer"],
        },
        mode: "edit",
        redirectTo: "/account/characters?server=blackberry",
        selectionBehavior: "account_zone",
        serverId: "server-1",
        surface: "account_zone",
      }),
    );

    expect(html).toContain("Компактный профиль персонажа");
    expect(html).toContain('name="nickname"');
    expect(html).toContain('value="alice.stone"');
    expect(html).toContain("Система сама проверит");
    expect(html).toContain("Изменения сохраняются только в профильных полях этой карточки персонажа.");
    expect(html).toContain('value="Адвокат"');
    expect(html).toContain('value="123-45-67"');
    expect(html).toContain('value="alice.stone@example.com"');
    expect(html).not.toContain('name="roleKeys"');
    expect(html).not.toContain('name="accessFlags"');
    expect(html).toContain('value="account_zone"');
    expect(html).toContain('value="/account/characters?server=blackberry"');
  });
});
