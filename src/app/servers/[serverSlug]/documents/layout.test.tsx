import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ServerDocumentsLayout from "@/app/servers/[serverSlug]/documents/layout";

describe("/servers/[serverSlug]/documents layout", () => {
  it("использует wide workspace container для ordinary documents area", () => {
    const html = renderToStaticMarkup(
      ServerDocumentsLayout({
        children: createElement("div", null, "Documents content"),
      }),
    );

    expect(html).toContain('data-variant="wide"');
    expect(html).toContain("Documents content");
  });
});
