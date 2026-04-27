import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SectionHeader } from "@/components/ui/section-header";

describe("SectionHeader", () => {
  it("рендерит единый ordinary heading с описанием, meta и actions", () => {
    const html = renderToStaticMarkup(
      <SectionHeader
        actions={<Link href="/servers">Открыть серверы</Link>}
        description="Короткое описание рабочей зоны."
        eyebrow="Раздел"
        meta={<span>Meta</span>}
        title="Заголовок раздела"
      />,
    );

    expect(html).toContain("Раздел");
    expect(html).toContain("Заголовок раздела");
    expect(html).toContain("Короткое описание рабочей зоны.");
    expect(html).toContain("Meta");
    expect(html).toContain("Открыть серверы");
  });
});
