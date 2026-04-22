import { describe, expect, it } from "vitest";

import {
  applyClaimsRewriteSuggestion,
  applyOgpRewriteSuggestion,
  getClaimsRewriteSectionText,
  getOgpRewriteSectionText,
  isRewriteSectionSupportedForDocumentType,
} from "@/document-ai/sections";

describe("document rewrite sections", () => {
  it("поддерживает только согласованные OGP секции", () => {
    expect(isRewriteSectionSupportedForDocumentType("ogp_complaint", "situation_description")).toBe(true);
    expect(isRewriteSectionSupportedForDocumentType("ogp_complaint", "violation_summary")).toBe(true);
    expect(isRewriteSectionSupportedForDocumentType("ogp_complaint", "requested_relief")).toBe(false);
  });

  it("корректно различает claims sections по subtype", () => {
    expect(isRewriteSectionSupportedForDocumentType("rehabilitation", "factual_background")).toBe(true);
    expect(isRewriteSectionSupportedForDocumentType("rehabilitation", "rehabilitation_basis")).toBe(true);
    expect(isRewriteSectionSupportedForDocumentType("rehabilitation", "harm_summary")).toBe(true);
    expect(isRewriteSectionSupportedForDocumentType("rehabilitation", "pretrial_summary")).toBe(false);
    expect(isRewriteSectionSupportedForDocumentType("lawsuit", "pretrial_summary")).toBe(true);
    expect(isRewriteSectionSupportedForDocumentType("lawsuit", "harm_summary")).toBe(false);
  });

  it("применяет suggestion только к целевому полю payload", () => {
    const ogpPayload = {
      filingMode: "self" as const,
      appealNumber: "OGP-001",
      objectOrganization: "LSPD",
      objectFullName: "Officer Smoke",
      incidentAt: "2026-04-22T10:15",
      situationDescription: "Старый текст",
      violationSummary: "Нарушение",
      workingNotes: "Черновая заметка",
      trustorSnapshot: null,
      evidenceGroups: [],
    };

    const nextOgpPayload = applyOgpRewriteSuggestion(
      ogpPayload,
      "situation_description",
      "Новый текст",
    );

    expect(getOgpRewriteSectionText(nextOgpPayload, "situation_description")).toBe("Новый текст");
    expect(nextOgpPayload.violationSummary).toBe("Нарушение");
    expect(nextOgpPayload.workingNotes).toBe("Черновая заметка");

    const claimsPayload = {
      filingMode: "self" as const,
      respondentName: "LSPD",
      claimSubject: "Спор",
      factualBackground: "Факты",
      legalBasisSummary: "Право",
      requestedRelief: "Требование",
      workingNotes: "Внутренне",
      trustorSnapshot: null,
      evidenceGroups: [],
      caseReference: "CASE-1",
      rehabilitationBasis: "Основание",
      harmSummary: "Вред",
    };

    const nextClaimsPayload = applyClaimsRewriteSuggestion(
      claimsPayload,
      "harm_summary",
      "Обновлённое описание вреда",
    );

    expect(getClaimsRewriteSectionText(nextClaimsPayload, "harm_summary")).toBe(
      "Обновлённое описание вреда",
    );
    expect(nextClaimsPayload.workingNotes).toBe("Внутренне");
    expect(nextClaimsPayload.legalBasisSummary).toBe("Право");
  });
});
