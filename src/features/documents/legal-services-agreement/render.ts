import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

import {
  LEGAL_SERVICES_AGREEMENT_OUTPUT_FORMAT,
  LEGAL_SERVICES_AGREEMENT_RENDERER_VERSION,
  LEGAL_SERVICES_AGREEMENT_TEMPLATE_VERSION,
} from "@/features/documents/legal-services-agreement/types";
import type {
  LegalServicesAgreementDraftPayload,
  LegalServicesAgreementRenderedArtifact,
} from "@/features/documents/legal-services-agreement/schemas";
import {
  LEGAL_SERVICES_AGREEMENT_REFERENCE_PAGE_COUNT,
  buildLegalServicesAgreementIntroParagraph,
  buildLegalServicesAgreementPreviewText,
  buildLegalServicesAgreementPricingParagraph,
  buildLegalServicesAgreementPricingParagraphExtended,
  buildLegalServicesAgreementResolvedFields,
  buildLegalServicesAgreementServicePeriodLine,
  legalServicesAgreementReferenceAssets,
} from "@/features/documents/legal-services-agreement/template-definition";
import type { DocumentAuthorSnapshot } from "@/schemas/document";

const PAGE_WIDTH = 953;
const PAGE_HEIGHT = 1348;
const RASTER_SCALE = 1;
const assetCache = new Map<string, string>();
const LEGAL_SERVICES_AGREEMENT_ASSETS_DIR = join(
  process.cwd(),
  "src",
  "features",
  "documents",
  "legal-services-agreement",
  "assets",
);
const LEGAL_SERVICES_AGREEMENT_REFERENCE_DIR = join(
  LEGAL_SERVICES_AGREEMENT_ASSETS_DIR,
  "reference",
);
const LEGAL_SERVICES_AGREEMENT_FONTS_DIR = join(
  LEGAL_SERVICES_AGREEMENT_ASSETS_DIR,
  "fonts",
);
const BODY_FONT_FAMILY = "Times New Roman, Liberation Serif, serif";
const SIGNATURE_FONT_FAMILY = "LegalServicesAgreementSignature";
const signatureFontDataUrl = readLocalAssetDataUrl(
  join(LEGAL_SERVICES_AGREEMENT_FONTS_DIR, "GreatVibes-Regular.ttf"),
  "font/ttf",
);

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export class LegalServicesAgreementGenerationBlockedError extends Error {
  constructor(public readonly reasons: string[]) {
    super("Договор на оказание юридических услуг не готов к генерации.");
    this.name = "LegalServicesAgreementGenerationBlockedError";
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value: string) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

function makeDataUrl(mediaType: string, content: Buffer) {
  return `data:${mediaType};base64,${content.toString("base64")}`;
}

function readLocalAssetDataUrl(assetPath: string, mediaType: string) {
  if (!existsSync(assetPath)) {
    return null;
  }

  const cached = assetCache.get(assetPath);

  if (cached) {
    return cached;
  }

  const dataUrl = makeDataUrl(mediaType, readFileSync(assetPath));
  assetCache.set(assetPath, dataUrl);

  return dataUrl;
}

function readReferencePageDataUrl(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "png";
  const mediaType =
    extension === "jpg" || extension === "jpeg" ? "image/jpeg" : "image/png";

  return readLocalAssetDataUrl(
    join(LEGAL_SERVICES_AGREEMENT_REFERENCE_DIR, fileName),
    mediaType,
  );
}

function readNormalizedValue(value: string | null | undefined, fallback = "—") {
  const normalized = value?.trim() ?? "";

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeLatinName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => {
      if (CYRILLIC_TO_LATIN_MAP[char]) {
        return CYRILLIC_TO_LATIN_MAP[char];
      }

      if (/[a-z0-9]/.test(char)) {
        return char;
      }

      if (/[A-Z]/.test(char)) {
        return char.toLowerCase();
      }

      return " ";
    })
    .join("")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function buildPageFileName(input: {
  authorFullName: string;
  trustorFullName: string;
  pageNumber: number;
}) {
  const authorName = normalizeLatinName(input.authorFullName) || "Character";
  const trustorName = normalizeLatinName(input.trustorFullName) || "Trustor";

  return `${authorName}_${trustorName}_p${input.pageNumber}.png`;
}

function estimateTextWidth(input: string, size: number) {
  let units = 0;

  for (const char of input) {
    if (char === " ") {
      units += 0.34;
    } else if (/[0-9]/.test(char)) {
      units += 0.52;
    } else if (/[A-Za-z]/.test(char)) {
      units += 0.56;
    } else if (/[А-Яа-яЁё]/.test(char)) {
      units += 0.615;
    } else if (/[.,:;!?()[\]"'/-]/.test(char)) {
      units += 0.34;
    } else {
      units += 0.59;
    }
  }

  return units * size;
}

function wrapText(input: string, width: number, size: number) {
  const paragraphs = input.split("\n");
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const text = paragraph.trim();

    if (text.length === 0) {
      result.push("");
      continue;
    }

    const words = text.split(/\s+/);
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;

      if (estimateTextWidth(candidate, size) <= width) {
        current = candidate;
        continue;
      }

      if (current) {
        result.push(current);
      }

      current = word;
    }

    if (current) {
      result.push(current);
    }
  }

  return result;
}

