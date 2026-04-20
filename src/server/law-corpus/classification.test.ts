import { describe, expect, it } from "vitest";

import { classifyLawTopicTitle } from "@/server/law-corpus/classification";

describe("law topic classification", () => {
  it("относит русскоязычные темы с отдельным словом Закон к primary", () => {
    expect(
      classifyLawTopicTitle('Закон "О деятельности офиса Генерального прокурора Штата Сан-Андреас"'),
    ).toBe("primary");
    expect(classifyLawTopicTitle('Закон "Об адвокатуре и адвокатской деятельности"')).toBe(
      "primary",
    );
  });

  it("не смешивает supplements и precedents с primary laws", () => {
    expect(classifyLawTopicTitle("Нормативные акты изменения законодательной базы")).toBe(
      "supplement",
    );
    expect(classifyLawTopicTitle("Судебные прецеденты")).toBe("ignored");
  });
});
