import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DocumentTrustorRegistryPrefill } from "@/components/product/document-area/document-trustor-registry-prefill";

describe("document trustor registry prefill", () => {
  it("рендерит chooser как local-only prefill без document workflow hub semantics", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentTrustorRegistryPrefill, {
        items: [
          {
            id: "trustor-1",
            fullName: "Иван Доверителев",
            passportNumber: "AA-001",
            phone: "+7 900 000-00-00",
            note: "Проверенный представитель",
            isRepresentativeReady: true,
          },
        ],
        serverCode: "blackberry",
        onApply: vi.fn(),
      }),
    );

    expect(html).toContain("Подставить доверителя из списка");
    expect(html).toContain("Подставить в документ");
    expect(html).toContain('/account/trustors?server=blackberry');
    expect(html).not.toContain("Claims");
    expect(html).not.toContain("Assistant");
  });

  it("честно показывает fallback, если на сервере нет доверителей", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentTrustorRegistryPrefill, {
        items: [],
        serverCode: "blackberry",
        onApply: vi.fn(),
      }),
    );

    expect(html).toContain("Можно заполнить данные доверителя");
    expect(html).toContain('/account/trustors?server=blackberry');
  });
});
