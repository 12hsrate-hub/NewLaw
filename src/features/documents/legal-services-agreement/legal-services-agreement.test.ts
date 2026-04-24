import { describe, expect, it } from "vitest";

import {
  legalServicesAgreementFixtureAuthorSnapshot,
  legalServicesAgreementFixturePayload,
} from "@/features/documents/legal-services-agreement/fixtures";
import {
  LegalServicesAgreementGenerationBlockedError,
  renderLegalServicesAgreementArtifact,
} from "@/features/documents/legal-services-agreement/render";
import { LEGAL_SERVICES_AGREEMENT_RENDERER_VERSION } from "@/features/documents/legal-services-agreement/types";

describe("legal services agreement", () => {
  it("рендерит postраничный PNG-export page-by-page с нуля", async () => {
    const artifact = await renderLegalServicesAgreementArtifact({
      title: "Договор на оказание юридических услуг",
      authorSnapshot: legalServicesAgreementFixtureAuthorSnapshot,
      payload: legalServicesAgreementFixturePayload,
    });

    expect(artifact.referenceState).toBe("ready");
    expect(artifact.pageCount).toBe(5);
    expect(artifact.rendererVersion).toBe(LEGAL_SERVICES_AGREEMENT_RENDERER_VERSION);
    expect(artifact.previewText).toContain("Договор №LS-0011");
    expect(artifact.previewText).toContain("Nick Name");
    expect(artifact.previewHtml).toContain("DomPerignon_NickName_p1.png");
    expect(artifact.pages).toHaveLength(5);
    expect(artifact.pages[0]).toMatchObject({
      pageNumber: 1,
      fileName: "DomPerignon_NickName_p1.png",
      width: 953,
      height: 1348,
    });
    expect(artifact.pages[0]?.pngDataUrl).toContain("data:image/png;base64,");
  });

  it("блокирует генерацию при отсутствии обязательных ручных полей", async () => {
    await expect(
      renderLegalServicesAgreementArtifact({
        title: "Договор на оказание юридических услуг",
        authorSnapshot: legalServicesAgreementFixtureAuthorSnapshot,
        payload: {
          ...legalServicesAgreementFixturePayload,
          manualFields: {
            ...legalServicesAgreementFixturePayload.manualFields,
            agreementNumber: "",
          },
        },
      }),
    ).rejects.toBeInstanceOf(LegalServicesAgreementGenerationBlockedError);
  });
});
