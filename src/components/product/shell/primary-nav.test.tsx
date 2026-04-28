import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PrimaryNav } from "@/components/product/shell/primary-nav";

describe("primary nav", () => {
  it("показывает основные product links и contextual documents link при активном сервере", () => {
    const html = renderToStaticMarkup(
      <PrimaryNav
        currentPath="/servers"
        documentsHref="/servers/blackberry/documents"
        lawyerWorkspaceHref="/servers/blackberry/lawyer"
      />,
    );

    expect(html).toContain('href="/"');
    expect(html).toContain("Главная");
    expect(html).toContain('href="/assistant"');
    expect(html).toContain("Помощник");
    expect(html).toContain('href="/servers"');
    expect(html).not.toContain('href="/account"');
    expect(html).toContain('href="/servers/blackberry/documents"');
    expect(html).toContain("Документы");
    expect(html).toContain('href="/servers/blackberry/lawyer"');
    expect(html).toContain("Кабинет");
  });

  it("не показывает documents и lawyer links без безопасного server context", () => {
    const html = renderToStaticMarkup(<PrimaryNav currentPath="/assistant" />);

    expect(html).not.toContain(">Документы<");
    expect(html).not.toContain(">Адвокатский кабинет<");
  });
});
