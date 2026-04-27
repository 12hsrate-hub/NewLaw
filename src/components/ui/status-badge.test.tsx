import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/ui/status-badge";

describe("StatusBadge", () => {
  it("поддерживает semantic tones без дублирования бизнес-логики", () => {
    const successHtml = renderToStaticMarkup(<StatusBadge tone="success">Готово</StatusBadge>);
    const warningHtml = renderToStaticMarkup(<StatusBadge tone="warning">Внимание</StatusBadge>);
    const infoHtml = renderToStaticMarkup(<StatusBadge tone="info">Подсказка</StatusBadge>);

    expect(successHtml).toContain("Готово");
    expect(successHtml).toContain("bg-[#4a8a68]/15");
    expect(warningHtml).toContain("Внимание");
    expect(warningHtml).toContain("bg-[#b78739]/16");
    expect(infoHtml).toContain("Подсказка");
    expect(infoHtml).toContain("bg-[#5e82ac]/16");
  });
});
