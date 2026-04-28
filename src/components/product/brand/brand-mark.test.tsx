import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandMark } from "@/components/product/brand/brand-mark";

describe("BrandMark", () => {
  it("рендерит inline svg и поддерживает размер", () => {
    const html = renderToStaticMarkup(<BrandMark size="lg" />);

    expect(html).toContain("<svg");
    expect(html).toContain('data-size="lg"');
    expect(html).toContain("h-12");
    expect(html).toContain("w-12");
    expect(html).toContain("var(--accent)");
  });
});
