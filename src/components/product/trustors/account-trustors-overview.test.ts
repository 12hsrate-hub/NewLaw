import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccountTrustorsOverview } from "@/components/product/trustors/account-trustors-overview";

describe("account trustors overview", () => {
  it("рендерит grouped-by-server registry overview без превращения страницы в document workflow hub", () => {
    const html = renderToStaticMarkup(
      createElement(AccountTrustorsOverview, {
        context: {
          viewer: {
            accountId: "account-1",
            email: "user@example.com",
            login: "tester",
          },
          focusedServerCode: "blackberry",
          serverGroups: [
            {
              server: {
                id: "server-1",
                code: "blackberry",
                slug: "blackberry",
                name: "Blackberry",
              },
              trustorCount: 2,
              focusHref: "/account/trustors?server=blackberry",
              createBridgeHref: "/account/trustors?server=blackberry#create-trustor-blackberry",
              isFocused: true,
              trustors: [
                {
                  id: "trustor-1",
                  fullName: "Иван Доверителев",
                  passportNumber: "AA-001",
                  phone: "+7 900 000-00-00",
                  note: "Проверенный представитель",
                  isRepresentativeReady: true,
                },
                {
                  id: "trustor-2",
                  fullName: "",
                  passportNumber: "",
                  phone: null,
                  note: null,
                  isRepresentativeReady: false,
                },
              ],
            },
            {
              server: {
                id: "server-2",
                code: "rainbow",
                slug: "rainbow",
                name: "Rainbow",
              },
              trustorCount: 0,
              focusHref: "/account/trustors?server=rainbow",
              createBridgeHref: "/account/trustors?server=rainbow#create-trustor-rainbow",
              isFocused: false,
              trustors: [],
            },
          ],
        },
        status: "trustor-updated",
      }),
    );

    expect(html).toContain("Доверители");
    expect(html).toContain("Показана группа выбранного сервера");
    expect(html).toContain("Добавить доверителя");
    expect(html).toContain("Добавить доверителя на этом сервере");
    expect(html).toContain("Редактировать доверителя");
    expect(html).toContain("Удалить доверителя из списка");
    expect(html).toContain("Изменения по доверителю сохранены");
    expect(html).toContain("Готов для подачи через представителя");
    expect(html).toContain("Нужны обязательные поля");
    expect(html).toContain("Проверенный представитель");
    expect(html).toContain("Пока нет доверителей");
    expect(html).toContain('/account/trustors?server=rainbow');
    expect(html).not.toContain("Claims");
    expect(html).not.toContain("Assistant");
  });
});
