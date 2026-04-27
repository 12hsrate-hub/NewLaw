import { describe, expect, it } from "vitest";

import {
  applyComplaintNarrativeImprovementSuggestion,
  buildEmptyTrustorSnapshot,
  formatComplaintNarrativeBlockedMessage,
  formatComplaintNarrativeRiskFlagLabel,
} from "@/components/product/document-area/document-draft-editor-shared";

describe("complaint narrative improvement editor helpers", () => {
  it("применяет improved text только к situationDescription", () => {
    const payload = {
      filingMode: "representative" as const,
      appealNumber: "OGP-18",
      objectOrganization: "LSPD",
      objectFullName: "Officer Smith",
      incidentAt: "2026-04-27T12:00",
      situationDescription: "Старое описание",
      violationSummary: "Суть нарушения",
      workingNotes: "Внутренняя заметка",
      trustorSnapshot: {
        ...buildEmptyTrustorSnapshot(),
        fullName: "Пётр Доверитель",
      },
      evidenceItems: [
        {
          id: "ev-1",
          mode: "custom" as const,
          templateKey: null,
          labelSnapshot: "Скриншот",
          url: "https://example.com",
          sortOrder: 0,
        },
      ],
    };

    const nextPayload = applyComplaintNarrativeImprovementSuggestion(
      payload,
      "Новое улучшенное описание",
    );

    expect(nextPayload.situationDescription).toBe("Новое улучшенное описание");
    expect(nextPayload.violationSummary).toBe(payload.violationSummary);
    expect(nextPayload.workingNotes).toBe(payload.workingNotes);
    expect(nextPayload.objectOrganization).toBe(payload.objectOrganization);
    expect(nextPayload.objectFullName).toBe(payload.objectFullName);
    expect(nextPayload.incidentAt).toBe(payload.incidentAt);
    expect(nextPayload.trustorSnapshot?.fullName).toBe("Пётр Доверитель");
    expect(nextPayload.evidenceItems).toEqual(payload.evidenceItems);
  });

  it("собирает user-friendly blocked message", () => {
    expect(
      formatComplaintNarrativeBlockedMessage([
        "Не указан объект заявления.",
        "Не указаны дата и время.",
      ]),
    ).toBe(
      "Для улучшения описания заполните обязательные поля: Не указан объект заявления; Не указаны дата и время.",
    );
  });

  it("humanizes complaint narrative risk flags", () => {
    expect(formatComplaintNarrativeRiskFlagLabel("missing_evidence")).toBe(
      "Не хватает доказательств",
    );
    expect(formatComplaintNarrativeRiskFlagLabel("legal_basis_not_found")).toBe(
      "Норма не подтверждена",
    );
  });
});
