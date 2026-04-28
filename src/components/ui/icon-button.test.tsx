import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IconButton } from "@/components/ui/icon-button";

describe("IconButton", () => {
  it("рендерит обычную кнопку с aria-label и type button по умолчанию", () => {
    const html = renderToStaticMarkup(
      <IconButton disabled label="Закрыть">
        <svg aria-hidden="true" />
      </IconButton>,
    );

    expect(html).toContain("<button");
    expect(html).toContain('aria-label="Закрыть"');
    expect(html).toContain('type="button"');
    expect(html).toContain("disabled");
  });
});
