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
  buildLegalServicesAgreementPreviewText,
  buildLegalServicesAgreementResolvedFields,
} from "@/features/documents/legal-services-agreement/template-definition";
import type { DocumentAuthorSnapshot } from "@/schemas/document";

const PAGE_WIDTH = 953;
const PAGE_HEIGHT = 1348;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PX_PER_MM = PAGE_WIDTH / A4_WIDTH_MM;
const PX_PER_PT = (PX_PER_MM * 25.4) / 72;
const PAGE_BORDER_X = mm(8.6);
const PAGE_BORDER_Y = mm(18.1);
const PAGE_BORDER_WIDTH = mm(194.8);
const PAGE_BORDER_HEIGHT = mm(248.6);
const QR_X = mm(10.8);
const QR_Y = mm(251.2);
const QR_SIZE = mm(10.6);
const PAGE_TEXT_BOTTOM = QR_Y - mm(6.2);
const assetCache = new Map<string, string>();

const ASSETS_DIR = join(
  process.cwd(),
  "src",
  "features",
  "documents",
  "legal-services-agreement",
  "assets",
);
const FONTS_DIR = join(ASSETS_DIR, "fonts");
const STATIC_DIR = join(ASSETS_DIR, "static");
const LEGAL_SERVICES_AGREEMENT_SEAL_PATH = join(
  STATIC_DIR,
  "seal-page1-crop-final.png",
);

function mm(value: number) {
  return Number((value * PX_PER_MM).toFixed(2));
}

function pt(value: number) {
  return Number((value * PX_PER_PT).toFixed(2));
}

const SERIF_FONT_FAMILY = "Times New Roman, Tinos, Nimbus Roman, Liberation Serif, serif";
const SIGNATURE_FONT_FAMILY = "LegalServicesAgreementSignature";

const PAGE1_PRINT_TOKENS = {
  fontSerifRegular: SERIF_FONT_FAMILY,
  fontSerifBold: SERIF_FONT_FAMILY,
  fontSerifItalic: SERIF_FONT_FAMILY,
  bodyFontSize: pt(11.25),
  bodyLineHeight: pt(14.15),
  introFontSize: pt(11),
  introLineHeight: pt(13.85),
  titleLine1Size: pt(12.8),
  titleLine2Size: pt(11.5),
  metaFontSize: pt(8.3),
  sectionTitleSize: pt(12.2),
  listIndent: mm(1.8),
  hangingIndent: mm(5.9),
} as const;

const signatureFontDataUrl = readLocalAssetDataUrl(
  join(FONTS_DIR, "GreatVibes-Regular.ttf"),
  "font/ttf",
);
const qrDataUrl = readLocalAssetDataUrl(
  join(STATIC_DIR, "qr-static.png"),
  "image/png",
);
const sealDataUrl = readLocalAssetDataUrl(
  LEGAL_SERVICES_AGREEMENT_SEAL_PATH,
  "image/png",
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

const CONTENT_LEFT_X = mm(16.2);
const CONTENT_RIGHT_X = mm(188.3);
const CONTENT_WIDTH = CONTENT_RIGHT_X - CONTENT_LEFT_X;

const PAGE_BASE_CONFIG = {
  border: {
    x: PAGE_BORDER_X,
    y: PAGE_BORDER_Y,
    width: PAGE_BORDER_WIDTH,
    height: PAGE_BORDER_HEIGHT,
  },
  qr: {
    x: QR_X,
    y: QR_Y,
    size: QR_SIZE,
  },
} as const;

const PAGE_FRAME_CENTER_X = PAGE_BORDER_X + PAGE_BORDER_WIDTH / 2;

const PAGE1_LAYOUT = {
  decorativeFrame: {
    x: PAGE_BORDER_X,
    y: PAGE_BORDER_Y,
    width: PAGE_BORDER_WIDTH,
    height: PAGE_BORDER_HEIGHT,
  },
  crest: {
    x: mm(94.4),
    y: mm(21.4),
    width: mm(23.8),
    height: mm(18.9),
  },
  titleStack: {
    x: PAGE_FRAME_CENTER_X - mm(90.4) / 2,
    width: mm(90.4),
    titleY: mm(44.1),
    subtitleY: mm(50.1),
    centerOffsetX: -mm(8.4),
  },
  metaLeftDate: {
    x: mm(16.2),
    y: mm(54.2),
    width: mm(54),
  },
  metaRightRegister: {
    x: mm(143.8),
    y: mm(54.9),
    width: mm(42.6),
    titleGap: pt(7.9),
  },
  introBlock: {
    x: mm(14.8),
    y: mm(68.1),
    width: mm(187.8),
  },
  sectionTitle: {
    x: PAGE_BORDER_X,
    y: mm(101.2),
    width: PAGE_BORDER_WIDTH,
    centerOffsetX: -mm(7.2),
  },
  bodyTextFrame: {
    x: mm(14.8),
    y: mm(108.4),
    width: mm(187.8),
    maxBottomY: PAGE_TEXT_BOTTOM - pt(2.8),
    paragraphGap: pt(2.3),
  },
  qrBlock: {
    x: QR_X,
    y: QR_Y,
    size: QR_SIZE,
  },
} as const;

const PAGE2_LAYOUT = {
  title: { y: 136, size: 20, lineHeight: 23 },
  section2: {
    x: CONTENT_LEFT_X + 4,
    y: 164,
    width: CONTENT_WIDTH - 8,
    size: 15,
    lineHeight: 17.9,
    paragraphGap: 7,
    minFontSize: 13.4,
    minLineHeight: 16.5,
    maxBottomY: 726,
  },
  section3And4: {
    x: CONTENT_LEFT_X + 4,
    width: CONTENT_WIDTH - 8,
    size: 15.2,
    lineHeight: 18.8,
    paragraphGap: 8,
    minFontSize: 13.7,
    minLineHeight: 17.1,
    maxBottomY: PAGE_TEXT_BOTTOM,
    topGap: 12,
  },
} as const;

const PAGE3_LAYOUT = {
  top: {
    x: CONTENT_LEFT_X + 4,
    y: 160,
    width: CONTENT_WIDTH - 8,
    size: 15.1,
    lineHeight: 18.8,
    paragraphGap: 8,
    minFontSize: 13.7,
    minLineHeight: 17,
    maxBottomY: 455,
  },
  section5: {
    x: CONTENT_LEFT_X + 6,
    width: CONTENT_WIDTH - 12,
    size: 14.8,
    lineHeight: 17.8,
    paragraphGap: 7,
    minFontSize: 13.2,
    minLineHeight: 16.2,
    maxBottomY: 805,
    topGap: 8,
  },
  section6: {
    x: CONTENT_LEFT_X + 4,
    width: CONTENT_WIDTH - 8,
    size: 14.8,
    lineHeight: 18.3,
    paragraphGap: 7,
    minFontSize: 13,
    minLineHeight: 16.5,
    maxBottomY: PAGE_TEXT_BOTTOM,
    topGap: 10,
  },
} as const;

const PAGE4_LAYOUT = {
  top: {
    x: CONTENT_LEFT_X + 4,
    y: 160,
    width: CONTENT_WIDTH - 8,
    size: 14.8,
    lineHeight: 18.2,
    paragraphGap: 7,
    minFontSize: 13.3,
    minLineHeight: 16.5,
    maxBottomY: 300,
  },
  sectionTitle: { y: 322, size: 20, lineHeight: 23 },
  executorColumn: { x: 102, y: 356, width: 270 },
  trustorColumn: { x: 582, y: 356, width: 270 },
  signatureLines: {
    leftX1: 98,
    leftX2: 372,
    rightX1: 580,
    rightX2: 854,
    y: 655,
  },
  signerNames: {
    y: 631,
    width: 264,
    leftX: 104,
    rightX: 586,
    size: 14,
    lineHeight: 16,
  },
  signatureGlyphs: {
    y: 649,
    width: 246,
    leftX: 112,
    rightX: 594,
    size: 24,
  },
  signatureHints: {
    y: 684,
    width: 260,
    leftX: 102,
    rightX: 584,
    size: 10.5,
    lineHeight: 12,
  },
} as const;

type TextBlockConfig = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  fontFamily?: string;
  fontWeight?: 400 | 700;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  textAnchor?: "start" | "middle" | "end";
};

