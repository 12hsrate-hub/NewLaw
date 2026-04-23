import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AccountLayout from "@/app/account/layout";

describe("account layout", () => {
  it("рендерит shared account subnav для overview, security, characters, documents и trustors", () => {
    const html = renderToStaticMarkup(
      createElement(
        AccountLayout,
        null,
        createElement("div", null, "Child content"),
      ),
    );

    expect(html).toContain("Навигация личного кабинета");
    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/account/security"');
    expect(html).toContain('href="/account/characters"');
    expect(html).toContain('href="/account/documents"');
    expect(html).toContain('href="/account/trustors"');
  });
});
