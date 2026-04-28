import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ButtonLink } from "@/components/ui/button-link";

describe("ButtonLink", () => {
  it("рендерит ссылку-кнопку с безопасными props", () => {
    const html = renderToStaticMarkup(
      <ButtonLink className="custom-link" fullWidth href="/servers" prefetch={false} variant="danger">
        Открыть серверы
      </ButtonLink>,
    );

    expect(html).toContain('href="/servers"');
    expect(html).toContain("Открыть серверы");
    expect(html).toContain("w-full");
    expect(html).toContain("custom-link");
    expect(html).toContain("var(--button-danger-bg)");
  });
});