type ParagraphBlockConfig = TextBlockConfig & {
  paragraphs: string[];
  paragraphGap?: number;
};

type BulletListBlockConfig = {
  items: string[];
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  fontFamily?: string;
  fontWeight?: 400 | 700;
  fontStyle?: "normal" | "italic";
  itemGap?: number;
  listIndent?: number;
  hangingIndent?: number;
  marker?: string;
};

type BuiltBlock = {
  svg: string;
  bottomY: number;
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
      units += 0.28;
    } else if (/[0-9]/.test(char)) {
      units += 0.47;
    } else if (/[A-Za-z]/.test(char)) {
      units += 0.47;
    } else if (/[А-Яа-яЁё]/.test(char)) {
      units += 0.52;
    } else if (/[.,:;!?()[\]"'/-]/.test(char)) {
      units += 0.27;
    } else {
      units += 0.49;
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

function buildTextBlock(input: TextBlockConfig) {
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

      return `<text x="${x}" y="${y}" font-family="${input.fontFamily ?? SERIF_FONT_FAMILY}" font-size="${input.fontSize}"${input.fontWeight ? ` font-weight="${input.fontWeight}"` : ""}${input.fontStyle ? ` font-style="${input.fontStyle}"` : ""}${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${escapeXml(
        line,
      )}</text>`;
    })
    .join("");
}

function buildParagraphBlock(input: ParagraphBlockConfig): BuiltBlock {
  const parts: string[] = [];
  let cursorY = input.y;
  const paragraphGap = input.paragraphGap ?? Math.round(input.lineHeight * 0.55);

  for (const paragraph of input.paragraphs) {
    if (paragraph.trim().length === 0) {
      cursorY += paragraphGap;
      continue;
    }

    const lines = wrapText(paragraph, input.width, input.fontSize);
    const x =
      input.textAlign === "center"
        ? input.x + input.width / 2
        : input.textAlign === "right"
          ? input.x + input.width
          : input.x;
    const anchor =
      input.textAnchor ??
      (input.textAlign === "center"
        ? "middle"
        : input.textAlign === "right"
          ? "end"
          : "start");

    parts.push(
      ...lines.map((line, index) => {
        const y = cursorY + index * input.lineHeight;

        return `<text x="${x}" y="${y}" font-family="${input.fontFamily ?? SERIF_FONT_FAMILY}" font-size="${input.fontSize}"${input.fontWeight ? ` font-weight="${input.fontWeight}"` : ""}${input.fontStyle ? ` font-style="${input.fontStyle}"` : ""}${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${escapeXml(
          line,
        )}</text>`;
      }),
    );

    cursorY += lines.length * input.lineHeight + paragraphGap;
  }

  return {
    svg: parts.join(""),
    bottomY: cursorY,
  };
}

