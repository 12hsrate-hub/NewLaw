import { describe, expect, it, vi } from "vitest";

import {
  runPrecedentSourceDiscovery,
  runPrecedentSourceTopicImport,
} from "@/server/precedent-corpus/discovery-import";

const discoveryHtml = `
  <div class="structItem-title">
    <a href="/threads/ugolovnyi-kodeks.1001/" data-tp-primary="on">Уголовный кодекс</a>
  </div>
  <div class="structItem-title">
    <a href="/threads/sudebnye-precedenty-verhovnogo-suda.1002/" data-tp-primary="on">
      Судебные прецеденты Верховного суда
    </a>
  </div>
  <div class="structItem-title">
    <a href="/threads/normativnye-akty-izmenenija-zakonodatelnoj-bazy.1003/" data-tp-primary="on">
      Нормативные акты изменения законодательной базы
    </a>
  </div>
`;

const paginatedDiscoveryHtml = `
  <div class="structItem-title">
    <a href="/threads/sudebnye-precedenty-verhovnogo-suda.1002/" data-tp-primary="on">
      Судебные прецеденты Верховного суда
    </a>
  </div>
  <nav class="pageNavWrapper pageNavWrapper--mixed">
    <a class="pageNav-page" href="/forums/precedents/page-2">2</a>
    <a class="pageNav-jump pageNav-jump--next" href="/forums/precedents/page-2">Next</a>
  </nav>
`;

const paginatedDiscoveryHtmlPage2 = `
  <div class="structItem-title">
    <a href="/threads/sudebnye-precedenty-apelljacionnogo-suda.1004/" data-tp-primary="on">
      Судебные прецеденты Апелляционного суда
    </a>
  </div>
`;

const splitThreadHtml = `
  <article class="message message--post js-post js-inlineModContainer is-first" data-author="Court Reporter" data-content="post-9101">
    <a href="/threads/sudebnye-precedenty-verhovnogo-suda.1002/post-9101">#1</a>
    <time datetime="2026-04-01T10:00:00+0300"></time>
    <div class="bbWrapper">
      <div>
        Судебный прецедент № 1<br>
        Обстоятельства дела<br>
        Факты первого прецедента.<br>
        Вопрос права<br>
        Можно ли применять норму в этой ситуации?
      </div>
    </div>
  </article>
  <article class="message message--post js-post js-inlineModContainer" data-author="Court Reporter" data-content="post-9102">
    <a href="/threads/sudebnye-precedenty-verhovnogo-suda.1002/post-9102">#2</a>
    <time datetime="2026-04-01T10:05:00+0300"></time>
    <div class="bbWrapper">
      <div>
        Позиция суда<br>
        Суд приходит к выводу, что правило применимо.<br>
        Резолютивная часть<br>
        Требование подлежит удовлетворению.
      </div>
    </div>
  </article>
  <article class="message message--post js-post js-inlineModContainer" data-author="Court Reporter" data-content="post-9103">
    <a href="/threads/sudebnye-precedenty-verhovnogo-suda.1002/post-9103">#3</a>
    <time datetime="2026-04-01T10:10:00+0300"></time>
    <div class="bbWrapper">
      <div>
        Судебный прецедент № 2<br>
        Обстоятельства дела<br>
        Факты второго прецедента.<br>
        Мотивировочная часть<br>
        Дополнительная аргументация суда.
      </div>
    </div>
  </article>
`;

const fallbackThreadHtml = `
  <article class="message message--post js-post js-inlineModContainer is-first" data-author="Court Reporter" data-content="post-9201">
    <a href="/threads/pretsedent-bez-yavnyh-markerov.2002/post-9201">#1</a>
    <time datetime="2026-04-01T10:00:00+0300"></time>
    <div class="bbWrapper">
      <div>Текст темы без надёжных заголовков precedent units.</div>
    </div>
  </article>
  <article class="message message--post js-post js-inlineModContainer" data-author="Court Reporter" data-content="post-9202">
    <a href="/threads/pretsedent-bez-yavnyh-markerov.2002/post-9202">#2</a>
    <time datetime="2026-04-01T10:05:00+0300"></time>
    <div class="bbWrapper">
      <div>Продолжение текста без явного split marker.</div>
    </div>
  </article>
`;

function createDependencies() {
  return {
    getLawSourceIndexById: vi.fn().mockResolvedValue({
      id: "source-1",
      serverId: "server-1",
      indexUrl: "https://forum.gta5rp.com/forums/precedents",
      isEnabled: true,
    }),
    getLawByServerAndTopicExternalId: vi
      .fn()
      .mockResolvedValueOnce({ id: "law-1", lawKind: "primary" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null),
    createPrecedentSourceTopicRecord: vi.fn().mockImplementation(async (input) => ({
      id: `source-topic-${input.topicExternalId}`,
      ...input,
    })),
    findPrecedentSourceTopicByServerAndTopicExternalId: vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null),
    getPrecedentSourceTopicById: vi.fn().mockResolvedValue({
      id: "source-topic-1002",
      serverId: "server-1",
      sourceIndexId: "source-1",
      topicUrl: "https://forum.gta5rp.com/threads/sudebnye-precedenty-verhovnogo-suda.1002/",
      title: "Судебные прецеденты Верховного суда",
      isExcluded: false,
      importRuns: [],
      precedents: [],
    }),
    getPrecedentBySourceTopicAndLocator: vi.fn().mockResolvedValue(null),
    syncPrecedentSourceTopicFromDiscovery: vi.fn(),
    updatePrecedentSourceTopicDiscoveryState: vi.fn(),
    startPrecedentImportRun: vi.fn().mockResolvedValue({
      id: "run-1",
      serverId: "server-1",
      status: "running",
    }),
    finishPrecedentImportRun: vi.fn(),
    registerPrecedentStub: vi.fn().mockImplementation(async (input) => ({
      id: `precedent-${input.precedentLocatorKey}`,
      serverId: input.serverId,
      precedentSourceTopicId: input.precedentSourceTopicId,
      displayTitle: input.displayTitle,
      precedentLocatorKey: input.precedentLocatorKey,
    })),
    findPrecedentVersionByNormalizedHash: vi.fn().mockResolvedValue(null),
    createImportedDraftPrecedentVersion: vi.fn().mockImplementation(async (input) => ({
      id: `version-${input.precedentId}`,
      precedentId: input.precedentId,
      status: "imported_draft",
    })),
    replaceImportedPrecedentSourcePosts: vi.fn(),
    replaceImportedPrecedentBlocks: vi.fn(),
    fetchHtml: vi.fn(),
  };
}

