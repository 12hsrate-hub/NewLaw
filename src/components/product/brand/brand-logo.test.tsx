import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandLogo } from "@/components/product/brand/brand-logo";

describe("BrandLogo", () => {
  it("рендерит знак и wordmark c золотой пятёркой", () => {
    const html = renderToStaticMarkup(<BrandLogo size="sm" variant="compact" />);

    expect(html).toContain('data-size="sm"');
    expect(html).toContain('data-variant="compact"');
    expect(html).toContain("Lawyer");
    expect(html).toContain(">5<");
    expect(html).toContain("RP");
    expect(html).toContain("text-[var(--accent)]");
  });
});
