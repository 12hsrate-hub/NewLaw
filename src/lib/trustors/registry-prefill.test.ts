import { describe, expect, it } from "vitest";

import { applyTrustorRegistryPrefill } from "@/lib/trustors/registry-prefill";

describe("trustor registry prefill", () => {
  it("копирует данные из registry в локальный snapshot без live-link", () => {
    const result = applyTrustorRegistryPrefill(
      {
        id: "trustor-1",
        fullName: "Иван Доверителев",
        passportNumber: "AA-001",
        phone: "+7 900 000-00-00",
        icEmail: "trustor@example.com",
        passportImageUrl: "https://example.com/passport.png",
        note: "Проверенный представитель",
        isRepresentativeReady: true,
      },
      {
        sourceType: "inline_manual",
        fullName: "Старое имя",
        passportNumber: "OLD-1",
        phone: "",
        icEmail: "",
        passportImageUrl: "",
        note: "Старая заметка",
      },
    );

    expect(result).toEqual({
      sourceType: "registry_prefill",
      fullName: "Иван Доверителев",
      passportNumber: "001",
      phone: "+7 900 000-00-00",
      icEmail: "trustor@example.com",
      passportImageUrl: "https://example.com/passport.png",
      note: "Проверенный представитель",
    });
  });
});
