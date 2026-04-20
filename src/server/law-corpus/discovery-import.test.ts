import { describe, expect, it, vi } from "vitest";

import {
  runLawSourceDiscovery,
  runLawTopicImport,
} from "@/server/law-corpus/discovery-import";

const discoveryHtml = `
  <div class="structItem-title">
    <a href="/threads/ugolovnyi-kodeks.1001/" data-tp-primary="on">Уголовный кодекс</a>
  </div>
  <div class="structItem-title">
    <a href="/threads/normativnye-akty-izmenenija-zakonodatelnoj-bazy.1002/" data-tp-primary="on">
      Нормативные акты изменения законодательной базы
    </a>
  </div>
  <div class="structItem-title">
    <a href="/threads/sudebnye-precedenty.1003/" data-tp-primary="on">Судебные прецеденты</a>
  </div>
`;

const paginatedDiscoveryHtml = `
  <div class="structItem-title">
    <a href="/threads/ugolovnyi-kodeks.1001/" data-tp-primary="on">Уголовный кодекс</a>
  </div>
  <nav class="pageNavWrapper pageNavWrapper--mixed">
    <a class="pageNav-page" href="/forums/laws/page-2">2</a>
    <a class="pageNav-jump pageNav-jump--next" href="/forums/laws/page-2">Next</a>
  </nav>
`;

const paginatedDiscoveryHtmlPage2 = `
  <div class="structItem-title">
    <a href="/threads/zakon-o-zdravoohranenii.1004/" data-tp-primary="on">
      Закон "О здравоохранении"
    </a>
  </div>
`;

const importThreadHtml = `
  <article class="message message--post js-post js-inlineModContainer is-first" data-author="Mike Hanssen" data-content="post-9001">
    <a href="/threads/ugolovnyi-kodeks.1001/post-9001">#1</a>
    <time datetime="2026-04-01T10:00:00+0300"></time>
    <div class="bbWrapper">
      <div><b>Уголовный кодекс</b><br>РАЗДЕЛ I. ОБЩАЯ ЧАСТЬ<br>ГЛАВА 1. ОСНОВЫ<br>Статья 1. Общие положения<br>ч. 1 Первый пункт.</div>
    </div>
  </article>
  <article class="message message--post js-post js-inlineModContainer" data-author="Mike Hanssen" data-content="post-9002">
    <a href="/threads/ugolovnyi-kodeks.1001/post-9002">#2</a>
    <time datetime="2026-04-01T10:05:00+0300"></time>
    <div class="bbWrapper">
      <div>Статья 2. Следующее положение<br>ч. 1 Второй пункт.</div>
    </div>
  </article>
  <article class="message message--post js-post js-inlineModContainer" data-author="Reader" data-content="post-9003">
    <a href="/threads/ugolovnyi-kodeks.1001/post-9003">#3</a>
    <time datetime="2026-04-01T10:10:00+0300"></time>
    <div class="bbWrapper">
      <div>Спасибо за публикацию.</div>
    </div>
  </article>
`;

function createDependencies() {
  return {
    getLawSourceIndexById: vi.fn().mockResolvedValue({
      id: "source-1",
      serverId: "server-1",
      indexUrl: "https://forum.gta5rp.com/forums/laws",
      isEnabled: true,
    }),
    updateLawSourceIndexDiscoveryState: vi.fn(),
    getLawByServerAndTopicExternalId: vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null),
    getLawById: vi.fn().mockResolvedValue({
      id: "law-1",
      serverId: "server-1",
      lawKey: "ugolovnyi_kodeks",
      title: "Уголовный кодекс",
      topicUrl: "https://forum.gta5rp.com/threads/ugolovnyi-kodeks.1001/",
      topicExternalId: "1001",
      lawKind: "primary",
      relatedPrimaryLawId: null,
      isExcluded: false,
      classificationOverride: null,
      internalNote: null,
    }),
    syncLawRecordFromDiscovery: vi.fn(),
    registerLawStub: vi.fn().mockImplementation(async (input) => ({
      id: `law-${input.topicExternalId}`,
      ...input,
    })),
    startLawImportRun: vi.fn().mockResolvedValue({
      id: "run-1",
      serverId: "server-1",
      status: "running",
    }),
    finishLawImportRun: vi.fn(),
    createImportedDraftLawVersion: vi.fn().mockResolvedValue({
      id: "version-1",
      lawId: "law-1",
      status: "imported_draft",
    }),
    findLawVersionByNormalizedHash: vi.fn().mockResolvedValue(null),
    replaceImportedLawSourcePosts: vi.fn(),
    replaceImportedLawBlocks: vi.fn(),
    fetchHtml: vi.fn(),
  };
}

