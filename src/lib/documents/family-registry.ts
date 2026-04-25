export type RegisteredDocumentType =
  | "ogp_complaint"
  | "rehabilitation"
  | "lawsuit"
  | "attorney_request"
  | "legal_services_agreement";

type DocumentFamilyMetadata = {
  defaultTitle: string;
  typeLabel: string;
  familyLabel: string;
  subtypeLabel: string | null;
  openActionLabel: string;
  familyPath: string;
};

const documentFamilyRegistry: Record<RegisteredDocumentType, DocumentFamilyMetadata> = {
  ogp_complaint: {
    defaultTitle: "Жалоба в ОГП",
    typeLabel: "Жалоба в ОГП",
    familyLabel: "Жалобы в ОГП",
    subtypeLabel: null,
    openActionLabel: "Открыть жалобу в ОГП",
    familyPath: "ogp-complaints",
  },
  rehabilitation: {
    defaultTitle: "Документ по реабилитации",
    typeLabel: "Rehabilitation",
    familyLabel: "Иски",
    subtypeLabel: "Rehabilitation",
    openActionLabel: "Открыть документ",
    familyPath: "claims",
  },
  lawsuit: {
    defaultTitle: "Исковое заявление",
    typeLabel: "Lawsuit",
    familyLabel: "Иски",
    subtypeLabel: "Lawsuit",
    openActionLabel: "Открыть документ",
    familyPath: "claims",
  },
  attorney_request: {
    defaultTitle: "Адвокатский запрос",
    typeLabel: "Адвокатский запрос",
    familyLabel: "Адвокатские запросы",
    subtypeLabel: null,
    openActionLabel: "Открыть адвокатский запрос",
    familyPath: "attorney-requests",
  },
  legal_services_agreement: {
    defaultTitle: "Договор на оказание юридических услуг",
    typeLabel: "Договор на оказание юридических услуг",
    familyLabel: "Договоры",
    subtypeLabel: null,
    openActionLabel: "Открыть договор",
    familyPath: "legal-services-agreements",
  },
};

function getDocumentFamilyMetadata(documentType: RegisteredDocumentType) {
  return documentFamilyRegistry[documentType];
}

export function getDocumentDefaultTitle(documentType: RegisteredDocumentType) {
  return getDocumentFamilyMetadata(documentType).defaultTitle;
}

export function getDocumentTypeLabel(documentType: RegisteredDocumentType) {
  return getDocumentFamilyMetadata(documentType).typeLabel;
}

export function getDocumentFamilyLabel(documentType: RegisteredDocumentType) {
  return getDocumentFamilyMetadata(documentType).familyLabel;
}

export function getDocumentSubtypeLabel(documentType: RegisteredDocumentType) {
  return getDocumentFamilyMetadata(documentType).subtypeLabel;
}

export function getDocumentOpenActionLabel(documentType: RegisteredDocumentType) {
  return getDocumentFamilyMetadata(documentType).openActionLabel;
}

export function buildDocumentFamilyHref(input: {
  serverCode: string;
  documentType: RegisteredDocumentType;
}) {
  return `/servers/${input.serverCode}/documents/${getDocumentFamilyMetadata(input.documentType).familyPath}`;
}

export function buildDocumentEditorHref(input: {
  serverCode: string;
  documentId: string;
  documentType: RegisteredDocumentType;
}) {
  return `${buildDocumentFamilyHref({
    serverCode: input.serverCode,
    documentType: input.documentType,
  })}/${input.documentId}`;
}
