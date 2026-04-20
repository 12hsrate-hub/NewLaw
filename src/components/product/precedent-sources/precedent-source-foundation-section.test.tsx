import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PrecedentSourceFoundationSection } from "@/components/product/precedent-sources/precedent-source-foundation-section";

describe("precedent source foundation section", () => {
  it("рендерит empty state, если source topics пока нет", () => {
    const html = renderToStaticMarkup(
      <PrecedentSourceFoundationSection
        servers={[
          {
            id: "server-1",
            name: "Blackberry",
          },
        ]}
        sourceIndexes={[]}
        sourceTopics={[]}
      />,
    );

    expect(html).toContain("Precedent Source Topic Foundation");
    expect(html).toContain("Blackberry");
    expect(html).toContain("precedent source topics пока не заведены");
  });

  it("показывает source topic list и manual override form", () => {
    const html = renderToStaticMarkup(
      <PrecedentSourceFoundationSection
        servers={[
          {
            id: "server-1",
            name: "Blackberry",
          },
        ]}
        sourceIndexes={[
          {
            id: "source-1",
            serverId: "server-1",
            indexUrl: "https://forum.gta5rp.com/forums/zakonodatelnaja-baza.262/",
            isEnabled: true,
          },
        ]}
        sourceTopics={[
          {
            id: "topic-1",
            serverId: "server-1",
            sourceIndexId: "source-1",
            topicUrl: "https://forum.gta5rp.com/threads/precedent.1001/",
            topicExternalId: "1001",
            title: "Решение Верховного суда",
            isExcluded: false,
            classificationOverride: "precedent",
            internalNote: "Проверить split в будущем.",
            lastDiscoveredAt: null,
            lastDiscoveryStatus: null,
            lastDiscoveryError: null,
            sourceIndexUrl: "https://forum.gta5rp.com/forums/zakonodatelnaja-baza.262/",
            precedentsCount: 0,
          },
        ]}
        status="precedent-source-created"
      />,
    );

    expect(html).toContain("Precedent source topic добавлен.");
    expect(html).toContain("Решение Верховного суда");
    expect(html).toContain("Сохранить manual override");
    expect(html).toContain("Добавить precedent source topic");
    expect(html).toContain("не смешиваются");
  });
});
