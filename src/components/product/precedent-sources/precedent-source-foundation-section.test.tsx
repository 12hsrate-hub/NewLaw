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
        sourceIndexes={[
          {
            id: "source-1",
            serverId: "server-1",
            indexUrl: "https://forum.gta5rp.com/forums/zakonodatelnaja-baza.262/",
            isEnabled: true,
          },
        ]}
        sourceTopics={[]}
      />,
    );

    expect(html).toContain("Precedent Corpus Review");
    expect(html).toContain("Blackberry");
    expect(html).toContain("precedent source topics пока не заведены");
    expect(html).toContain("Запустить precedent discovery");
  });

  it("показывает source topic list, manual override и precedent review controls", () => {
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
            latestImportRun: {
              status: "success",
              startedAt: new Date("2026-04-20T10:00:00.000Z"),
              summary: "Извлечено precedents: 1.",
              error: null,
            },
            precedents: [
              {
                id: "precedent-1",
                displayTitle: "Судебный прецедент № 1",
                precedentKey: "sudebnyi_precedent_1",
                precedentLocatorKey: "precedent_1",
                validityStatus: "applicable",
                currentVersionId: null,
                latestVersionStatus: "imported_draft",
                versionCount: 1,
                versions: [
                  {
                    id: "version-1",
                    status: "imported_draft",
                    importedAt: new Date("2026-04-20T10:00:00.000Z"),
                    confirmedAt: null,
                    confirmedByAccountEmail: null,
                    sourcePostsCount: 2,
                    blocksCount: 1,
                    sourceSnapshotHash: "source-hash",
                    normalizedTextHash: "normalized-hash",
                    blockTypes: ["unstructured"],
                  },
                ],
              },
            ],
          },
        ]}
        status="precedent-import-created"
      />,
    );

    expect(html).toContain("Precedent import завершён. Созданы новые imported_draft версии.");
    expect(html).toContain("Решение Верховного суда");
    expect(html).toContain("Сохранить manual override");
    expect(html).toContain("Добавить precedent source topic");
    expect(html).toContain("Импортировать source topic");
    expect(html).toContain("Судебный прецедент № 1");
    expect(html).toContain("Подтвердить как current");
    expect(html).toContain("Обновить validity");
    expect(html).toContain("weak-structure warning");
    expect(html).toContain("не смешиваются");
    expect(html).toContain('value="/internal/laws"');
  });
});