function buildBulletListBlock(input: BulletListBlockConfig): BuiltBlock {
  const parts: string[] = [];
  let cursorY = input.y;
  const itemGap = input.itemGap ?? Math.round(input.lineHeight * 0.35);
  const listIndent = input.listIndent ?? 0;
  const hangingIndent = input.hangingIndent ?? Math.max(18, input.lineHeight * 0.9);
  const marker = input.marker ?? "•";
  const bulletX = input.x + listIndent;
  const textX = input.x + hangingIndent;
  const textWidth = Math.max(20, input.width - hangingIndent);

  for (const item of input.items) {
    const lines = wrapText(item, textWidth, input.fontSize);

    parts.push(
      `<text x="${bulletX}" y="${cursorY}" font-family="${input.fontFamily ?? SERIF_FONT_FAMILY}" font-size="${input.fontSize}"${input.fontWeight ? ` font-weight="${input.fontWeight}"` : ""}${input.fontStyle ? ` font-style="${input.fontStyle}"` : ""}>${escapeXml(marker)}</text>`,
    );

    parts.push(
      ...lines.map((line, index) => {
        const y = cursorY + index * input.lineHeight;

        return `<text x="${textX}" y="${y}" font-family="${input.fontFamily ?? SERIF_FONT_FAMILY}" font-size="${input.fontSize}"${input.fontWeight ? ` font-weight="${input.fontWeight}"` : ""}${input.fontStyle ? ` font-style="${input.fontStyle}"` : ""}>${escapeXml(
          line,
        )}</text>`;
      }),
    );

    cursorY += lines.length * input.lineHeight + itemGap;
  }

  return {
    svg: parts.join(""),
    bottomY: cursorY,
  };
}

function buildFittedParagraphBlock(
  input: ParagraphBlockConfig & {
    minFontSize?: number;
    minLineHeight?: number;
    maxBottomY: number;
  },
): BuiltBlock {
  let fontSize = input.fontSize;
  let lineHeight = input.lineHeight;
  const minFontSize = input.minFontSize ?? Math.max(12, input.fontSize - 3);
  const minLineHeight = input.minLineHeight ?? Math.max(15, input.lineHeight - 4);

  while (true) {
    const built = buildParagraphBlock({
      ...input,
      fontSize,
      lineHeight,
    });

    if (built.bottomY <= input.maxBottomY || fontSize <= minFontSize) {
      return built;
    }

    fontSize = Math.max(minFontSize, fontSize - 0.5);
    lineHeight = Math.max(minLineHeight, lineHeight - 0.7);
  }
}

function buildFittedBulletListBlock(
  input: BulletListBlockConfig & {
    minFontSize?: number;
    minLineHeight?: number;
    maxBottomY: number;
  },
): BuiltBlock {
  let fontSize = input.fontSize;
  let lineHeight = input.lineHeight;
  const minFontSize = input.minFontSize ?? Math.max(12, input.fontSize - 3);
  const minLineHeight = input.minLineHeight ?? Math.max(15, input.lineHeight - 4);

  while (true) {
    const built = buildBulletListBlock({
      ...input,
      fontSize,
      lineHeight,
    });

    if (built.bottomY <= input.maxBottomY || fontSize <= minFontSize) {
      return built;
    }

    fontSize = Math.max(minFontSize, fontSize - 0.5);
    lineHeight = Math.max(minLineHeight, lineHeight - 0.7);
  }
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

function buildPageBase(input: {
  overlays: string[];
  seal?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}) {
  const fontFace =
    signatureFontDataUrl !== null
      ? `<style>@font-face{font-family:'${SIGNATURE_FONT_FAMILY}';src:url('${signatureFontDataUrl}') format('truetype');font-weight:400;font-style:normal;}</style>`
      : "";
  const sealBox = input.seal ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };

  const seal =
    sealDataUrl !== null
      ? `<image href="${sealDataUrl}" x="${sealBox.x}" y="${sealBox.y}" width="${sealBox.width}" height="${sealBox.height}" preserveAspectRatio="xMidYMid meet" />`
      : "";
  const qr =
    qrDataUrl !== null
      ? `<image href="${qrDataUrl}" x="${PAGE_BASE_CONFIG.qr.x}" y="${PAGE_BASE_CONFIG.qr.y}" width="${PAGE_BASE_CONFIG.qr.size}" height="${PAGE_BASE_CONFIG.qr.size}" preserveAspectRatio="xMidYMid meet" />`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">
    ${fontFace}
    <rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="#ffffff" />
    <rect x="${PAGE_BASE_CONFIG.border.x}" y="${PAGE_BASE_CONFIG.border.y}" width="${PAGE_BASE_CONFIG.border.width}" height="${PAGE_BASE_CONFIG.border.height}" fill="none" stroke="#7a7a7a" stroke-width="1.2" />
    ${seal}
    ${qr}
    ${input.overlays.join("\n")}
  </svg>`;
}

async function rasterizePage(pageSvg: string) {
  const pageBuffer = await sharp(Buffer.from(pageSvg))
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: false,
    })
    .toBuffer();

  return {
    pngDataUrl: makeDataUrl("image/png", pageBuffer),
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
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
    @page { size: ${A4_WIDTH_MM}mm ${A4_HEIGHT_MM}mm; margin: 0; }
    body { margin: 0; background: #f3f4f6; font-family: ${SERIF_FONT_FAMILY}; }
    .preview-shell { display: grid; gap: 24px; justify-content: center; padding: 24px; }
    .page { width: ${A4_WIDTH_MM}mm; min-height: ${A4_HEIGHT_MM}mm; background: #fff; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16); }
    .page img { display: block; width: ${A4_WIDTH_MM}mm; height: ${A4_HEIGHT_MM}mm; }
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
  return `<main style="font-family:${SERIF_FONT_FAMILY};max-width:960px;margin:0 auto;padding:24px;background:#ffffff;">
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
    "Статические assets для рендера договора на оказание юридических услуг недоступны.";
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

function buildPage1SectionContent(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: LegalServicesAgreementDraftPayload;
}) {
  const fields = buildLegalServicesAgreementResolvedFields(input);

  return {
    beforeList: [
      "1.1. По Договору Законный представитель обязуется оказывать юридическую помощь Доверителю, а Доверитель обязуется оплатить такую помощь.",
      "1.2. В рамках Договора Законный представитель обязуется:",
    ],
    listItems: [
      "давать консультации и справки по правовым вопросам как в устной, так и в письменной форме;",
      "представлять интересы доверителя в органах исполнительной власти, органах местного самоуправления, общественных объединениях и иных организациях;",
      "подготавливать необходимые документы направлять их в Суд или органы государственной власти, в том числе Офис Генерального прокурора, в том числе от имени Доверителя и в его интересах;",
      "требовать или запрашивать необходимые сведения от органов государственной власти, в том числе Офиса Генерального прокурора, которые касаются Доверителя, в том числе о проводящихся или проводившихся процессуальных действиях, расследованиях, проверок в сторону Доверителя;",
      "составлять заявления, жалобы, ходатайства и другие документы правового характера в органы государственной власти, в том числе от имени Доверителя и в его интересах;",
      "присутствовать при задержаниях Доверителя, допросе или при проведении других процессуальных действий в его сторону;",
      "посещать Доверителя в местах лишения свободы в случае его ареста, в том числе Федеральной тюрьме и КПЗ региональных правоохранительных ведомств.",
      "оформлять внесение залоговой суммы для оказания Доверителю услуги освобождения под залог из мест лишения свободы в рамках предусмотренных законодательством;",
      "принимать все правовые методы для положительного для Доверителя решения Суда или органа государственной власти;",
      "участвовать в качестве представителя доверителя в гражданском и административном судопроизводстве;",
      "участвовать в качестве представителя или защитника доверителя в уголовном и административном судопроизводстве;",
      "выступать в качестве представителя доверителя в налоговых правоотношениях;",
    ],
    afterList: `1.3. Услуги по настоящему Договору подлежат оказанию Законным представителем с ${readNormalizedValue(
      fields.servicePeriodStart,
    )} по ${readNormalizedValue(fields.servicePeriodEnd)}.`,
  };
}