describe("precedent discovery/import pipeline", () => {
  it("discovery идёт отдельным pipeline и не делает precedent из law topics без override", async () => {
    const dependencies = createDependencies();
    dependencies.fetchHtml.mockResolvedValue(discoveryHtml);

    const result = await runPrecedentSourceDiscovery("source-1", dependencies as never);

    expect(result.candidateCount).toBe(3);
    expect(result.createdCount).toBe(1);
    expect(result.ignoredCount).toBe(2);
    expect(dependencies.createPrecedentSourceTopicRecord).toHaveBeenCalledTimes(1);
    expect(dependencies.createPrecedentSourceTopicRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        topicExternalId: "1002",
        title: "Судебные прецеденты Верховного суда",
      }),
    );
  });

  it("один source topic может породить несколько precedents и поддерживает multi-post continuation", async () => {
    const dependencies = createDependencies();
    dependencies.fetchHtml.mockResolvedValue(splitThreadHtml);

    const result = await runPrecedentSourceTopicImport("source-topic-1002", dependencies as never);

    expect(result.extractedCount).toBe(2);
    expect(result.createdPrecedents).toBe(2);
    expect(result.createdVersions).toBe(2);
    expect(dependencies.registerPrecedentStub).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        precedentLocatorKey: "precedent_1",
      }),
    );
    expect(dependencies.replaceImportedPrecedentSourcePosts).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        posts: expect.arrayContaining([
          expect.objectContaining({ postExternalId: "9101" }),
          expect.objectContaining({ postExternalId: "9102" }),
        ]),
      }),
    );
    expect(dependencies.replaceImportedPrecedentBlocks).toHaveBeenCalledWith({
      precedentVersionId: "version-precedent-precedent_1",
      blocks: expect.arrayContaining([
        expect.objectContaining({ blockType: "facts" }),
        expect.objectContaining({ blockType: "issue" }),
        expect.objectContaining({ blockType: "holding" }),
        expect.objectContaining({ blockType: "resolution" }),
      ]),
    });
  });

  it("fallback-ится в один precedent, если split ненадёжен", async () => {
    const dependencies = createDependencies();
    dependencies.fetchHtml.mockResolvedValue(fallbackThreadHtml);

    const result = await runPrecedentSourceTopicImport("source-topic-1002", dependencies as never);

    expect(result.extractedCount).toBe(1);
    expect(dependencies.registerPrecedentStub).toHaveBeenCalledWith(
      expect.objectContaining({
        displayTitle: "Судебные прецеденты Верховного суда",
      }),
    );
    expect(dependencies.replaceImportedPrecedentBlocks).toHaveBeenCalledWith({
      precedentVersionId: "version-precedent-precedent_1",
      blocks: [
        expect.objectContaining({
          blockType: "unstructured",
        }),
      ],
    });
  });

  it("precedent discovery обходит pagination links отдельным pipeline", async () => {
    const dependencies = createDependencies();
    dependencies.fetchHtml.mockImplementation(async (url: string) => {
      if (url.includes("page-2")) {
        return paginatedDiscoveryHtmlPage2;
      }

      return paginatedDiscoveryHtml;
    });
    dependencies.getLawByServerAndTopicExternalId = vi.fn().mockResolvedValue(null);
    dependencies.findPrecedentSourceTopicByServerAndTopicExternalId = vi.fn().mockResolvedValue(null);

    const result = await runPrecedentSourceDiscovery("source-1", dependencies as never);

    expect(result.pageCount).toBe(2);
    expect(result.candidateCount).toBe(2);
    expect(dependencies.createPrecedentSourceTopicRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        topicExternalId: "1004",
      }),
    );
  });

  it("не плодит лишние версии, если normalized text не изменился", async () => {
    const dependencies = createDependencies();
    dependencies.fetchHtml.mockResolvedValue(fallbackThreadHtml);
    dependencies.findPrecedentVersionByNormalizedHash.mockResolvedValue({
      id: "version-existing",
      status: "current",
    });

    const result = await runPrecedentSourceTopicImport("source-topic-1002", dependencies as never);

    expect(result.createdVersions).toBe(0);
    expect(result.unchangedVersions).toBe(1);
    expect(dependencies.createImportedDraftPrecedentVersion).not.toHaveBeenCalled();
    expect(dependencies.replaceImportedPrecedentSourcePosts).not.toHaveBeenCalled();
  });
});
