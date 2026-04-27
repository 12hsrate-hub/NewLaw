import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductStateCard } from "@/components/product/states/product-state-card";

describe("ProductStateCard", () => {
  it("рендерит заголовок, описание, бейджи и действия", () => {
    const html = renderToStaticMarkup(
      <ProductStateCard
        badges={["Сервер: Blackberry", "Персонаж не выбран"]}
        description="Для этого действия нужен персонаж на выбранном сервере."
        eyebrow="Документы"
        helperText="Сначала создайте персонажа и вернитесь к этому разделу."
        primaryAction={{
          href: "/account/characters?server=blackberry",
          label: "Открыть персонажей сервера",
        }}
        secondaryAction={{
          href: "/servers",
          label: "Вернуться к серверам",
        }}
        title="Сначала нужен персонаж"
      />,
    );

    expect(html).toContain("Документы");
    expect(html).toContain("Сначала нужен персонаж");
    expect(html).toContain("Для этого действия нужен персонаж на выбранном сервере.");
    expect(html).toContain("Сначала создайте персонажа и вернитесь к этому разделу.");
    expect(html).toContain("Сервер: Blackberry");
    expect(html).toContain("/account/characters?server=blackberry");
    expect(html).toContain("/servers");
  });
});
