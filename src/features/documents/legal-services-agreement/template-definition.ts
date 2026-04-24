import type { DocumentAuthorSnapshot } from "@/schemas/document";
import type { LegalServicesAgreementDraftPayload } from "@/features/documents/legal-services-agreement/schemas";
import type { LegalServicesAgreementResolvedFields } from "@/features/documents/legal-services-agreement/types";
import { normalizeLegalServicesAgreementNumber } from "@/features/documents/legal-services-agreement/formatting";

export const legalServicesAgreementReferenceAssets = {
  pdfFileName: "Dom Perignon_Nick Name.pdf",
  pages: [
    "page-1.png",
    "page-2.png",
    "page-3.png",
    "page-4.png",
    "page-5.png",
  ],
} as const;

export const LEGAL_SERVICES_AGREEMENT_REFERENCE_PAGE_COUNT =
  legalServicesAgreementReferenceAssets.pages.length;

export const legalServicesAgreementManualFieldSpecs = [
  {
    key: "agreementNumber",
    label: "Номер договора",
    hint: "Фиксированное заменяемое поле эталонного договора. Нормализуется к формату LS-XXXX.",
  },
  {
    key: "registerNumber",
    label: "Номер реестра",
    hint: "Отдельное поле для верхнего правого блока эталона.",
  },
  {
    key: "agreementDate",
    label: "Дата договора",
    hint: "Дата подстановки в reference template без свободного редактирования текста договора.",
  },
  {
    key: "servicePeriodStart",
    label: "Период услуг: с",
    hint: "Начало периода оказания услуг для подстановки в текст договора.",
  },
  {
    key: "servicePeriodEnd",
    label: "Период услуг: по",
    hint: "Окончание периода оказания услуг для подстановки в текст договора.",
  },
  {
    key: "priceAmount",
    label: "Стоимость услуг",
    hint: "Значение стоимости в том виде, в котором оно должно быть вставлено в reference template.",
  },
] as const;

function readNormalizedValue(value: string | null | undefined, fallback = "—") {
  const normalized = value?.trim() ?? "";

  return normalized.length > 0 ? normalized : fallback;
}

function readExecutorTitle(authorSnapshot: DocumentAuthorSnapshot) {
  const position = authorSnapshot.position?.trim() ?? "";

  return position.length > 0 ? position : "Адвокат";
}

export function buildLegalServicesAgreementResolvedFields(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: LegalServicesAgreementDraftPayload;
}): LegalServicesAgreementResolvedFields {
  const { authorSnapshot, payload } = input;
  const trustor = payload.trustorSnapshot;

  return {
    agreementNumber: normalizeLegalServicesAgreementNumber(payload.manualFields.agreementNumber),
    registerNumber: payload.manualFields.registerNumber,
    agreementDate: payload.manualFields.agreementDate,
    servicePeriodStart: payload.manualFields.servicePeriodStart,
    servicePeriodEnd: payload.manualFields.servicePeriodEnd,
    priceAmount: payload.manualFields.priceAmount,
    executorFullName: readNormalizedValue(authorSnapshot.fullName),
    executorPassportNumber: readNormalizedValue(authorSnapshot.passportNumber),
    executorPosition: readExecutorTitle(authorSnapshot),
    executorPhone: readNormalizedValue(authorSnapshot.phone),
    executorIcEmail: readNormalizedValue(authorSnapshot.icEmail),
    trustorFullName: readNormalizedValue(trustor.fullName),
    trustorPassportNumber: readNormalizedValue(trustor.passportNumber),
    trustorPhone: readNormalizedValue(trustor.phone),
    trustorIcEmail: readNormalizedValue(trustor.icEmail),
  };
}

export function buildLegalServicesAgreementIntroParagraph(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: LegalServicesAgreementDraftPayload;
}) {
  const fields = buildLegalServicesAgreementResolvedFields(input);

  return `${fields.trustorFullName} с номером паспорта ${fields.trustorPassportNumber}, именуемый в дальнейшем «Доверитель», Заказчик, с одной стороны, ${fields.executorPosition} ${fields.executorFullName} с номером паспорта ${fields.executorPassportNumber} действующий на основании закона «Об адвокатуре и адвокатской деятельности в штате Сан-Андреас», именуемый в дальнейшем «Исполнитель», «Представитель», «Поверенный» с другой стороны, заключили настоящий договор о нижеследующем:`;
}

export function buildLegalServicesAgreementServicePeriodLine(
  payload: LegalServicesAgreementDraftPayload,
) {
  return `1.3. Услуги по настоящему Договору подлежат оказанию Законным представителем с ${readNormalizedValue(
    payload.manualFields.servicePeriodStart,
  )} по ${readNormalizedValue(payload.manualFields.servicePeriodEnd)}.`;
}

export function buildLegalServicesAgreementPricingParagraph(
  payload: LegalServicesAgreementDraftPayload,
) {
  return `4.1. Стоимость услуг по данному Договору определяется в размере ${readNormalizedValue(
    payload.manualFields.priceAmount,
  )} долларов.`;
}

export function buildLegalServicesAgreementPricingParagraphExtended() {
  return "4.2. Оплата услуг Законного представителя осуществляется Доверителем в виде передачи Доверителем Законному представителю наличной денежной суммы, которая указана в пункте 4.1. настоящего Договора, или путём совершения банковского перевода на сумму, которая указана в пункте 4.1. настоящего Договора, на банковский счёт Законного представителя.";
}

export function buildLegalServicesAgreementPreviewText(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: LegalServicesAgreementDraftPayload;
}) {
  const fields = buildLegalServicesAgreementResolvedFields(input);

  return [
    `Договор №${readNormalizedValue(fields.agreementNumber)}`,
    `No. ${readNormalizedValue(fields.registerNumber)}`,
    buildLegalServicesAgreementIntroParagraph(input),
    buildLegalServicesAgreementServicePeriodLine(input.payload),
    buildLegalServicesAgreementPricingParagraph(input.payload),
    buildLegalServicesAgreementPricingParagraphExtended(),
    `Исполнитель: ${fields.executorPosition} ${fields.executorFullName}`,
    `Заказчик: ${fields.trustorFullName}`,
  ].join("\n");
}