function buildPage2Section2Paragraphs() {
  return [
    "2.1. Законный представитель обязуется:",
    "Оказать услуги по настоящему Договору с надлежащим качеством и в соответствии с нормами действующего законодательства;",
    "Оказать услуги в сроки, установленные настоящим Договором;",
    "При исполнении настоящего Договора действовать в интересах Доверителя и от его имени;",
    "Своевременно извещать Доверителя о необходимости участия последнего в переговорах, судебных заседаниях либо о необходимости присутствия Заказчика на иных мероприятиях.",
    "Предоставлять Доверителю устные отчеты о ходе оказания услуг по настоящему Договору.",
    "2.2. Законный представитель имеет право:",
    "Требовать от Доверителя оплаты понесенных Законным представителем расходов в рамках исполнения предмета поручения Договора, таких как: оплата судебной пошлины; покупка и передача продуктов Доверителю в места лишения свободы; оплата проезда такси от места пребывания Законного представителя до места пребывания Доверителя.",
    "2.3. Доверитель обязуется:",
    "Предоставить Законному представителю документы, сведения, информацию, необходимые для надлежащего исполнения настоящего Договора.",
    "Присутствовать на переговорах, судебных заседаниях, при проведении иных мероприятий, на необходимость посещения которых указал Законный представитель.",
    "Оплатить услуги Законного представителя в размере, порядке и на условиях, которые установлены настоящим Договором.",
    "2.4. Доверитель имеет право:",
    "Осуществлять контроль за процессом оказания услуг Законным представителем, не вмешиваясь при этом в деятельность Законного представителя.",
    "Требовать от Законного представителя представления устного отчета о ходе оказания услуг.",
    "Присутствовать на всех судебных заседаниях, проводимых Законным представителем.",
  ];
}

function buildPage2Section3And4Paragraphs(input: {
  payload: LegalServicesAgreementDraftPayload;
}) {
  const fields = buildLegalServicesAgreementResolvedFields({
    authorSnapshot: {
      characterId: "",
      serverId: "",
      serverCode: "",
      serverName: "",
      fullName: "",
      nickname: "",
      passportNumber: "",
      position: "",
      address: "",
      phone: "",
      icEmail: "",
      passportImageUrl: "",
      isProfileComplete: false,
      roleKeys: [],
      accessFlags: [],
      capturedAt: "",
    },
    payload: input.payload,
  });

  return [
    "3. Порядок внесения изменений в Договор и расторжения Договора",
    "3.1. Доверитель и Законный представитель имеют право в любое время суток, по обоюдному согласию вносить изменения в пункты 1, 2 и 4 настоящего Договора, дополнять или отменять действия определенных ранее пунктов.",
    "3.2. Для внесения изменений в настоящий Договор достаточным условием является устное согласие уведомляемой Стороны с изменениями в Договор.",
    "3.3. Стороны вправе расторгнуть настоящий Договор досрочно при обоюдном согласии.",
    "3.4. Законный представитель может расторгнуть настоящий Договор досрочно в случае если его услуги не будут оплачены в течении одного часа после подписания Договора.",
    "4. Стоимость услуг и порядок расчетов",
    `4.1. Стоимость услуг по данному Договору определяется в размере ${readNormalizedValue(
      fields.priceAmount,
    )}.`,
    "4.2. Оплата услуг Законного представителя осуществляется Доверителем в виде передачи Доверителем Законному представителю наличной денежной суммы, которая указана в пункте 4.1. настоящего Договора, или путём совершения банковского перевода на сумму, которая указана в пункте 4.1. настоящего Договора, на банковский счёт Законного представителя.",
  ];
}

