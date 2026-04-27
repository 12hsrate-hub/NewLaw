import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PrimaryHeader } from "@/components/product/shell/primary-header";

describe("primary header", () => {
  it("показывает ordinary navigation и гостевой вход для public zones", () => {
    const html = renderToStaticMarkup(
      <PrimaryHeader
        context={{
          viewer: {
            isAuthenticated: false,
            accountLogin: null,
            accountEmail: null,
            isSuperAdmin: false,
          },
          currentPath: "/assistant",
          activeServer: {
            id: null,
            name: null,
            slug: null,
          },
          navigation: {
            documentsHref: null,
            internalHref: null,
          },
        }}
      />,
    );

    expect(html).toContain("Lawyer5RP");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/assistant"');
    expect(html).toContain('href="/servers"');
    expect(html).toContain('href="/account"');
    expect(html).toContain("Сервер не выбран");
    expect(html).toContain('href="/sign-in?next=%2Fassistant"');
    expect(html).not.toContain("Служебная зона");
  });

  it("добавляет служебную ссылку и contextual documents link для super_admin", () => {
    const html = renderToStaticMarkup(
      <PrimaryHeader
        context={{
          viewer: {
            isAuthenticated: true,
            accountLogin: "admin",
            accountEmail: "admin@example.com",
            isSuperAdmin: true,
          },
          currentPath: "/account",
          activeServer: {
            id: "server-1",
            name: "Blackberry",
            slug: "blackberry",
          },
          navigation: {
            documentsHref: "/servers/blackberry/documents",
            internalHref: "/internal",
          },
        }}
      />,
    );

    expect(html).toContain("Вы вошли как");
    expect(html).toContain("admin");
    expect(html).toContain("Blackberry");
    expect(html).toContain('href="/servers/blackberry/documents"');
    expect(html).toContain('href="/internal"');
    expect(html).toContain("Служебная зона");
  });
});
