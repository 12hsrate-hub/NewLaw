import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/characters", () => ({
  createCharacterAction: vi.fn(),
  updateCharacterAction: vi.fn(),
}));

import { CharacterFormCard } from "@/components/product/characters/character-form-card";

describe("character form card", () => {
  it("в edit-режиме подгружает существующие roles и access flags", () => {
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

    expect(html).toContain("Роли персонажа");
    expect(html).toContain("Доступы персонажа");
    expect(html).toMatch(/value="lawyer"[^>]*checked=""/);
    expect(html).toMatch(/value="advocate"[^>]*checked=""/);
    expect(html).toMatch(/value="tester"[^>]*checked=""/);
  });
});
