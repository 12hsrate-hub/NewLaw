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
        bootstrapHealthByServerId={{
          "server-1": {
            status: "corpus_bootstrap_incomplete",
            primaryLawCount: 1,
            supplementCount: 0,
            ignoredCount: 0,
            currentPrimaryCount: 0,
            draftOnlyPrimaryCount: 0,
            missingImportPrimaryCount: 1,
            hasDiscoveryFailure: false,
          },
        }}
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
            versions: [],
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
    expect(html).toContain("corpus_bootstrap_incomplete");
    expect(html).toContain("Current Primary Law Retrieval");
    expect(html).toContain('value="/internal/laws"');
  });

  it("показывает review controls и retrieval preview для current corpus", () => {
    const html = renderToStaticMarkup(
      <LawSourceManagementSection
        servers={[
          {
            id: "server-1",
            name: "Downtown",
          },
        ]}
        sourceIndexes={[]}
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
            currentVersionId: "version-1",
            latestVersionStatus: "current",
            versionCount: 2,
            versions: [
              {
                id: "version-1",
                status: "current",
                importedAt: new Date("2026-04-20T10:00:00.000Z"),
                confirmedAt: new Date("2026-04-20T11:00:00.000Z"),
                confirmedByAccountEmail: "admin@example.com",
                sourcePostsCount: 2,
                blocksCount: 5,
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
              },
              {
                id: "version-2",
                status: "imported_draft",
                importedAt: new Date("2026-04-21T10:00:00.000Z"),
                confirmedAt: null,
                confirmedByAccountEmail: null,
                sourcePostsCount: 2,
                blocksCount: 6,
                sourceSnapshotHash: "source-hash-2",
                normalizedTextHash: "normalized-hash-2",
              },
            ],
          },
        ]}
        retrievalPreview={{
          serverId: "server-1",
          serverName: "Downtown",
          query: "статья 1",
          resultCount: 1,
          corpusSnapshotHash: "snapshot-hash",
          currentVersionIds: ["version-1"],
          results: [
            {
              serverId: "server-1",
              lawId: "law-1",
              lawKey: "criminal_code",
              lawTitle: "Уголовный кодекс",
              lawVersionId: "version-1",
              lawVersionStatus: "current",
              lawBlockId: "block-1",
              blockType: "article",
              blockOrder: 1,
              articleNumberNormalized: "1",
              snippet: "Статья 1. Общие положения.",
              sourceTopicUrl: "https://forum.gta5rp.com/threads/criminal-code.100/",
              sourcePosts: [
                {
                  postExternalId: "9001",
                  postUrl: "https://forum.gta5rp.com/threads/criminal-code.100/post-9001",
                  postOrder: 0,
                },
              ],
              metadata: {
                sourceSnapshotHash: "source-hash",
                normalizedTextHash: "normalized-hash",
                corpusSnapshotHash: "snapshot-hash",
              },
            },
          ],
        }}
        selectedPreviewServerId="server-1"
      />,
    );

    expect(html).toContain("Подтвердить как current");
    expect(html).toContain("source_snapshot_hash");
    expect(html).toContain("Current Primary Law Retrieval");
    expect(html).toContain("Статья 1. Общие положения.");
  });
});
