import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/app-shell/context", () => ({
  getAppShellContext: vi.fn(),
}));

vi.mock("@/db/repositories/law-source-index.repository", () => ({
  listLawSourceIndexes: vi.fn(),
}));

vi.mock("@/db/repositories/law.repository", () => ({
  listLawsForAdminReview: vi.fn(),
}));

vi.mock("@/server/law-corpus/retrieval", () => ({
  searchCurrentLawCorpus: vi.fn(),
}));

import AdminLawsPage from "@/app/(protected-admin)/app/admin-laws/page";
import { listLawSourceIndexes } from "@/db/repositories/law-source-index.repository";
import { listLawsForAdminReview } from "@/db/repositories/law.repository";
import { getAppShellContext } from "@/server/app-shell/context";
import { searchCurrentLawCorpus } from "@/server/law-corpus/retrieval";

describe("/app/admin-laws", () => {
  it("рендерит super_admin-only law source management screen", async () => {
    vi.mocked(getAppShellContext).mockResolvedValue({
      account: {
        id: "account-1",
        email: "admin@example.com",
        login: "admin_user",
        isSuperAdmin: true,
        mustChangePassword: false,
      },
      activeServer: {
        id: "server-1",
        name: "Downtown",
      },
      activeCharacter: null,
      characters: [],
      servers: [
        {
          id: "server-1",
          name: "Downtown",
        },
      ],
      currentPath: "/app/admin-laws",
    } as never);
    vi.mocked(listLawSourceIndexes).mockResolvedValue([
      {
        id: "source-1",
        serverId: "server-1",
        indexUrl: "https://forum.gta5rp.com/forums/laws",
        isEnabled: true,
        lastDiscoveredAt: null,
        lastDiscoveryStatus: null,
        lastDiscoveryError: null,
      },
    ] as never);
    vi.mocked(listLawsForAdminReview).mockResolvedValue([
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
        versions: [
          {
            id: "version-1",
            status: "imported_draft",
            importedAt: new Date("2026-04-20T10:00:00.000Z"),
            confirmedAt: null,
            confirmedByAccount: null,
            sourceSnapshotHash: "source-hash",
            normalizedTextHash: "normalized-hash",
            _count: {
              sourcePosts: 2,
              blocks: 5,
            },
          },
        ],
        _count: {
          versions: 1,
        },
      },
    ] as never);
    vi.mocked(searchCurrentLawCorpus).mockResolvedValue({
      query: "статья 1",
      serverId: "server-1",
      resultCount: 1,
      corpusSnapshot: {
        serverId: "server-1",
        generatedAt: "2026-04-20T10:00:00.000Z",
        currentVersionIds: ["version-current"],
        corpusSnapshotHash: "snapshot-hash",
      },
      results: [
        {
          serverId: "server-1",
          lawId: "law-1",
          lawKey: "criminal_code",
          lawTitle: "Уголовный кодекс",
          lawVersionId: "version-current",
          lawVersionStatus: "current",
          lawBlockId: "block-1",
          blockType: "article",
          blockOrder: 1,
          articleNumberNormalized: "1",
          snippet: "Статья 1. Общие положения.",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/criminal-code.100/",
          sourcePosts: [],
          metadata: {
            sourceSnapshotHash: "source-hash",
            normalizedTextHash: "normalized-hash",
            corpusSnapshotHash: "snapshot-hash",
          },
        },
      ],
    } as never);

    const html = renderToStaticMarkup(
      await AdminLawsPage({
        searchParams: Promise.resolve({
          status: "law-source-created",
          previewQuery: "статья 1",
          previewServerId: "server-1",
        }),
      }),
    );

    expect(getAppShellContext).toHaveBeenCalledWith("/app/admin-laws");
    expect(searchCurrentLawCorpus).toHaveBeenCalledWith({
      serverId: "server-1",
      query: "статья 1",
    });
    expect(html).toContain("Internal Source Management");
    expect(html).toContain("Downtown");
    expect(html).toContain("https://forum.gta5rp.com/forums/laws");
    expect(html).toContain("Уголовный кодекс");
    expect(html).toContain("Запустить discovery");
    expect(html).toContain("Импортировать тему");
    expect(html).toContain("Подтвердить как current");
    expect(html).toContain("Current Primary Law Retrieval");
  });
});
