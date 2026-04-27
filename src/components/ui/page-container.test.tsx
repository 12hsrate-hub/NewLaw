import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageContainer } from "@/components/ui/page-container";

describe("PageContainer", () => {
  it("рендерит wide variant для широких ordinary pages", () => {
    const html = renderToStaticMarkup(
      <PageContainer as="main" contentClassName="space-y-4" variant="wide">
        <div>Wide content</div>
      </PageContainer>,
    );

    expect(html).toContain('data-variant="wide"');
    expect(html).toContain("max-w-[1440px]");
    expect(html).toContain("px-6");
  });

  it("рендерит split variant для двухколоночных сценариев", () => {
    const html = renderToStaticMarkup(
      <PageContainer contentClassName="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" variant="split">
        <div>Split content</div>
      </PageContainer>,
    );

    expect(html).toContain('data-variant="split"');
    expect(html).toContain("max-w-[1440px]");
    expect(html).toContain("lg:grid-cols-[minmax(0,1fr)_360px]");
  });

  it("рендерит readable variant для узких информационных страниц", () => {
    const html = renderToStaticMarkup(
      <PageContainer variant="readable">
        <div>Readable content</div>
      </PageContainer>,
    );

    expect(html).toContain('data-variant="readable"');
    expect(html).toContain("max-w-[880px]");
  });

  it("рендерит full variant без общего max-width", () => {
    const html = renderToStaticMarkup(
      <PageContainer variant="full">
        <div>Full content</div>
      </PageContainer>,
    );

    expect(html).toContain('data-variant="full"');
    expect(html).toContain("max-w-none");
  });

  it("включает workspace tone только по запросу", () => {
    const workspaceHtml = renderToStaticMarkup(
      <PageContainer tone="workspace" variant="readable">
        <div>Workspace tone</div>
      </PageContainer>,
    );
    const plainHtml = renderToStaticMarkup(
      <PageContainer tone="plain" variant="readable">
        <div>Plain tone</div>
      </PageContainer>,
    );

    expect(workspaceHtml).toContain('data-tone="workspace"');
    expect(workspaceHtml).toContain("theme-workspace");
    expect(plainHtml).toContain('data-tone="plain"');
    expect(plainHtml).not.toContain("theme-workspace");
  });
});
