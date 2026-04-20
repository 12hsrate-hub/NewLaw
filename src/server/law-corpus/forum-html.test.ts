import { describe, expect, it } from "vitest";

import {
  buildNormalizedLawText,
  buildNormalizedTextHash,
  buildSourceSnapshotHash,
  parseForumIndexCandidates,
  parseForumIndexPaginationUrls,
  parseForumTopicPosts,
} from "@/server/law-corpus/forum-html";

const forumIndexHtml = `
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
  <nav class="pageNavWrapper pageNavWrapper--mixed">
    <a class="pageNav-page" href="/forums/laws/page-2">2</a>
    <a class="pageNav-jump pageNav-jump--next" href="/forums/laws/page-2">Next</a>
  </nav>
`;

const threadHtml = `
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
  <article class="message message--post js-post js-inlineModContainer" data-author="Another User" data-content="post-9003">
    <a href="/threads/ugolovnyi-kodeks.1001/post-9003">#3</a>
    <time datetime="2026-04-01T10:10:00+0300"></time>
    <div class="bbWrapper">
      <div>Спасибо за публикацию.</div>
    </div>
  </article>
`;

describe("forum html parser", () => {
  it("находит candidate topics из source index", () => {
    const candidates = parseForumIndexCandidates(forumIndexHtml);

    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toEqual({
      topicUrl: "https://forum.gta5rp.com/threads/ugolovnyi-kodeks.1001/",
      topicExternalId: "1001",
      title: "Уголовный кодекс",
    });
  });

  it("находит pagination links форума и дедуплицирует их", () => {
    const pageUrls = parseForumIndexPaginationUrls(
      forumIndexHtml,
      "https://forum.gta5rp.com/forums/laws",
    );

    expect(pageUrls).toEqual(["https://forum.gta5rp.com/forums/laws/page-2"]);
  });

  it("разбирает ordered set постов темы и строит hashes", () => {
    const posts = parseForumTopicPosts(
      threadHtml,
      "https://forum.gta5rp.com/threads/ugolovnyi-kodeks.1001/",
    );

    expect(posts).toHaveLength(3);
    expect(posts[0]?.postExternalId).toBe("9001");
    expect(posts[1]?.normalizedTextFragment).toContain("Статья 2. Следующее положение");

    const normalizedFullText = buildNormalizedLawText(posts.slice(0, 2));
    const sourceSnapshotHash = buildSourceSnapshotHash(posts.slice(0, 2));
    const normalizedTextHash = buildNormalizedTextHash(normalizedFullText);

    expect(normalizedFullText).toContain("Статья 1. Общие положения");
    expect(normalizedFullText).toContain("Статья 2. Следующее положение");
    expect(sourceSnapshotHash).toHaveLength(64);
    expect(normalizedTextHash).toHaveLength(64);
  });
});
