import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LawSourceManagementSection } from "@/components/product/law-sources/law-source-management-section";

describe("law source management section", () => {
  it("показывает empty state, если серверов пока нет", () => {
    const html = renderToStaticMarkup(
      <LawSourceManagementSection laws={[]} servers={[]} sourceIndexes={[]} />,
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
        laws={[
          {
            id: "law-1",
            serverId: "server-1",
            lawKey: "criminal_code",
            title: "Уголовный кодекс",
            topicUrl: "https://forum.gta5rp.com/threads/criminal-code.100/",
            lawKind: "primary",
            isExcluded: false,
            classificationOverride: null,
            currentVersionId: null,
            latestVersionStatus: null,
            versionCount: 0,
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
    expect(html).toContain("Уголовный кодекс");
    expect(html).toContain("Запустить discovery");
    expect(html).toContain("Импортировать тему");
  });
});