function buildTextBlock(input: {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  fontWeight?: 400 | 700;
  fontStyle?: "normal" | "italic";
  textAnchor?: "start" | "middle" | "end";
  textAlign?: "left" | "center" | "right";
  fontFamily?: string;
}) {
  const lines = wrapText(input.text, input.width, input.fontSize);
  const anchor = input.textAnchor ?? "start";
  const x =
    input.textAlign === "center"
      ? input.x + input.width / 2
      : input.textAlign === "right"
        ? input.x + input.width
        : input.x;

  return lines
    .map((line, index) => {
      const y = input.y + index * input.lineHeight;

      return `<text x="${x}" y="${y}" font-family="${input.fontFamily ?? BODY_FONT_FAMILY}" font-size="${input.fontSize}"${input.fontWeight ? ` font-weight="${input.fontWeight}"` : ""}${input.fontStyle ? ` font-style="${input.fontStyle}"` : ""}${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${escapeXml(
        line,
      )}</text>`;
    })
    .join("");
}

function buildSignatureText(input: {
  fullName: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
}) {
  return `<text x="${input.x + input.width / 2}" y="${input.y}" font-family="${SIGNATURE_FONT_FAMILY}" font-size="${input.fontSize}" text-anchor="middle" fill="#111111">${escapeXml(
    input.fullName,
  )}</text>`;
}

async function buildPlaceholderPageDataUrl() {
  const placeholderKey = "placeholder:legal-services-agreement-page";
  const cached = assetCache.get(placeholderKey);

  if (cached) {
    return cached;
  }

  const png = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: "#ffffff",
    },
  })
    .png()
    .toBuffer();
  const dataUrl = makeDataUrl("image/png", png);
  assetCache.set(placeholderKey, dataUrl);

  return dataUrl;
}

function buildReferenceMissingPreviewHtml(message: string) {
  return `<main style="font-family:${BODY_FONT_FAMILY};max-width:960px;margin:0 auto;padding:24px;background:#ffffff;">
    <h1 style="font-size:32px;margin:0 0 16px 0;">Договор на оказание юридических услуг</h1>
    <p style="font-size:18px;line-height:1.6;margin:0;">${escapeHtml(message)}</p>
  </main>`;
}

