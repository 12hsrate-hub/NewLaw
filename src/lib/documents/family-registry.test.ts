import { describe, expect, it } from "vitest";

import {
  buildDocumentEditorHref,
  buildDocumentFamilyHref,
  getDocumentDefaultTitle,
  getDocumentFamilyLabel,
  getDocumentOpenActionLabel,
  getDocumentSubtypeLabel,
  getDocumentTypeLabel,
} from "@/lib/documents/family-registry";

describe("document family registry", () => {
  it("возвращает согласованные labels и href для OGP и post-MVP families", () => {
    expect(getDocumentDefaultTitle("ogp_complaint")).toBe("Жалоба в ОГП");
    expect(getDocumentTypeLabel("attorney_request")).toBe("Адвокатский запрос");
    expect(getDocumentFamilyLabel("legal_services_agreement")).toBe("Договоры");
    expect(getDocumentOpenActionLabel("attorney_request")).toBe("Открыть адвокатский запрос");

    expect(
      buildDocumentFamilyHref({
        serverCode: "blackberry",
        documentType: "legal_services_agreement",
      }),
    ).toBe("/servers/blackberry/documents/legal-services-agreements");

    expect(
      buildDocumentEditorHref({
        serverCode: "blackberry",
        documentId: "document-1",
        documentType: "ogp_complaint",
      }),
    ).toBe("/servers/blackberry/documents/ogp-complaints/document-1");
  });

  it("сохраняет claims family registry с общим family path и subtype labels", () => {
    expect(getDocumentDefaultTitle("rehabilitation")).toBe("Документ по реабилитации");
    expect(getDocumentDefaultTitle("lawsuit")).toBe("Исковое заявление");
    expect(getDocumentSubtypeLabel("rehabilitation")).toBe("Rehabilitation");
    expect(getDocumentSubtypeLabel("lawsuit")).toBe("Lawsuit");

    expect(
      buildDocumentFamilyHref({
        serverCode: "rainbow",
        documentType: "rehabilitation",
      }),
    ).toBe("/servers/rainbow/documents/claims");

    expect(
      buildDocumentEditorHref({
        serverCode: "rainbow",
        documentId: "claim-1",
        documentType: "lawsuit",
      }),
    ).toBe("/servers/rainbow/documents/claims/claim-1");
  });
});