function buildPage3Paragraphs(input: { payload: LegalServicesAgreementDraftPayload }) {
  const fields = buildLegalServicesAgreementResolvedFields({
    authorSnapshot: {
      characterId: "",
      serverId: "",
      serverCode: "",
      serverName: "",
      fullName: "",
      nickname: "",
      passportNumber: "",
      position: "",
      address: "",
      phone: "",
      icEmail: "",
      passportImageUrl: "",
      isProfileComplete: false,
      roleKeys: [],
      accessFlags: [],
      capturedAt: "",
    },
    payload: input.payload,
  });

  return {
    top: [
      "4.3. Оплата услуг Законного представителя осуществляется Доверителем в течении одного часа после подписании Договора всеми Сторонами.",
      "4.4. Оплата услуги по освобождению под залог Доверителя из КПЗ региональных правоохранительных ведомств осуществляется отдельно согласно статье 14 Административного кодекса.",
      "4.5. Не подлежит возврату денежная сумма, которая была уплачена Доверителем Законному представителю в рамках оплаты стоимости услуг по настоящему Договору, в случае расторжения Договора по обоюдному согласию Сторон.",
      "5. Ответственность сторон. Форс-Мажор",
    ],
    section5: [
      "5.1. За неисполнение или ненадлежащее исполнение обязательств по настоящему Договору Стороны несут гражданскую ответственность и имеют право требовать от другой Стороны компенсацию в денежном эквиваленте, сумма которой будет определена судом исходя из обстоятельств.",
      "5.2. Законный представитель не несет ответственности за последствия, связанные с предоставлением Заказчиком документов или сведений, не соответствующих действительности.",
      "5.3. Стороны освобождаются от ответственности за неисполнение или ненадлежащее исполнение обязательств по Договору, если надлежащее исполнение оказалось невозможным вследствие непреодолимой силы, то есть чрезвычайных и непредотвратимых при данных условиях обстоятельств, под которыми понимаются: противоправные действия властей, гражданские волнения, эпидемии, блокада, эмбарго, землетрясения, наводнения, пожары или другие стихийные бедствия и иные форс-мажорные обстоятельства.",
      "5.4. В случае наступления этих обстоятельств Сторона обязана в течение 24 часов уведомить об этом другую Сторону в письменном виде.",
    ],
    section6: [
      "6. Порядок разрешения споров",
      "6.1 Стороны договорились о применении обязательного претензионного порядка урегулирования споров в досудебном порядке. В случае возникновения споров стороны направляют друг другу претензии в письменном виде. При получении претензии сторона, получившая претензию, обязуется рассмотреть претензию в течение 14 (четырнадцати) календарных дней с момента ее получения с направлением другой стороне письменного ответа на претензию в указанный срок.",
      "6.2. Все не урегулированные путем переговоров споры, связанные с заключением, толкованием, исполнением, изменением и расторжением Договора, передаются в суд соответствующей юрисдикции.",
      "7.1. Настоящий Договор составлен в одном физическом экземпляре и хранится у Законного представителя или Доверителя, а также в одном электронном экземпляре (электронной копии) на сайте Департамента юстиции в разделе Договоры на оказание юридической помощи гражданам и организациям.",
      "7.2. Высшую и окончательную юридическую силу несет электронный экземпляр, который опубликован на сайте Департамента юстиции в разделе Договоры на оказание юридической помощи гражданам и организациям.",
      "7.3. Настоящий Договор публикуется Законным представителем на сайте Департамента юстиции в разделе Договоры на оказание юридической помощи гражданам и организациям в течении 6 часов с момента подписания Договора всеми сторонами Договора.",
      "7.4. Подписывая настоящий Договор Доверитель считается уведомленным о том, что он может ознакомиться с настоящим Договором на сайте Департамента юстиции или непосредственно запросить электронную копию настоящего Договора у Законного представителя.",
      `Сумма по договору: ${readNormalizedValue(fields.priceAmount)}.`,
    ],
  };
}