async function buildReferenceMissingArtifact(input: {
  title: string;
  authorSnapshot: DocumentAuthorSnapshot;
  payload: LegalServicesAgreementDraftPayload;
  blockingReasons: string[];
}): Promise<LegalServicesAgreementRenderedArtifact> {
  const message =
    "Reference asset package для договора на оказание юридических услуг недоступен.";
  const pagePlaceholder = await buildPlaceholderPageDataUrl();

  return {
    family: "legal_services_agreement",
    format: LEGAL_SERVICES_AGREEMENT_OUTPUT_FORMAT,
    templateVersion: LEGAL_SERVICES_AGREEMENT_TEMPLATE_VERSION,
    rendererVersion: LEGAL_SERVICES_AGREEMENT_RENDERER_VERSION,
    referenceState: "missing",
    pageCount: LEGAL_SERVICES_AGREEMENT_REFERENCE_PAGE_COUNT,
    blockingReasons: [...input.blockingReasons, message],
    previewText: buildLegalServicesAgreementPreviewText({
      authorSnapshot: input.authorSnapshot,
      payload: input.payload,
    }),
    previewHtml: buildReferenceMissingPreviewHtml(message),
    pages: Array.from({ length: LEGAL_SERVICES_AGREEMENT_REFERENCE_PAGE_COUNT }, (_, index) => ({
      pageNumber: index + 1,
      fileName: buildPageFileName({
        authorFullName: input.authorSnapshot.fullName,
        trustorFullName: input.payload.trustorSnapshot.fullName,
        pageNumber: index + 1,
      }),
      pngDataUrl: pagePlaceholder,
      width: 2,
      height: 2,
    })),
  };
}

function buildExecutorContactBlock(authorSnapshot: DocumentAuthorSnapshot) {
  const position = readNormalizedValue(authorSnapshot.position, "Адвокат");

  return `${position}
${readNormalizedValue(authorSnapshot.fullName)}
Номер паспорта:
${readNormalizedValue(authorSnapshot.passportNumber)}
Контактный телефон: ${readNormalizedValue(authorSnapshot.phone)}
E-mail: ${readNormalizedValue(authorSnapshot.icEmail)}`;
}

function buildTrustorContactBlock(payload: LegalServicesAgreementDraftPayload) {
  return `Гражданин штата Сан-Андреас
${readNormalizedValue(payload.trustorSnapshot.fullName)}
Номер паспорта:
${readNormalizedValue(payload.trustorSnapshot.passportNumber)}
Контактный телефон: ${readNormalizedValue(payload.trustorSnapshot.phone)}
E-mail: ${readNormalizedValue(payload.trustorSnapshot.icEmail)}`;
}

function buildPageSvg(input: {
  pageDataUrl: string;
  overlays: string[];
}) {
  const fontFace =
    signatureFontDataUrl !== null
      ? `<style>@font-face{font-family:'${SIGNATURE_FONT_FAMILY}';src:url('${signatureFontDataUrl}') format('truetype');font-weight:400;font-style:normal;}</style>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">
    ${fontFace}
    <image href="${input.pageDataUrl}" x="0" y="0" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" />
    ${input.overlays.join("\n")}
  </svg>`;
}

async function rasterizePage(pageSvg: string) {
  const pageBuffer = await sharp(Buffer.from(pageSvg))
    .resize(PAGE_WIDTH * RASTER_SCALE, PAGE_HEIGHT * RASTER_SCALE)
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: false,
    })
    .toBuffer();

  return {
    pngDataUrl: makeDataUrl("image/png", pageBuffer),
    width: PAGE_WIDTH * RASTER_SCALE,
    height: PAGE_HEIGHT * RASTER_SCALE,
  };
}

