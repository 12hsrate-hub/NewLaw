import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmptyStateCard } from "@/components/product/foundation/empty-state-card";

describe("EmptyStateCard", () => {
  it("рендерит пустое состояние через общий product state wrapper", () => {
    const html = renderToStaticMarkup(
      <EmptyStateCard
        description="Пока здесь нет данных."
        eyebrow="Раздел"
        primaryAction={{
          href: "/servers",
          label: "Открыть серверы",
        }}
        title="Пока пусто"
      />,
    );

    expect(html).toContain("Пока пусто");
    expect(html).toContain("Пока здесь нет данных.");
    expect(html).toContain("/servers");
    expect(html).toContain("Открыть серверы");
  });
});