function buildPage1(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: LegalServicesAgreementDraftPayload;
}) {
  const fields = buildLegalServicesAgreementResolvedFields(input);
  const page1Content = buildPage1SectionContent(input);
  const intro = `${fields.trustorFullName} с номером паспорта ${fields.trustorPassportNumber}, именуемый в дальнейшем «Доверитель», «Заказчик», с одной стороны, ${fields.executorPosition} ${fields.executorFullName} с номером паспорта ${fields.executorPassportNumber} действующий на основании закона «Об адвокатуре и адвокатской деятельности в штате Сан-Андреас», именуемый в дальнейшем «Исполнитель», «Представитель», «Поверенный» с другой стороны, заключили настоящий договор о нижеследующем:`;
  const section1Start = buildParagraphBlock({
    paragraphs: page1Content.beforeList,
    x: PAGE1_LAYOUT.bodyTextFrame.x,
    y: PAGE1_LAYOUT.bodyTextFrame.y,
    width: PAGE1_LAYOUT.bodyTextFrame.width,
    fontFamily: PAGE1_PRINT_TOKENS.fontSerifRegular,
    fontSize: PAGE1_PRINT_TOKENS.bodyFontSize,
    lineHeight: PAGE1_PRINT_TOKENS.bodyLineHeight,
    paragraphGap: PAGE1_LAYOUT.bodyTextFrame.paragraphGap,
    text: "",
  });
  const section1List = buildFittedBulletListBlock({
    items: page1Content.listItems,
    x: PAGE1_LAYOUT.bodyTextFrame.x,
    y: section1Start.bottomY - pt(1.4),
    width: PAGE1_LAYOUT.bodyTextFrame.width,
    fontFamily: PAGE1_PRINT_TOKENS.fontSerifRegular,
    fontSize: PAGE1_PRINT_TOKENS.bodyFontSize,
    lineHeight: PAGE1_PRINT_TOKENS.bodyLineHeight,
    itemGap: pt(1.2),
    listIndent: PAGE1_PRINT_TOKENS.listIndent,
    hangingIndent: PAGE1_PRINT_TOKENS.hangingIndent,
    marker: "-",
    minFontSize: pt(11.4),
    minLineHeight: pt(14.3),
    maxBottomY: PAGE1_LAYOUT.bodyTextFrame.maxBottomY - pt(7),
  });
  const section1End = buildFittedParagraphBlock({
    paragraphs: [page1Content.afterList],
    x: PAGE1_LAYOUT.bodyTextFrame.x,
    y: section1List.bottomY + pt(0.35),
    width: PAGE1_LAYOUT.bodyTextFrame.width,
    fontFamily: PAGE1_PRINT_TOKENS.fontSerifRegular,
    fontSize: PAGE1_PRINT_TOKENS.bodyFontSize,
    lineHeight: PAGE1_PRINT_TOKENS.bodyLineHeight,
    paragraphGap: PAGE1_LAYOUT.bodyTextFrame.paragraphGap,
    minFontSize: pt(11.4),
    minLineHeight: pt(14.3),
    maxBottomY: PAGE1_LAYOUT.bodyTextFrame.maxBottomY,
    text: "",
  });

  return buildPageBase({
    seal: PAGE1_LAYOUT.crest,
    overlays: [
      buildTextBlock({
        text: `Договор №${readNormalizedValue(fields.agreementNumber)}`,
        x: PAGE1_LAYOUT.titleStack.x + PAGE1_LAYOUT.titleStack.centerOffsetX,
        y: PAGE1_LAYOUT.titleStack.titleY,
        width: PAGE1_LAYOUT.titleStack.width,
        fontSize: PAGE1_PRINT_TOKENS.titleLine1Size,
        lineHeight: pt(17.5),
        fontFamily: PAGE1_PRINT_TOKENS.fontSerifBold,
        fontWeight: 700,
        textAlign: "center",
      }),
      buildTextBlock({
        text: "На оказание юридических услуг от",
        x: PAGE1_LAYOUT.titleStack.x + PAGE1_LAYOUT.titleStack.centerOffsetX,
        y: PAGE1_LAYOUT.titleStack.subtitleY,
        width: PAGE1_LAYOUT.titleStack.width,
        fontSize: PAGE1_PRINT_TOKENS.titleLine2Size,
        lineHeight: pt(13.6),
        fontFamily: PAGE1_PRINT_TOKENS.fontSerifBold,
        fontWeight: 700,
        textAlign: "center",
      }),
      buildTextBlock({
        text: readNormalizedValue(fields.agreementDate),
        x: PAGE1_LAYOUT.metaLeftDate.x,
        y: PAGE1_LAYOUT.metaLeftDate.y,
        width: PAGE1_LAYOUT.metaLeftDate.width,
        fontSize: PAGE1_PRINT_TOKENS.metaFontSize,
        lineHeight: pt(13.2),
        fontFamily: PAGE1_PRINT_TOKENS.fontSerifItalic,
        fontStyle: "italic",
      }),
      buildTextBlock({
        text: "San Andreas Register",
        x: PAGE1_LAYOUT.metaRightRegister.x,
        y: PAGE1_LAYOUT.metaRightRegister.y,
        width: PAGE1_LAYOUT.metaRightRegister.width,
        fontSize: PAGE1_PRINT_TOKENS.metaFontSize,
        lineHeight: pt(10.8),
        fontFamily: PAGE1_PRINT_TOKENS.fontSerifBold,
        fontWeight: 700,
        textAlign: "right",
      }),
      buildTextBlock({
        text: `No. ${readNormalizedValue(fields.registerNumber)}`,
        x: PAGE1_LAYOUT.metaRightRegister.x,
        y: PAGE1_LAYOUT.metaRightRegister.y + PAGE1_LAYOUT.metaRightRegister.titleGap,
        width: PAGE1_LAYOUT.metaRightRegister.width,
        fontSize: PAGE1_PRINT_TOKENS.metaFontSize,
        lineHeight: pt(10.8),
        fontFamily: PAGE1_PRINT_TOKENS.fontSerifRegular,
        textAlign: "right",
      }),
      buildTextBlock({
        text: intro,
        x: PAGE1_LAYOUT.introBlock.x,
        y: PAGE1_LAYOUT.introBlock.y,
        width: PAGE1_LAYOUT.introBlock.width,
        fontSize: PAGE1_PRINT_TOKENS.introFontSize,
        lineHeight: PAGE1_PRINT_TOKENS.introLineHeight,
        fontFamily: PAGE1_PRINT_TOKENS.fontSerifRegular,
      }),
      buildTextBlock({
        text: "1. Предмет договора (поручения)",
        x: PAGE1_LAYOUT.sectionTitle.x + PAGE1_LAYOUT.sectionTitle.centerOffsetX,
        y: PAGE1_LAYOUT.sectionTitle.y,
        width: PAGE1_LAYOUT.sectionTitle.width,
        fontSize: PAGE1_PRINT_TOKENS.sectionTitleSize,
        lineHeight: pt(15.5),
        fontFamily: PAGE1_PRINT_TOKENS.fontSerifBold,
        fontWeight: 700,
        textAlign: "center",
      }),
      section1Start.svg,
      section1List.svg,
      section1End.svg,
    ],
  });
}

