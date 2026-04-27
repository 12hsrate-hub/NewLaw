import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccountDocumentsPersistedOverview } from "@/components/product/document-area/document-persistence-overview";

describe("account documents persisted overview", () => {
  it("показывает продуктовый empty state для account documents", () => {
    const html = renderToStaticMarkup(
      createElement(AccountDocumentsPersistedOverview, {
        documents: [],
        servers: [],
      }),
    );

    expect(html).toContain("Пока нет документов");
    expect(html).toContain("Созданные черновики и собранные документы появятся здесь.");
  });
});
