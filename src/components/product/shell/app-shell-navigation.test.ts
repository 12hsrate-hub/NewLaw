import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppShellHeader } from "@/components/product/shell/app-shell-header";
import { ProtectedShellOverviewSection } from "@/components/product/shell/protected-shell-overview-section";

describe("app shell navigation", () => {
  it("даёт super_admin прямой вход в internal contour и access requests", () => {
    const html = renderToStaticMarkup(
      createElement(AppShellHeader, {
        accountEmail: "admin@example.com",
        accountLogin: "admin",
        activeCharacterId: null,
        activeCharacterName: null,
        activeServerId: "server-1",
        activeServerName: "Blackberry",
        characters: [],
        currentPath: "/app",
        isSuperAdmin: true,
        mustChangePassword: false,
        servers: [{ id: "server-1", name: "Blackberry" }],
      }),
    );

    expect(html).toContain("Защищённая зона");
    expect(html).toContain('href="/internal"');
    expect(html).toContain('href="/internal/access-requests"');
    expect(html).not.toContain('href="/app/admin-laws"');
    expect(html).not.toContain('href="/app/admin-security"');
  });

  it("показывает из compatibility /app переходы в account, documents, trustors, assistant и servers", () => {
    const html = renderToStaticMarkup(
      createElement(ProtectedShellOverviewSection, {
        activeCharacterId: null,
        activeCharacterName: null,
        activeServerName: "Blackberry",
        characters: [],
        servers: [{ id: "server-1", name: "Blackberry" }],
      }),
    );

    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/account/characters"');
    expect(html).toContain('href="/account/documents"');
    expect(html).toContain('href="/account/trustors"');
    expect(html).toContain('href="/assistant"');
    expect(html).toContain('href="/servers"');
    expect(html).not.toContain('href="/internal"');
  });
});