describe("law discovery/import pipeline", () => {
  it("discovery классифицирует primary, supplement и ignored topics", async () => {
    const dependencies = createDependencies();
    dependencies.fetchHtml.mockResolvedValue(discoveryHtml);

    const result = await runLawSourceDiscovery("source-1", dependencies as never);

    expect(result.candidateCount).toBe(3);
    expect(result.createdCount).toBe(2);
    expect(result.supplementCount).toBe(1);
    expect(result.ignoredCount).toBe(1);
    expect(dependencies.registerLawStub).toHaveBeenCalledTimes(2);
    expect(dependencies.registerLawStub).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        lawKind: "supplement",
      }),
    );
  });

  it("discovery уважает manual override для уже известной темы", async () => {
    const dependencies = createDependencies();
    dependencies.fetchHtml.mockResolvedValue(discoveryHtml);

    dependencies.getLawByServerAndTopicExternalId = vi
      .fn()
      .mockResolvedValueOnce({
        id: "law-existing",
        relatedPrimaryLawId: null,
        isExcluded: false,
        classificationOverride: "supplement",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await runLawSourceDiscovery("source-1", dependencies as never);

    expect(dependencies.syncLawRecordFromDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({
        lawId: "law-existing",
        lawKind: "supplement",
      }),
    );
  });

  it("discovery обходит pagination links и не пропускает законы со второй страницы", async () => {
    const dependencies = createDependencies();
    dependencies.fetchHtml.mockImplementation(async (url: string) => {
      if (url.includes("page-2")) {
        return paginatedDiscoveryHtmlPage2;
      }

      return paginatedDiscoveryHtml;
    });

    dependencies.getLawByServerAndTopicExternalId = vi.fn().mockResolvedValue(null);

    const result = await runLawSourceDiscovery("source-1", dependencies as never);

    expect(result.pageCount).toBe(2);
    expect(result.candidateCount).toBe(2);
    expect(dependencies.registerLawStub).toHaveBeenCalledWith(
      expect.objectContaining({
        topicExternalId: "1004",
        lawKind: "primary",
      }),
    );
  });

  it("multi-post law собирается в одну imported_draft версию и останавливается на разрыве цепочки", async () => {
    const dependencies = createDependencies();
    dependencies.fetchHtml.mockResolvedValue(importThreadHtml);

    const result = await runLawTopicImport("law-1", dependencies as never);

    expect(result.createdNewVersion).toBe(true);
    expect(result.includedPostsCount).toBe(2);
    expect(dependencies.replaceImportedLawSourcePosts).toHaveBeenCalledWith({
      lawVersionId: "version-1",
      posts: expect.arrayContaining([
        expect.objectContaining({ postExternalId: "9001" }),
        expect.objectContaining({ postExternalId: "9002" }),
      ]),
    });
    expect(dependencies.replaceImportedLawBlocks).toHaveBeenCalledWith({
      lawVersionId: "version-1",
      blocks: expect.arrayContaining([
        expect.objectContaining({ blockType: "section" }),
        expect.objectContaining({ blockType: "chapter" }),
        expect.objectContaining({ blockType: "article", articleNumberNormalized: "1" }),
      ]),
    });
  });

  it("повторный import без изменения текста не создаёт новую версию", async () => {
    const dependencies = createDependencies();
    dependencies.fetchHtml.mockResolvedValue(importThreadHtml);

    dependencies.findLawVersionByNormalizedHash.mockResolvedValue({
      id: "version-existing",
      status: "current",
    });

    const result = await runLawTopicImport("law-1", dependencies as never);

    expect(result.createdNewVersion).toBe(false);
    expect(dependencies.createImportedDraftLawVersion).not.toHaveBeenCalled();
    expect(dependencies.replaceImportedLawSourcePosts).not.toHaveBeenCalled();
  });
});