function buildPage2(input: { payload: LegalServicesAgreementDraftPayload }) {
  const section2 = buildFittedParagraphBlock({
    paragraphs: buildPage2Section2Paragraphs(),
    x: PAGE2_LAYOUT.section2.x,
    y: PAGE2_LAYOUT.section2.y,
    width: PAGE2_LAYOUT.section2.width,
    fontFamily: SERIF_FONT_FAMILY,
    fontSize: PAGE2_LAYOUT.section2.size,
    lineHeight: PAGE2_LAYOUT.section2.lineHeight,
    paragraphGap: PAGE2_LAYOUT.section2.paragraphGap,
    minFontSize: PAGE2_LAYOUT.section2.minFontSize,
    minLineHeight: PAGE2_LAYOUT.section2.minLineHeight,
    maxBottomY: PAGE2_LAYOUT.section2.maxBottomY,
    text: "",
  });
  const section3and4 = buildFittedParagraphBlock({
    paragraphs: buildPage2Section3And4Paragraphs(input),
    x: PAGE2_LAYOUT.section3And4.x,
    y: section2.bottomY + PAGE2_LAYOUT.section3And4.topGap,
    width: PAGE2_LAYOUT.section3And4.width,
    fontFamily: SERIF_FONT_FAMILY,
    fontSize: PAGE2_LAYOUT.section3And4.size,
    lineHeight: PAGE2_LAYOUT.section3And4.lineHeight,
    paragraphGap: PAGE2_LAYOUT.section3And4.paragraphGap,
    minFontSize: PAGE2_LAYOUT.section3And4.minFontSize,
    minLineHeight: PAGE2_LAYOUT.section3And4.minLineHeight,
    maxBottomY: PAGE2_LAYOUT.section3And4.maxBottomY,
    text: "",
  });

  return buildPageBase({
    overlays: [
      buildTextBlock({
        text: "2. Права и обязанности сторон",
        x: 0,
        y: PAGE2_LAYOUT.title.y,
        width: PAGE_WIDTH,
        fontSize: PAGE2_LAYOUT.title.size,
        lineHeight: PAGE2_LAYOUT.title.lineHeight,
        fontWeight: 700,
        textAlign: "center",
      }),
      section2.svg,
      section3and4.svg,
    ],
  });
}

function buildPage3(input: { payload: LegalServicesAgreementDraftPayload }) {
  const page3 = buildPage3Paragraphs(input);
  const top = buildFittedParagraphBlock({
    paragraphs: page3.top,
    x: PAGE3_LAYOUT.top.x,
    y: PAGE3_LAYOUT.top.y,
    width: PAGE3_LAYOUT.top.width,
    fontFamily: SERIF_FONT_FAMILY,
    fontSize: PAGE3_LAYOUT.top.size,
    lineHeight: PAGE3_LAYOUT.top.lineHeight,
    paragraphGap: PAGE3_LAYOUT.top.paragraphGap,
    minFontSize: PAGE3_LAYOUT.top.minFontSize,
    minLineHeight: PAGE3_LAYOUT.top.minLineHeight,
    maxBottomY: PAGE3_LAYOUT.top.maxBottomY,
    text: "",
  });
  const section5 = buildFittedParagraphBlock({
    paragraphs: page3.section5,
    x: PAGE3_LAYOUT.section5.x,
    y: top.bottomY + PAGE3_LAYOUT.section5.topGap,
    width: PAGE3_LAYOUT.section5.width,
    fontFamily: SERIF_FONT_FAMILY,
    fontSize: PAGE3_LAYOUT.section5.size,
    lineHeight: PAGE3_LAYOUT.section5.lineHeight,
    paragraphGap: PAGE3_LAYOUT.section5.paragraphGap,
    minFontSize: PAGE3_LAYOUT.section5.minFontSize,
    minLineHeight: PAGE3_LAYOUT.section5.minLineHeight,
    maxBottomY: PAGE3_LAYOUT.section5.maxBottomY,
    text: "",
  });
  const section6 = buildFittedParagraphBlock({
    paragraphs: page3.section6,
    x: PAGE3_LAYOUT.section6.x,
    y: section5.bottomY + PAGE3_LAYOUT.section6.topGap,
    width: PAGE3_LAYOUT.section6.width,
    fontFamily: SERIF_FONT_FAMILY,
    fontSize: PAGE3_LAYOUT.section6.size,
    lineHeight: PAGE3_LAYOUT.section6.lineHeight,
    paragraphGap: PAGE3_LAYOUT.section6.paragraphGap,
    minFontSize: PAGE3_LAYOUT.section6.minFontSize,
    minLineHeight: PAGE3_LAYOUT.section6.minLineHeight,
    maxBottomY: PAGE3_LAYOUT.section6.maxBottomY,
    text: "",
  });

  return buildPageBase({
    overlays: [top.svg, section5.svg, section6.svg],
  });
}

function buildContactColumn(input: {
  heading: string;
  lines: string[];
  x: number;
  y: number;
  width: number;
}) {
  const headingBlock = buildTextBlock({
    text: input.heading,
    x: input.x,
    y: input.y,
    width: input.width,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: 700,
    textAlign: "center",
  });
  const bodyBlock = buildParagraphBlock({
    paragraphs: input.lines,
    x: input.x,
    y: input.y + 44,
    width: input.width,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: 400,
    textAlign: "center",
    paragraphGap: 6,
    text: "",
  });

  return {
    svg: `${headingBlock}${bodyBlock.svg}`,
    bottomY: bodyBlock.bottomY,
  };
}

