import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getLegalServicesAgreementEditorRouteContext: vi.fn(),
}));

import LegalServicesAgreementEditorPage from "@/app/servers/[serverSlug]/documents/legal-services-agreements/[documentId]/page";
import { getLegalServicesAgreementEditorRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/legal-services-agreements/[documentId] page", () => {
  it("грузит owner-only editor с postраничным artifact", async () => {
    vi.mocked(getLegalServicesAgreementEditorRouteContext).mockResolvedValue({
      status: "ready",
      account: {
        id: "account-1",
        email: "user@example.com",
        login: "tester",
        isSuperAdmin: false,
        mustChangePassword: false,
      },
      server: {
        id: "server-1",
        code: "blackberry",
        name: "Blackberry",
      },
      servers: [],
      document: {
        id: "agreement-1",
        title: "Договор на оказание юридических услуг",
        status: "generated",
        createdAt: "2026-04-24T09:00:00.000Z",
        updatedAt: "2026-04-24T09:10:00.000Z",
        snapshotCapturedAt: "2026-04-24T09:00:00.000Z",
        formSchemaVersion: "legal_services_agreement_contract_v1",
        generatedAt: "2026-04-24T09:10:00.000Z",
        generatedFormSchemaVersion: "legal_services_agreement_contract_v1",
        generatedOutputFormat: "legal_services_agreement_png_pages_v1",
        generatedRendererVersion: "legal_services_agreement_fresh_page_renderer_v1",
        generatedArtifact: {
          family: "legal_services_agreement",
          format: "legal_services_agreement_png_pages_v1",
          templateVersion: "legal_services_agreement_reference_pdf_v1",
          rendererVersion: "legal_services_agreement_fresh_page_renderer_v1",
          referenceState: "ready",
          previewHtml: "<main>preview</main>",
          previewText: "preview",
          blockingReasons: [],
          pageCount: 5,
          pages: Array.from({ length: 5 }, (_, index) => ({
            pageNumber: index + 1,
            fileName: `DomPerignon_NickName_p${index + 1}.png`,
            pngDataUrl: "data:image/png;base64,iVBORw0KGgo=",
            width: 953,
            height: 1348,
          })),
        },
        isModifiedAfterGeneration: false,
        server: {
          code: "blackberry",
          name: "Blackberry",
        },
        authorSnapshot: {
          fullName: "Dom Perignon",
          passportNumber: "240434",
          position: "Заместитель Главы Коллегии Адвокатов",
          address: "San Andreas",
          phone: "605879",
          icEmail: "12hsrate@sa.gov",
          passportImageUrl: "",
          nickname: "Dom",
          roleKeys: ["lawyer"],
          accessFlags: ["advocate"],
          isProfileComplete: true,
        },
        payload: {
          formSchemaVersion: "legal_services_agreement_contract_v1",
          trustorSnapshot: {
            trustorId: "trustor-1",
            fullName: "Nick Name",
            passportNumber: "00000",
            phone: "1234567",
            icEmail: "test@sa.gov",
            note: null,
          },
          manualFields: {
            agreementNumber: "LS-0011",
            registerNumber: "LS-0011",
            agreementDate: "23 Апрель 2026",
            servicePeriodStart: "23.04.2026",
            servicePeriodEnd: "24.04.2026",
            priceAmount: "100.000",
          },
          workingNotes: "",
        },
      },
    });

    const html = renderToStaticMarkup(
      await LegalServicesAgreementEditorPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
          documentId: "agreement-1",
        }),
      }),
    );

    expect(getLegalServicesAgreementEditorRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      documentId: "agreement-1",
      nextPath: "/servers/blackberry/documents/legal-services-agreements/agreement-1",
    });
    expect(html).toContain("Редактор договора");
    expect(html).toContain("legal_services_agreement_png_pages_v1");
    expect(html).toContain("Скачать страницу 1");
    expect(html).toContain("Nick Name");
  });
});
