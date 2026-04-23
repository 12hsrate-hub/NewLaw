import { describe, expect, it } from "vitest";

import {
  buildOgpGenerationValidationResult,
  normalizeIcEmail,
} from "@/lib/ogp/generation-contract";

describe("OGP generation validation contract", () => {
  it("treats IC email as required IC mail text, not as an RFC email-only field", () => {
    const validation = buildOgpGenerationValidationResult({
      characterProfile: {
        fullName: "Игорь Юристов",
        position: "Адвокат",
        passportNumber: "AA-001",
        address: "Дом 10",
        phone: "1234567",
        icEmail: "Blackberry Lawyer #42",
        passportImageUrl: "https://example.com/passport.png",
      },
      trustorProfile: null,
      documentPayload: {
        appealNumber: "123",
        organizationName: "LSPD",
        subjectLabel: "Сотрудник LSPD",
        incidentAt: "2026-04-23T12:00",
        situationDescription: "Описание ситуации",
        violationSummary: "Суть нарушения",
        evidenceGroups: [
          {
            rows: [
              {
                labelSnapshot: "Запись с бодикамеры",
                url: "https://example.com/bodycam",
              },
            ],
          },
        ],
      },
    });

    expect(normalizeIcEmail("  Blackberry Lawyer #42  ")).toBe("Blackberry Lawyer #42");
    expect(validation.characterIssues).toEqual([]);
    expect(validation.readyState).toBe("generation_ready");
  });
});
