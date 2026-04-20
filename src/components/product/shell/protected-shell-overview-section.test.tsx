import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProtectedShellOverviewSection } from "@/components/product/shell/protected-shell-overview-section";

describe("protected shell overview section", () => {
  it("показывает empty state, если серверов нет", () => {
    const html = renderToStaticMarkup(
      <ProtectedShellOverviewSection
        activeCharacterId={null}
        activeCharacterName={null}
        activeServerName={null}
        characters={[]}
        servers={[]}
      />,
    );

    expect(html).toContain("Доступных серверов пока нет");
  });

  it("показывает empty state для сервера без персонажей", () => {
    const html = renderToStaticMarkup(
      <ProtectedShellOverviewSection
        activeCharacterId={null}
        activeCharacterName={null}
        activeServerName="Downtown"
        characters={[]}
        servers={[{ id: "server-1", name: "Downtown" }]}
      />,
    );

    expect(html).toContain("Персонажей на сервере пока нет");
    expect(html).toContain("Следующий шаг: добавить выбор и создание персонажа");
  });
});
