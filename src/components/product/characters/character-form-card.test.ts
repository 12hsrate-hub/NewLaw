import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/characters", () => ({
  createCharacterAction: vi.fn(),
  updateCharacterAction: vi.fn(),
}));

import { CharacterFormCard } from "@/components/product/characters/character-form-card";

describe("character form card", () => {
  it("в edit-режиме подгружает существующие roles, access flags и compact profile subsection", () => {
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
          profileSignature: "А. Стоун",
          roleKeys: ["lawyer"],
        },
        mode: "edit",
        redirectTo: "/account/characters?server=blackberry",
        selectionBehavior: "account_zone",
        serverId: "server-1",
        surface: "account_zone",
      }),
    );

    expect(html).toContain("Роли персонажа");
    expect(html).toContain("Access flags");
    expect(html).toContain("Компактный профиль персонажа");
    expect(html).toContain('name="nickname"');
    expect(html).toContain('value="alice.stone"');
    expect(html).toContain('name="profileSignature"');
    expect(html).toContain("Ready state считается автоматически");
    expect(html).toContain('value="Адвокат"');
    expect(html).toContain('value="123-45-67"');
    expect(html).toContain('value="alice.stone@example.com"');
    expect(html).toMatch(/name="roleKeys" checked="" value="lawyer"/);
    expect(html).toMatch(/name="accessFlags" checked="" value="advocate"/);
    expect(html).toMatch(/name="accessFlags" checked="" value="tester"/);
    expect(html).toContain('value="account_zone"');
    expect(html).toContain('value="/account/characters?server=blackberry"');
  });
});
