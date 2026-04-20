import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CharacterManagementSection } from "@/components/product/characters/character-management-section";

describe("character management section", () => {
  it("показывает empty state и CTA, если на сервере ещё нет персонажей", () => {
    const html = renderToStaticMarkup(
      <CharacterManagementSection
        activeCharacterId={null}
        activeServerId="server-1"
        activeServerName="Downtown"
        characters={[]}
        status={undefined}
      />,
    );

    expect(html).toContain("Персонажей пока нет");
    expect(html).toContain("Создать персонажа");
  });

  it("рендерит список и базовое редактирование вместе с roles и access flags персонажа", () => {
    const html = renderToStaticMarkup(
      <CharacterManagementSection
        activeCharacterId="character-1"
        activeServerId="server-1"
        activeServerName="Downtown"
        characters={[
          {
            accessFlags: [{ flagKey: "advocate" }],
            id: "character-1",
            fullName: "Alice Stone",
            nickname: "Alice Stone",
            passportNumber: "A-001",
            roles: [{ roleKey: "lawyer" }],
          },
        ]}
        status="character-updated"
      />,
    );

    expect(html).toContain("Управление персонажами");
    expect(html).toContain("Alice Stone");
    expect(html).toContain("Редактировать персонажа");
    expect(html).toContain("Адвокат");
    expect(html).toContain("Адвокатский доступ");
  });
});