function buildPreviewHtml(input: {
  title: string;
  pages: Array<{
    pageNumber: number;
    fileName: string;
    pngDataUrl: string;
  }>;
}) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    body { margin: 0; background: #f3f4f6; font-family: ${BODY_FONT_FAMILY}; }
    .preview-shell { display: grid; gap: 24px; justify-content: center; padding: 24px; }
    .page { width: min(100%, ${PAGE_WIDTH}px); background: #fff; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16); }
    .page img { display: block; width: 100%; height: auto; }
    .page-meta { padding: 10px 14px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <main class="preview-shell">
    ${input.pages
      .map(
        (page) => `<section class="page">
          <img alt="Страница ${page.pageNumber}" src="${page.pngDataUrl}" />
          <div class="page-meta">Страница ${page.pageNumber} · ${escapeHtml(page.fileName)}</div>
        </section>`,
      )
      .join("")}
  </main>
</body>
</html>`;
}

function validateLegalServicesAgreementForGeneration(input: {
  payload: LegalServicesAgreementDraftPayload;
  authorSnapshot: DocumentAuthorSnapshot;
}) {
  const fields = buildLegalServicesAgreementResolvedFields(input);
  const reasons: string[] = [];

  if (!fields.agreementNumber.trim()) {
    reasons.push("Укажите номер договора.");
  }

  if (!fields.registerNumber.trim()) {
    reasons.push("Укажите номер реестра.");
  }

  if (!fields.agreementDate.trim()) {
    reasons.push("Укажите дату договора.");
  }

  if (!fields.servicePeriodStart.trim()) {
    reasons.push("Укажите дату начала периода оказания услуг.");
  }

  if (!fields.servicePeriodEnd.trim()) {
    reasons.push("Укажите дату окончания периода оказания услуг.");
  }

  if (!fields.priceAmount.trim()) {
    reasons.push("Укажите стоимость услуг.");
  }

  if (!fields.executorFullName.trim() || !fields.executorPassportNumber.trim()) {
    reasons.push("Заполните ФИО и паспорт исполнителя в снимке персонажа.");
  }

  if (!fields.executorPosition.trim() || fields.executorPosition === "—") {
    reasons.push("Заполните должность исполнителя в профиле персонажа.");
  }

  if (!fields.executorPhone.trim() || fields.executorPhone === "—") {
    reasons.push("Заполните телефон исполнителя в профиле персонажа.");
  }

  if (!fields.executorIcEmail.trim() || fields.executorIcEmail === "—") {
    reasons.push("Заполните игровую почту исполнителя в профиле персонажа.");
  }

  if (!fields.trustorFullName.trim() || !fields.trustorPassportNumber.trim()) {
    reasons.push("Заполните ФИО и паспорт доверителя.");
  }

  if (!fields.trustorPhone.trim() || fields.trustorPhone === "—") {
    reasons.push("Заполните телефон доверителя.");
  }

  if (!fields.trustorIcEmail.trim() || fields.trustorIcEmail === "—") {
    reasons.push("Заполните игровую почту доверителя.");
  }

  return reasons;
}

function buildPage1Overlays(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: LegalServicesAgreementDraftPayload;
}) {
  const fields = buildLegalServicesAgreementResolvedFields(input);

  return [
    buildTextBlock({
      text: `Договор №${readNormalizedValue(fields.agreementNumber)}\nНа оказание юридических услуг от`,
      x: 298,
      y: 187,
      width: 360,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: 700,
      textAlign: "center",
      textAnchor: "middle",
    }),
    buildTextBlock({
      text: readNormalizedValue(fields.agreementDate),
      x: 63,
      y: 260,
      width: 180,
      fontSize: 19,
      lineHeight: 23,
    }),
    buildTextBlock({
      text: `San Andreas Register\nNo. ${readNormalizedValue(fields.registerNumber)}`,
      x: 765,
      y: 250,
      width: 120,
      fontSize: 16,
      lineHeight: 19,
      fontWeight: 700,
      textAlign: "right",
      textAnchor: "end",
    }),
    buildTextBlock({
      text: buildLegalServicesAgreementIntroParagraph(input),
      x: 92,
      y: 316,
      width: 770,
      fontSize: 20,
      lineHeight: 30,
    }),
    buildTextBlock({
      text: buildLegalServicesAgreementServicePeriodLine(input.payload),
      x: 96,
      y: 1098,
      width: 746,
      fontSize: 18,
      lineHeight: 26,
    }),
  ];
}

function buildPage2Overlays(input: {
  payload: LegalServicesAgreementDraftPayload;
}) {
  return [
    buildTextBlock({
      text: `4. Стоимость услуг и порядок расчётов\n\n${buildLegalServicesAgreementPricingParagraph(
        input.payload,
      )}\n\n${buildLegalServicesAgreementPricingParagraphExtended()}`,
      x: 88,
      y: 1082,
      width: 780,
      fontSize: 18,
      lineHeight: 27,
    }),
  ];
}

function buildPage4Overlays(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: LegalServicesAgreementDraftPayload;
}) {
  return [
    buildTextBlock({
      text: buildExecutorContactBlock(input.authorSnapshot),
      x: 118,
      y: 317,
      width: 274,
      fontSize: 19,
      lineHeight: 27,
      fontWeight: 700,
      textAlign: "center",
      textAnchor: "middle",
    }),
    buildTextBlock({
      text: buildTrustorContactBlock(input.payload),
      x: 564,
      y: 319,
      width: 274,
      fontSize: 19,
      lineHeight: 27,
      fontWeight: 700,
      textAlign: "center",
      textAnchor: "middle",
    }),
    buildSignatureText({
      fullName: readNormalizedValue(input.authorSnapshot.fullName),
      x: 82,
      y: 622,
      width: 302,
      fontSize: 76,
    }),
    buildSignatureText({
      fullName: readNormalizedValue(input.payload.trustorSnapshot.fullName),
      x: 540,
      y: 622,
      width: 302,
      fontSize: 76,
    }),
  ];
}

export async function renderLegalServicesAgreementArtifact(input: {
  title: string;
  authorSnapshot: DocumentAuthorSnapshot;
  payload: LegalServicesAgreementDraftPayload;
}): Promise<LegalServicesAgreementRenderedArtifact> {
  const pageDataUrls = legalServicesAgreementReferenceAssets.pages.map((fileName) =>
    readReferencePageDataUrl(fileName),
  );
  const blockingReasons = validateLegalServicesAgreementForGeneration(input);

  if (pageDataUrls.some((value) => value === null)) {
    return buildReferenceMissingArtifact({
      title: input.title,
      authorSnapshot: input.authorSnapshot,
      payload: input.payload,
      blockingReasons,
    });
  }

  if (blockingReasons.length > 0) {
    throw new LegalServicesAgreementGenerationBlockedError(blockingReasons);
  }

  const pageSvgs = [
    buildPageSvg({
      pageDataUrl: pageDataUrls[0]!,
      overlays: buildPage1Overlays(input),
    }),
    buildPageSvg({
      pageDataUrl: pageDataUrls[1]!,
      overlays: buildPage2Overlays(input),
    }),
    buildPageSvg({
      pageDataUrl: pageDataUrls[2]!,
      overlays: [],
    }),
    buildPageSvg({
      pageDataUrl: pageDataUrls[3]!,
      overlays: buildPage4Overlays(input),
    }),
    buildPageSvg({
      pageDataUrl: pageDataUrls[4]!,
      overlays: [],
    }),
  ];
  const pages = await Promise.all(
    pageSvgs.map(async (pageSvg, index) => {
      const rasterized = await rasterizePage(pageSvg);

      return {
        pageNumber: index + 1,
        fileName: buildPageFileName({
          authorFullName: input.authorSnapshot.fullName,
          trustorFullName: input.payload.trustorSnapshot.fullName,
          pageNumber: index + 1,
        }),
        pngDataUrl: rasterized.pngDataUrl,
        width: rasterized.width,
        height: rasterized.height,
      };
    }),
  );

  return {
    family: "legal_services_agreement",
    format: LEGAL_SERVICES_AGREEMENT_OUTPUT_FORMAT,
    templateVersion: LEGAL_SERVICES_AGREEMENT_TEMPLATE_VERSION,
    rendererVersion: LEGAL_SERVICES_AGREEMENT_RENDERER_VERSION,
    referenceState: "ready",
    previewText: buildLegalServicesAgreementPreviewText(input),
    previewHtml: buildPreviewHtml({
      title: input.title,
      pages,
    }),
    blockingReasons: [],
    pageCount: LEGAL_SERVICES_AGREEMENT_REFERENCE_PAGE_COUNT,
    pages,
  };
}
