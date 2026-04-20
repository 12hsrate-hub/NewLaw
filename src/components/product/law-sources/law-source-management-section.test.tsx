import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LawSourceManagementSection } from "@/components/product/law-sources/law-source-management-section";

describe("law source management section", () => {
  it("показывает empty state, если серверов пока нет", () => {
    const html = renderToStaticMarkup(
      <LawSourceManagementSection servers={[]} sourceIndexes={[]} />,
    );

    expect(html).toContain("Серверы пока не доступны");
  });

  it("рендерит список source indexes по серверу и форму добавления", () => {
    const html = renderToStaticMarkup(
      <LawSourceManagementSection
        servers={[
          {
            id: "server-1",
            name: "Downtown",
          },
        ]}
        sourceIndexes={[
          {
            id: "source-1",
            serverId: "server-1",
            indexUrl: "https://forum.gta5rp.com/forums/laws",
            isEnabled: true,
            lastDiscoveredAt: null,
            lastDiscoveryStatus: null,
            lastDiscoveryError: null,
          },
        ]}
        status="law-source-created"
      />,
    );

    expect(html).toContain("Internal Source Management");
    expect(html).toContain("Downtown");
    expect(html).toContain("https://forum.gta5rp.com/forums/laws");
    expect(html).toContain("Добавить index URL");
    expect(html).toContain("Источник законодательной базы добавлен.");
  });
});
