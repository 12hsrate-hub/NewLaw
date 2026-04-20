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

  it("рендерит список и базовое редактирование без ролей и access flags", () => {
    const html = renderToStaticMarkup(
      <CharacterManagementSection
        activeCharacterId="character-1"
        activeServerId="server-1"
        activeServerName="Downtown"
        characters={[
          {
            id: "character-1",
            fullName: "Alice Stone",
            nickname: "Alice Stone",
            passportNumber: "A-001",
          },
        ]}
        status="character-updated"
      />,
    );

    expect(html).toContain("Управление персонажами");
    expect(html).toContain("Alice Stone");
    expect(html).toContain("Редактировать персонажа");
    expect(html).not.toContain("Access flags");
    expect(html).not.toContain("Адвокатский доступ");
  });
});
