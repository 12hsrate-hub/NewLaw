import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/characters", () => ({
  createCharacterAction: vi.fn(),
  updateCharacterAction: vi.fn(),
}));

import { CharacterFormCard } from "@/components/product/characters/character-form-card";

describe("character form card", () => {
  it("по умолчанию использует account-oriented redirect target", () => {
    const html = renderToStaticMarkup(
      <CharacterFormCard
        mode="create"
        serverId="server-1"
      />,
    );

    expect(html).toContain('name="redirectTo"');
    expect(html).toContain('value="/account/characters"');
  });

  it("в edit-режиме не рендерит self-service roles и access flags", () => {
    const html = renderToStaticMarkup(
      <CharacterFormCard
        defaultValues={{
          accessFlags: ["advocate", "tester"],
          characterId: "character-1",
          fullName: "Alice Stone",
          passportNumber: "A-001",
          roleKeys: ["lawyer"],
        }}
        mode="edit"
        serverId="server-1"
      />,
    );

    expect(html).toContain("Редактирование персонажа");
    expect(html).toContain("Компактный профиль персонажа");
    expect(html).not.toContain("Роли персонажа");
    expect(html).not.toContain("Доступы персонажа");
    expect(html).not.toContain('name="roleKeys"');
    expect(html).not.toContain('name="accessFlags"');
  });
});
