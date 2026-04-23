import { describe, expect, it } from "vitest";

import { buildDefaultAttorneyRequestSection1 } from "@/features/documents/attorney-request/build-default-section1";
import { buildAttorneyRequestPeriod } from "@/features/documents/attorney-request/build-period";
import { normalizeAttorneyRequestNumber } from "@/features/documents/attorney-request/normalize-request-number";
import { resolveAttorneyRequestSignerTitle } from "@/features/documents/attorney-request/presets";
import {
  renderAttorneyRequestArtifact,
  validateAttorneyRequestForGeneration,
} from "@/features/documents/attorney-request/render";
import { ATTORNEY_REQUEST_RENDERER_VERSION } from "@/features/documents/attorney-request/types";
import type { AttorneyRequestDraftPayload } from "@/features/documents/attorney-request/schemas";
import type { DocumentAuthorSnapshot } from "@/schemas/document";

function buildAuthorSnapshot(): DocumentAuthorSnapshot {
  return {
    characterId: "character-1",
    serverId: "server-1",
    serverCode: "blackberry",
    serverName: "Blackberry",
    fullName: "Игорь Адвокатов",
    nickname: "Igor",
    passportNumber: "654321",
    position: "Адвокат",
    address: "San Andreas",
    phone: "321-45-67",
    icEmail: "lawyer@sa.com",
    passportImageUrl: "https://example.com/lawyer-passport.png",
    isProfileComplete: true,
    roleKeys: ["lawyer"],
    accessFlags: ["advocate"],
    capturedAt: "2026-04-23T12:00:00.000Z",
  };
}

function buildValidPayload(): AttorneyRequestDraftPayload {
  return {
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
    startedAtMsk: "23.04.2026 15:00",
    documentDateMsk: "23.04.2026",
    responseDueAtMsk: "2026-04-24T12:00:00.000Z",
    signerTitleSnapshot: resolveAttorneyRequestSignerTitle("Адвокат"),
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
      {
        id: "1",
        text: "Предоставить сведения по договору DOG-100.",
      },
      {
        id: "2",
        text: "Предоставить видеофиксацию.",
      },
      {
        id: "3",
        text: "Предоставить данные сотрудника.",
      },
    ],
    section3Text: "Ответ прошу направить в установленный срок.",
    validationState: {},
    workingNotes: "",
  };
}

