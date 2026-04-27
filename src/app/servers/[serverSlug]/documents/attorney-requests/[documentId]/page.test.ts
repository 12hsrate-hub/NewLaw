import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/document-area/context", () => ({
  getAttorneyRequestEditorRouteContext: vi.fn(),
}));

import AttorneyRequestEditorPage from "@/app/servers/[serverSlug]/documents/attorney-requests/[documentId]/page";
import { getAttorneyRequestEditorRouteContext } from "@/server/document-area/context";

describe("/servers/[serverSlug]/documents/attorney-requests/[documentId] page", () => {
  it("рендерит persisted attorney request editor в split-layout", async () => {
    vi.mocked(getAttorneyRequestEditorRouteContext).mockResolvedValue({
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
        id: "attorney-request-1",
        title: "Адвокатский запрос по договору",
        status: "draft",
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T13:00:00.000Z",
        snapshotCapturedAt: "2026-04-23T12:05:00.000Z",
        formSchemaVersion: "attorney_request_v1",
        generatedAt: null,
        generatedFormSchemaVersion: null,
        generatedOutputFormat: null,
        generatedRendererVersion: null,
        generatedArtifact: null,
        isModifiedAfterGeneration: false,
        hasActiveCharacterSignature: true,
        signatureSnapshot: null,
        server: {
          code: "blackberry",
          name: "Blackberry",
        },
        authorSnapshot: {
          fullName: "Игорь Адвокатов",
          passportNumber: "654321",
          position: "Адвокат",
          address: "San Andreas",
          phone: "321-45-67",
          icEmail: "lawyer@sa.com",
          passportImageUrl: "https://example.com/lawyer-passport.png",
          nickname: "Igor",
          roleKeys: ["lawyer"],
          accessFlags: ["advocate"],
          isProfileComplete: true,
        },
        payload: {
          requestNumberRawInput: "2112",
          requestNumberNormalized: "BAR-2112",
          contractNumber: "DOG-100",
          addresseePreset: "LSPD_CHIEF",
          targetOfficerInput: "John Badge #123",
          requestDate: "2026-04-23",
          timeFrom: "23:40",
          timeTo: "00:20",
          crossesMidnight: true,
          periodStartAt: "2026-04-23T20:40:00.000Z",
          periodEndAt: "2026-04-23T21:20:00.000Z",
          startedAtMsk: "2026-04-23T15:00:00.000Z",
          documentDateMsk: "23.04.2026",
          responseDueAtMsk: "2026-04-24T12:00:00.000Z",
          signerTitleSnapshot: {
            sourceTitle: "Адвокат",
            leftColumnEn: "Lawyer",
            bodyRu: "Адвокат Штата Сан-Андреас",
            footerRu: "Адвокат",
          },
          trustorSnapshot: {
            trustorId: "trustor-1",
            fullName: "Павел Доверитель",
            passportNumber: "123456",
            phone: "123-45-67",
            icEmail: "trustor@sa.com",
            passportImageUrl: "https://example.com/passport.png",
            note: "",
          },
          section1Items: [
            { id: "1", text: "Первый пункт" },
            { id: "2", text: "Второй пункт" },
            { id: "3", text: "Третий пункт" },
          ],
          section3Text: "Ответ прошу направить в установленный срок.",
          validationState: {},
          workingNotes: "",
        },
      },
    });

    const html = renderToStaticMarkup(
      await AttorneyRequestEditorPage({
        params: Promise.resolve({
          serverSlug: "blackberry",
          documentId: "attorney-request-1",
        }),
      }),
    );

    expect(getAttorneyRequestEditorRouteContext).toHaveBeenCalledWith({
      serverSlug: "blackberry",
      documentId: "attorney-request-1",
      nextPath: "/servers/blackberry/documents/attorney-requests/attorney-request-1",
    });
    expect(html).toContain('data-editor-workspace-layout="true"');
    expect(html).toContain('data-editor-main-column="true"');
    expect(html).toContain('data-editor-context-aside="true"');
    expect(html).toContain("Редактор адвокатского запроса");
    expect(html).toContain("О документе");
    expect(html).toContain("Готовность");
    expect(html).toContain("Следующие действия");
    expect(html).toContain("Павел Доверитель");
    expect(html).toContain("BAR-2112");
    expect(html).toContain("DOG-100");
    expect(html).toContain("John Badge #123");
    expect(html).toContain("Создано");
    expect(html).toContain("Снимок данных");
    expect(html).toContain("Файлы для скачивания");
    expect(html).toContain("Подпись");
    expect(html).toContain("Редактор запроса");
  });
});
