export const ATTORNEY_REQUEST_FORM_SCHEMA_VERSION = "attorney_request_v1";
export const ATTORNEY_REQUEST_RENDERER_VERSION = "attorney_request_renderer_v5_visual_fit";
export const ATTORNEY_REQUEST_OUTPUT_FORMAT = "attorney_request_preview_pdf_jpg_v1";

export type AttorneyRequestAddresseePresetKey =
  | "LSPD_CHIEF"
  | "LSSD_SHERIFF"
  | "FIB_DIRECTOR"
  | "NG_GENERAL"
  | "EMS_CHIEF_DOCTOR"
  | "SASPA_CHIEF"
  | "USSS_DIRECTOR";

export type AttorneyRequestSignerTitleSnapshot = {
  sourceTitle: string;
  leftColumnEn: string;
  bodyRu: string;
  footerRu: string;
};

export type AttorneyRequestSection1Item = {
  id: "1" | "2" | "3";
  text: string;
};

export type AttorneyRequestPeriod = {
  crossesMidnight: boolean;
  periodStartAt: string | null;
  periodEndAt: string | null;
  periodDisplayText: string;
};

export type AttorneyRequestTrustorSnapshot = {
  trustorId: string;
  fullName: string;
  passportNumber: string;
  phone: string | null;
  icEmail: string | null;
  passportImageUrl: string | null;
  note: string | null;
};
