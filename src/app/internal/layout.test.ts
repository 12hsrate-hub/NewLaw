import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import InternalRouteLayout from "@/app/internal/layout";

describe("internal layout", () => {
  it("рендерит shared internal nav для overview, laws, precedents, security, access requests и health", () => {
    const html = renderToStaticMarkup(
      createElement(
        InternalRouteLayout,
        null,
        createElement("div", null, "Child content"),
      ),
    );

    expect(html).toContain("Internal navigation");
    expect(html).toContain('href="/internal"');
    expect(html).toContain('href="/internal/laws"');
    expect(html).toContain('href="/internal/precedents"');
    expect(html).toContain('href="/internal/security"');
    expect(html).toContain('href="/internal/access-requests"');
    expect(html).toContain('href="/internal/health"');
    expect(html).toContain("Super Admin Panel");
  });
});