describe("attorney request foundation", () => {
  it("нормализует номер запроса без дублей BAR", () => {
    const cases: Array<[string, string]> = [
      ["2112", "BAR-2112"],
      ["BAR-2112", "BAR-2112"],
      ["bar2112", "BAR-2112"],
      ["BAR-BAR-2112", "BAR-2112"],
      [" BAR  -  2112 ", "BAR-2112"],
      ["bar bar 2112", "BAR-2112"],
      ["BAR2112", "BAR-2112"],
      ["2112 ", "BAR-2112"],
      ["", ""],
      ["BAR only", ""],
    ];

    for (const [input, expected] of cases) {
      const result = normalizeAttorneyRequestNumber(input);

      expect(result.normalized).toBe(expected);
      expect(result.normalized).not.toBe("BAR-BAR-2112");
    }
  });

  it("поддерживает период, переходящий через полночь", () => {
    const period = buildAttorneyRequestPeriod({
      requestDate: "2026-04-23",
      timeFrom: "23:40",
      timeTo: "00:20",
    });

    expect(period.crossesMidnight).toBe(true);
    expect(period.periodDisplayText).toContain("23.04.2026 23:40");
    expect(period.periodDisplayText).toContain("24.04.2026 00:20");

    const section1 = buildDefaultAttorneyRequestSection1({
      contractNumber: "DOG-100",
      trustorSnapshot: buildValidPayload().trustorSnapshot,
      targetOfficerInput: "John Badge #123",
      period,
      authorIcEmail: buildAuthorSnapshot().icEmail,
    });

    expect(section1[0]?.text).toContain("23:40");
    expect(section1[0]?.text).toContain("00:20");
    expect(section1[0]?.text).toContain("23.04.2026");
    expect(section1[0]?.text).toContain("24.04.2026");
  });

  it("определяет данные подписи по должности персонажа", () => {
    expect(resolveAttorneyRequestSignerTitle("Адвокат")?.footerRu).toBe("Адвокат");
    expect(resolveAttorneyRequestSignerTitle("Заместитель Главы Коллегии Адвокатов")?.footerRu).toBe(
      "Заместитель Главы Коллегии Адвокатов",
    );
    expect(resolveAttorneyRequestSignerTitle("Глава Коллегии Адвокатов")?.footerRu).toBe(
      "Глава Коллегии Адвокатов",
    );
    expect(resolveAttorneyRequestSignerTitle("Старший адвокат")?.footerRu).toBe("Старший адвокат");
  });

  it("рендерит one-page preview/pdf/jpg artifact из сохранённого payload", async () => {
    const artifact = await renderAttorneyRequestArtifact({
      title: "Адвокатский запрос",
      authorSnapshot: buildAuthorSnapshot(),
      payload: buildValidPayload(),
    });

    expect(artifact.pageCount).toBe(1);
    expect(artifact.rendererVersion).toBe(ATTORNEY_REQUEST_RENDERER_VERSION);
    expect(artifact.previewText).toContain("BAR-2112");
    expect(artifact.previewText).toContain("Павел Доверитель");
    expect(artifact.previewHtml).toContain("STATE OF SAN ANDREAS");
    expect(artifact.previewHtml).toContain("BAR ASSOCIATION");
    expect(artifact.previewHtml).toContain("San Andreas Register");
    expect(artifact.previewHtml).toContain("SAN ANDREAS CAPITOL");
    expect(artifact.previewHtml).toContain("data:image/png;base64,");
    expect(artifact.pdfDataUrl).toMatch(/^data:application\/pdf;base64,/);
    expect(artifact.jpgDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(Buffer.from(artifact.pdfDataUrl.split(",")[1] ?? "", "base64").subarray(0, 5).toString()).toBe("%PDF-");
    expect(Buffer.from(artifact.jpgDataUrl.split(",")[1] ?? "", "base64").subarray(0, 2)).toEqual(
      Buffer.from([0xff, 0xd8]),
    );
  });

  it("рендерит типовой длинный запрос в одну страницу после визуального уплотнения", async () => {
    const payload = buildValidPayload();
    payload.signerTitleSnapshot = resolveAttorneyRequestSignerTitle("Заместитель Главы Коллегии Адвокатов");
    payload.section1Items = [
      {
        id: "1",
        text: "Прошу предоставить видеозаписи с записываемого устройства сотрудника Azod Panike за 05.04.2026 19:30 по 20:30 в отношении гражданина Greg Farmond.",
      },
      {
        id: "2",
        text: "В случае, если процессуальные действия проводились вне промежутка времени указанного в текущем документе, предоставить видеозапись всех процессуальных действий в отношении гражданина Greg Farmond за 05.04.2026.",
      },
      {
        id: "3",
        text: "Личные данные сотрудника: ФИО, данные из государственной базы данных при наличии такового.",
      },
    ];
    payload.section3Text =
      "Адвокатский запрос о предоставлении личных данных направлен Шефу LSPD и его заместителям. Адвокатский запрос о предоставлении видеозаписи направлен Azod Panike.";

    await expect(
      renderAttorneyRequestArtifact({
        title: "Адвокатский запрос",
        authorSnapshot: {
          ...buildAuthorSnapshot(),
          fullName: "Dom Perignon",
          position: "Заместитель Главы Коллегии Адвокатов",
        },
        payload,
      }),
    ).resolves.toMatchObject({
      pageCount: 1,
      rendererVersion: ATTORNEY_REQUEST_RENDERER_VERSION,
    });
  });

  it("блокирует генерацию, но не мешает неполному черновику существовать", () => {
    const payload = buildValidPayload();
    payload.requestNumberNormalized = "";

    expect(validateAttorneyRequestForGeneration({
      authorSnapshot: buildAuthorSnapshot(),
      payload,
    })).toContain("Укажите номер запроса.");
  });
});