function buildPage4(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: LegalServicesAgreementDraftPayload;
}) {
  const fields = buildLegalServicesAgreementResolvedFields(input);
  const topBlock = buildFittedParagraphBlock({
    paragraphs: [
      "7.5. По требованию Доверителя Законный представитель обязуется предоставить Доверителю электронную копию Договора немедленно по электронной почте.",
      "7.6. Доверитель по правовому статусу также приравнивается к подзащитному и/или клиенту адвоката",
      "7.7. Законный представитель по правовому статусу приравнивается к Представителю доверителя, Адвокату и Защитнику доверителя.",
    ],
    x: PAGE4_LAYOUT.top.x,
    y: PAGE4_LAYOUT.top.y,
    width: PAGE4_LAYOUT.top.width,
    fontSize: PAGE4_LAYOUT.top.size,
    lineHeight: PAGE4_LAYOUT.top.lineHeight,
    paragraphGap: PAGE4_LAYOUT.top.paragraphGap,
    minFontSize: PAGE4_LAYOUT.top.minFontSize,
    minLineHeight: PAGE4_LAYOUT.top.minLineHeight,
    maxBottomY: PAGE4_LAYOUT.top.maxBottomY,
    text: "",
  });

  const executorColumn = buildContactColumn({
    heading: "ИСПОЛНИТЕЛЬ",
    x: PAGE4_LAYOUT.executorColumn.x,
    y: PAGE4_LAYOUT.executorColumn.y,
    width: PAGE4_LAYOUT.executorColumn.width,
    lines: [
      fields.executorPosition,
      fields.executorFullName,
      "Номер паспорта:",
      fields.executorPassportNumber,
      `Контактный телефон: ${fields.executorPhone}`,
      `E-mail: ${fields.executorIcEmail}`,
    ],
  });
  const trustorColumn = buildContactColumn({
    heading: "ЗАКАЗЧИК",
    x: PAGE4_LAYOUT.trustorColumn.x,
    y: PAGE4_LAYOUT.trustorColumn.y,
    width: PAGE4_LAYOUT.trustorColumn.width,
    lines: [
      "Гражданин штата Сан-Андреас",
      fields.trustorFullName,
      "Номер паспорта:",
      fields.trustorPassportNumber,
      `Контактный телефон: ${fields.trustorPhone}`,
      `E-mail: ${fields.trustorIcEmail}`,
    ],
  });

  return buildPageBase({
    overlays: [
      topBlock.svg,
      buildTextBlock({
        text: "8. Реквизиты и подписи сторон",
        x: 0,
        y: PAGE4_LAYOUT.sectionTitle.y,
        width: PAGE_WIDTH,
        fontSize: PAGE4_LAYOUT.sectionTitle.size,
        lineHeight: PAGE4_LAYOUT.sectionTitle.lineHeight,
        fontWeight: 700,
        textAlign: "center",
      }),
      executorColumn.svg,
      trustorColumn.svg,
      `<line x1="${PAGE4_LAYOUT.signatureLines.leftX1}" y1="${PAGE4_LAYOUT.signatureLines.y}" x2="${PAGE4_LAYOUT.signatureLines.leftX2}" y2="${PAGE4_LAYOUT.signatureLines.y}" stroke="#7a7a7a" stroke-width="1" />`,
      `<line x1="${PAGE4_LAYOUT.signatureLines.rightX1}" y1="${PAGE4_LAYOUT.signatureLines.y}" x2="${PAGE4_LAYOUT.signatureLines.rightX2}" y2="${PAGE4_LAYOUT.signatureLines.y}" stroke="#7a7a7a" stroke-width="1" />`,
      buildTextBlock({
        text: fields.executorFullName,
        x: PAGE4_LAYOUT.signerNames.leftX,
        y: PAGE4_LAYOUT.signerNames.y,
        width: PAGE4_LAYOUT.signerNames.width,
        fontSize: PAGE4_LAYOUT.signerNames.size,
        lineHeight: PAGE4_LAYOUT.signerNames.lineHeight,
        fontFamily: SERIF_FONT_FAMILY,
        fontWeight: 700,
        textAlign: "left",
      }),
      buildTextBlock({
        text: fields.trustorFullName,
        x: PAGE4_LAYOUT.signerNames.rightX,
        y: PAGE4_LAYOUT.signerNames.y,
        width: PAGE4_LAYOUT.signerNames.width,
        fontSize: PAGE4_LAYOUT.signerNames.size,
        lineHeight: PAGE4_LAYOUT.signerNames.lineHeight,
        fontFamily: SERIF_FONT_FAMILY,
        fontWeight: 700,
        textAlign: "left",
      }),
      buildSignatureText({
        fullName: fields.executorFullName,
        x: PAGE4_LAYOUT.signatureGlyphs.leftX,
        y: PAGE4_LAYOUT.signatureGlyphs.y,
        width: PAGE4_LAYOUT.signatureGlyphs.width,
        fontSize: PAGE4_LAYOUT.signatureGlyphs.size,
      }),
      buildSignatureText({
        fullName: fields.trustorFullName,
        x: PAGE4_LAYOUT.signatureGlyphs.rightX,
        y: PAGE4_LAYOUT.signatureGlyphs.y,
        width: PAGE4_LAYOUT.signatureGlyphs.width,
        fontSize: PAGE4_LAYOUT.signatureGlyphs.size,
      }),
      buildTextBlock({
        text: "Name and signature",
        x: PAGE4_LAYOUT.signatureHints.leftX,
        y: PAGE4_LAYOUT.signatureHints.y,
        width: PAGE4_LAYOUT.signatureHints.width,
        fontSize: PAGE4_LAYOUT.signatureHints.size,
        lineHeight: PAGE4_LAYOUT.signatureHints.lineHeight,
        fontStyle: "italic",
      }),
      buildTextBlock({
        text: "Name and signature",
        x: PAGE4_LAYOUT.signatureHints.rightX,
        y: PAGE4_LAYOUT.signatureHints.y,
        width: PAGE4_LAYOUT.signatureHints.width,
        fontSize: PAGE4_LAYOUT.signatureHints.size,
        lineHeight: PAGE4_LAYOUT.signatureHints.lineHeight,
        fontStyle: "italic",
      }),
    ],
  });
}

function buildPage5() {
  return buildPageBase({
    overlays: [],
  });
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

  if (qrDataUrl === null) {
    reasons.push("Статический QR-asset договора недоступен.");
  }

  return reasons;
}

export async function renderLegalServicesAgreementArtifact(input: {
  title: string;
  authorSnapshot: DocumentAuthorSnapshot;
  payload: LegalServicesAgreementDraftPayload;
}): Promise<LegalServicesAgreementRenderedArtifact> {
  const blockingReasons = validateLegalServicesAgreementForGeneration(input);

  if (signatureFontDataUrl === null || qrDataUrl === null) {
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
    buildPage1(input),
    buildPage2({ payload: input.payload }),
    buildPage3({ payload: input.payload }),
    buildPage4(input),
    buildPage5(),
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
