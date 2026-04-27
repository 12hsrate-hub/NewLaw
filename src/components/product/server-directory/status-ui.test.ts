import { describe, expect, it } from "vitest";

import {
  resolveAssistantStatusUi,
  resolveDirectoryAvailabilityUi,
  resolveDocumentsAvailabilityUi,
} from "@/components/product/server-directory/status-ui";

describe("status-ui", () => {
  it("возвращает продуктовые статусы для помощника и сервера", () => {
    expect(resolveDirectoryAvailabilityUi("maintenance")).toEqual({
      label: "Технические работы",
      description: "Сервер временно находится на обслуживании. Попробуйте открыть его позже.",
    });

    expect(resolveAssistantStatusUi("corpus_bootstrap_incomplete")).toEqual({
      label: "Помощник работает с ограничениями",
      description: "Часть правовых материалов уже доступна, но ответы могут быть менее полными.",
    });
  });

  it("возвращает продуктовые статусы для документов", () => {
    expect(resolveDocumentsAvailabilityUi("available")).toEqual({
      label: "Документы доступны",
      description: "Можно открыть документы по выбранному серверу.",
    });
  });
});
