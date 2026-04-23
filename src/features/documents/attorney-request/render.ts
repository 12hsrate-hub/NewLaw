import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import QRCode from "qrcode";
import sharp from "sharp";

import { attorneyRequestAddresseePresets } from "@/features/documents/attorney-request/presets";
import {
  ATTORNEY_REQUEST_OUTPUT_FORMAT,
  ATTORNEY_REQUEST_RENDERER_VERSION,
} from "@/features/documents/attorney-request/types";
import type { AttorneyRequestDraftPayload } from "@/features/documents/attorney-request/schemas";
import type { DocumentAuthorSnapshot } from "@/schemas/document";

const PX_PER_MM = 96 / 25.4;
const mm = (value: number) => value * PX_PER_MM;
const pt = (value: number) => value;
const PAGE_WIDTH = Math.round(210 * PX_PER_MM);
const PAGE_HEIGHT = Math.round(297 * PX_PER_MM);
const MAX_BODY_Y = 900;

const rasterConfig = {
  exportScale: 2,
  jpegQuality: 98,
  chromaSubsampling: "4:4:4" as const,
  qrSourceScale: 4,
  sharpenSigma: 0.35,
  pngCompressionLevel: 9,
} as const;

const qrConfig = {
  targetUrl: "https://gov-blackberry.bubbleapps.io/",
  darkColor: "#5e6fb2",
  lightColor: "#ffffff",
} as const;

const RASTER_SCALE = rasterConfig.exportScale;

const fontConfig = {
  textFamily: "Times New Roman, Liberation Serif, serif",
  monoFamily: "Courier New, Liberation Mono, monospace",
  bodyRegularSize: pt(12.3),
  bodyBoldSize: pt(12.3),
  bodyLineHeight: pt(17.12),
  sectionHeadingSize: pt(11.9),
  introSize: pt(11.82),
  introLineHeight: pt(16.02),
  titleSize: pt(12.46),
  registerTitleSize: pt(11.92),
  registerBodySize: pt(11.32),
  stateTitleSize: pt(21),
  associationTitleSize: pt(15),
  footerRoleSize: pt(12),
  footerCenterTitleSize: pt(12.85),
  footerCenterDateSize: pt(11.8),
  footerNameSize: pt(12.45),
  stampSize: pt(10.7),
} as const;

const layoutConfig = {
  pagePadding: {
    top: mm(10),
    right: mm(16),
    bottom: mm(12),
    left: mm(16),
  },
  registerWidth: mm(46),
  leftRoleWidth: mm(17.7),
  columnGap: mm(0.8),
  contentStartY: 198,
  contentDividerY: 178,
  contentLeftX: mm(33.7),
  contentRightX: PAGE_WIDTH - mm(13.5),
  sectionGap: mm(5.2),
} as const;

const headerConfig = {
  sealSize: mm(12.8),
  sealY: mm(3.2),
  topLineY: 57,
  secondLineY: 61.5,
  stateTitleY: 84.5,
  associationTitleY: 107.5,
  registerY: 133,
} as const;

const footerConfig = {
  topY: 924,
  signatureY: 824,
  signatureWidth: mm(35),
  signatureHeight: mm(38),
  leftRoleWidth: mm(24),
  centerTopY: 1008,
  centerTitleY: 1020,
  centerDateY: 1041,
  qrY: 1008,
  qrSize: mm(20),
} as const;

const registerBlockConfig = {
  x: layoutConfig.pagePadding.left,
  width: layoutConfig.registerWidth,
  titleLineHeight: fontConfig.registerTitleSize * 0.94,
  bodyLineHeight: fontConfig.registerBodySize * 0.98,
  registerToDividerGap: mm(1.45),
} as const;

const leftRoleBlockConfig = {
  x: layoutConfig.pagePadding.left,
  width: layoutConfig.leftRoleWidth,
  titleY: layoutConfig.contentStartY,
  roleY: layoutConfig.contentStartY + pt(29.6),
  roleLineGap: pt(17.8),
} as const;

const titleBlockConfig = {
  x: layoutConfig.contentLeftX,
  width: layoutConfig.contentRightX - layoutConfig.contentLeftX,
  titleY: layoutConfig.contentStartY,
  subtitleGap: pt(14.9),
  subtitleToIntroGap: pt(15.1),
} as const;

const introBlockConfig = {
  x: titleBlockConfig.x,
  width: titleBlockConfig.width,
  lineHeight: fontConfig.introLineHeight,
} as const;

const sectionBlockConfig = {
  x: titleBlockConfig.x,
  width: titleBlockConfig.width,
  introToSection1Gap: mm(5.25),
  baseGap: mm(5.6),
  maxExtraGapPerSection: mm(8),
  itemMarkerGap: 2.8,
  itemTextIndent: 14.2,
  itemLineHeight: pt(16.85),
} as const;

const stampConfig = {
  topY: 1008,
  lineHeight: 12.2,
  letterSpacing: 0.32,
} as const;

const assetConfig = {
  sealDataUrl: readLocalAssetDataUrl(
    "src/features/documents/attorney-request/assets/department-of-justice-seal-reference.jpg",
    "image/jpeg",
  ),
  signatureDataUrl: null as string | null,
} as const;

const visualReferenceConfig = {
  referenceName: "attorney_request_1703",
  knownGaps: [
    "Оригинальный asset подписи отсутствует: используется replace-ready векторная имитация.",
    "Точный stamp-font эталона неизвестен: используется Courier/Liberation Mono approximation.",
    "Raster export keeps a generated-output-first calibration and uses a higher-quality JPEG pipeline within the current A4 contract.",
    "PNG export is included as a higher-fidelity alternative to JPG for manual comparison and download.",
    "Section spacing can stretch slightly when the body block leaves too much vertical room above the footer.",
  ],
  header: headerConfig,
  layout: layoutConfig,
  fonts: fontConfig,
  footer: footerConfig,
  stamp: stampConfig,
  assets: assetConfig,
  raster: rasterConfig,
} as const;

type SvgSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  dx?: number;
};

type SvgLine = {
  text?: string;
  segments?: SvgSegment[];
  bold?: boolean;
  italic?: boolean;
  x?: number;
  y?: number;
  size?: number;
  anchor?: "start" | "middle" | "end";
  family?: string;
};

type RenderedBlock = {
  lines: SvgLine[];
  topY: number;
  bottomY: number;
  height: number;
};

export class AttorneyRequestGenerationBlockedError extends Error {
  constructor(public readonly reasons: string[]) {
    super("Адвокатский запрос не готов к генерации.");
    this.name = "AttorneyRequestGenerationBlockedError";
  }
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function escapeXml(input: string) {
  return escapeHtml(input).replaceAll("'", "&apos;");
}

function makeDataUrl(mediaType: string, content: Buffer) {
  return `data:${mediaType};base64,${content.toString("base64")}`;
}

function readLocalAssetDataUrl(relativePath: string, mediaType: string) {
  const assetPath = join(process.cwd(), relativePath);

  if (!existsSync(assetPath)) {
    return null;
  }

  return makeDataUrl(mediaType, readFileSync(assetPath));
}

function getRequestDigits(requestNumber: string) {
  return requestNumber.replace(/\D/g, "");
}

function parseDocumentDateLabel(dateLabel: string) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateLabel.trim());

  if (!match) {
    return null;
  }

  return {
    day: Number(match[1]),
    month: Number(match[2]),
    year: Number(match[3]),
  };
}

function formatRegisterDate(dateLabel: string) {
  const parsed = parseDocumentDateLabel(dateLabel);

  if (!parsed) {
    return dateLabel;
  }

  const monthNames = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];

  return `${monthNames[parsed.month - 1] ?? ""} ${parsed.day}, ${parsed.year}`;
}

function formatFiledDate(dateLabel: string) {
  const parsed = parseDocumentDateLabel(dateLabel);

  if (!parsed) {
    return dateLabel;
  }

  return `${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}-${String(parsed.year).slice(-2)}.`;
}

function formatMskDateTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(iso));
}

function buildSection2(payload: AttorneyRequestDraftPayload) {
  return `Согласно статье 5 закона "Об адвокатуре и адвокатской деятельности в штате Сан-Андреас" срок ответа на текущий запрос составляет 1 день, в срок до ${formatMskDateTime(payload.responseDueAtMsk)}. Отказ в предоставлении сведений предусматривается только в случаях, предусмотренных законом.`;
}

function buildSection4() {
  return "Настоящий запрос вступает в законную силу с момента его публикации.";
}

function buildSection1Intro(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
}) {
  const trustorName = input.payload.trustorSnapshot.fullName;
  const contactEmail = input.payload.trustorSnapshot.icEmail || input.authorSnapshot.icEmail;

  return `На основании заключенного договора ${input.payload.contractNumber} об оказании юридической помощи гр-ну ${trustorName} Настоящим адвокатским запросом требую предоставить ${input.authorSnapshot.fullName} используя систему меж. структурной связи либо на электронную почту ${contactEmail} информацию указанную далее:`;
}

function formatFooterName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return fullName;
  }

  return [parts[0], ...parts.slice(1).map((part) => part.toLocaleUpperCase("ru-RU"))].join(" ");
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

function wrapText(input: string, width: number, size = fontConfig.bodyRegularSize) {
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

function wrapTextWithFirstWidth(input: string, firstWidth: number, restWidth: number, size = fontConfig.bodyRegularSize) {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let width = firstWidth;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (estimateTextWidth(candidate, size) <= width) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      width = restWidth;
      continue;
    }

    lines.push(word);
    width = restWidth;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function pushWrappedLines(input: {
  lines: SvgLine[];
  text: string;
  x: number;
  y: number;
  width: number;
  size?: number;
  lineHeight?: number;
  bold?: boolean;
  italic?: boolean;
  family?: string;
}) {
  const size = input.size ?? fontConfig.bodyRegularSize;
  const lineHeight = input.lineHeight ?? fontConfig.bodyLineHeight;
  let y = input.y;

  for (const text of wrapText(input.text, input.width, size)) {
    input.lines.push({
      text,
      x: input.x,
      y,
      size,
      bold: input.bold,
      italic: input.italic,
      family: input.family,
    });
    y += lineHeight;
  }

  return y;
}

function getLineBottomY(line: SvgLine) {
  return (line.y ?? 0) + Math.max((line.size ?? fontConfig.bodyRegularSize) * 0.38, 2);
}

function finalizeBlock(lines: SvgLine[], topY: number): RenderedBlock {
  const bottomY = lines.length > 0 ? Math.max(...lines.map(getLineBottomY)) : topY;

  return {
    lines,
    topY,
    bottomY,
    height: Math.max(0, bottomY - topY),
  };
}

function shiftBlock(block: RenderedBlock, offsetY: number) {
  if (offsetY === 0) {
    return block;
  }

  return {
    ...block,
    topY: block.topY + offsetY,
    bottomY: block.bottomY + offsetY,
    lines: block.lines.map((line) => ({
      ...line,
      y: (line.y ?? 0) + offsetY,
    })),
  };
}

function anchorBlockToBottomGap(block: RenderedBlock, bottomY: number, gap: number) {
  return shiftBlock(block, bottomY - gap - block.bottomY);
}

function pushInlineSectionParagraph(input: {
  lines: SvgLine[];
  label: string;
  descriptor: string;
  text: string;
  x: number;
  y: number;
  width: number;
}) {
  const size = fontConfig.sectionHeadingSize;
  const labelText = `${input.label} `;
  const descriptorText = input.descriptor;
  const prefixWidth = estimateTextWidth(`${labelText}${descriptorText} `, size) + 5;
  const wrapped = wrapTextWithFirstWidth(input.text, Math.max(80, input.width - prefixWidth), input.width, size);
  const firstLine = wrapped[0] ?? "";

  input.lines.push({
    segments: [
      {
        text: labelText,
        bold: true,
      },
      {
        text: descriptorText,
        italic: true,
      },
      {
        text: firstLine,
        dx: 5,
      },
    ],
    x: input.x,
    y: input.y,
    size,
  });

  let y = input.y + fontConfig.bodyLineHeight;

  for (const line of wrapped.slice(1)) {
    input.lines.push({
      text: line,
      x: input.x,
      y,
      size,
    });
    y += fontConfig.bodyLineHeight;
  }

  return y;
}

function pushNumberedItem(input: {
  lines: SvgLine[];
  marker: string;
  text: string;
  x: number;
  y: number;
  width: number;
}) {
  const markerWidth = sectionBlockConfig.itemTextIndent;
  const markerAdvance = Math.max(
    sectionBlockConfig.itemMarkerGap,
    markerWidth - estimateTextWidth(input.marker, fontConfig.bodyRegularSize),
  );
  const wrapped = wrapText(input.text, Math.max(80, input.width - markerWidth), fontConfig.bodyRegularSize);
  let y = input.y;

  if (wrapped.length === 0) {
    input.lines.push({
      text: input.marker,
      x: input.x,
      y,
      size: fontConfig.bodyRegularSize,
    });

    return y + sectionBlockConfig.itemLineHeight;
  }

  input.lines.push({
    segments: [
      {
        text: input.marker,
      },
      {
        text: wrapped[0] ?? "",
        dx: markerAdvance,
      },
    ],
    x: input.x,
    y,
    size: fontConfig.bodyRegularSize,
  });
  y += sectionBlockConfig.itemLineHeight;

  for (const line of wrapped.slice(1)) {
    input.lines.push({
      text: line,
      x: input.x + markerWidth,
      y,
      size: fontConfig.bodyRegularSize,
    });
    y += sectionBlockConfig.itemLineHeight;
  }

  return y;
}

function renderLine(line: SvgLine) {
  const content =
    line.segments
      ?.map((segment) => {
        const weight = segment.bold ? ' font-weight="700"' : "";
        const style = segment.italic ? ' font-style="italic"' : "";
        const dx = typeof segment.dx === "number" ? ` dx="${segment.dx}"` : "";

        return `<tspan${dx}${weight}${style}>${escapeXml(segment.text)}</tspan>`;
      })
      .join("") ?? escapeXml(line.text ?? "");

  return `<text x="${line.x ?? layoutConfig.pagePadding.left}" y="${line.y ?? layoutConfig.pagePadding.top}" font-family="${line.family ?? fontConfig.textFamily}" font-size="${line.size ?? fontConfig.bodyRegularSize}"${line.bold ? ' font-weight="700"' : ""}${line.italic ? ' font-style="italic"' : ""}${line.anchor ? ` text-anchor="${line.anchor}"` : ""} xml:space="preserve">${content}</text>`;
}

function buildPreviewText(input: {
  title: string;
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
}) {
  const addressee = input.payload.addresseePreset
    ? attorneyRequestAddresseePresets[input.payload.addresseePreset].label
    : "Адресат не выбран";
  const signerTitle = input.payload.signerTitleSnapshot;

  return [
    `STATE OF SAN ANDREAS / BAR ASSOCIATION`,
    `San Andreas Register No. ${input.payload.requestNumberNormalized || input.payload.requestNumberRawInput}`,
    `Title 1 — Адвокатский запрос от ${formatRegisterDate(input.payload.documentDateMsk)}.`,
    `Кому: ${addressee}`,
    `От: ${input.authorSnapshot.fullName}, ${signerTitle?.bodyRu ?? input.authorSnapshot.position}`,
    `Доверитель: ${input.payload.trustorSnapshot.fullName}, паспорт ${input.payload.trustorSnapshot.passportNumber}`,
    "",
    `Section 1. Резолюция. ${buildSection1Intro(input)}`,
    ...input.payload.section1Items.map((item) => `${item.id}. ${item.text}`),
    "",
    `Section 2. Срок исполнения, причины отказа. ${buildSection2(input.payload)}`,
    "",
    `Section 3. Ответственность. ${input.payload.section3Text}`,
    "",
    `Section 4. Вступление в силу. ${buildSection4()}`,
    "",
    `${signerTitle?.footerRu ?? input.authorSnapshot.position}: ${input.authorSnapshot.fullName}`,
  ].join("\n");
}

async function buildQrDataUrl() {
  return QRCode.toDataURL(qrConfig.targetUrl, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: Math.round(footerConfig.qrSize * rasterConfig.qrSourceScale),
    color: {
      dark: qrConfig.darkColor,
      light: qrConfig.lightColor,
    },
  });
}

function buildSealSvg() {
  const x = layoutConfig.pagePadding.left;
  const y = headerConfig.sealY;
  const size = headerConfig.sealSize;
  const cx = x + size / 2;
  const cy = y + size / 2;

  if (assetConfig.sealDataUrl) {
    return `<image data-asset-slot="attorney-request-seal" href="${assetConfig.sealDataUrl}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return `<g data-asset-slot="attorney-request-seal" opacity="0.88">
    <circle cx="${cx}" cy="${cy}" r="${size / 2 - 1.3}" fill="#ebe7df" stroke="#242424" stroke-width="1.15"/>
    <circle cx="${cx}" cy="${cy}" r="${size / 2 - 4.2}" fill="#f8f6ef" stroke="#5f6470" stroke-width="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="${size / 2 - 8.2}" fill="none" stroke="#8a6f4d" stroke-width="0.7"/>
    <path d="M${cx - 9} ${cy - 1} C${cx - 4} ${cy - 8}, ${cx + 5} ${cy - 8}, ${cx + 9} ${cy - 1}" fill="none" stroke="#4b5563" stroke-width="0.8"/>
    <path d="M${cx - 7} ${cy + 4} C${cx - 2} ${cy + 8}, ${cx + 5} ${cy + 8}, ${cx + 8} ${cy + 3}" fill="none" stroke="#4b5563" stroke-width="0.8"/>
    <text x="${cx}" y="${cy - 1}" font-family="${fontConfig.textFamily}" font-size="5.6" font-weight="700" text-anchor="middle">BA</text>
  </g>`;
}

function buildSignatureSvg() {
  const width = footerConfig.signatureWidth;
  const height = footerConfig.signatureHeight;
  const x = PAGE_WIDTH / 2 - width / 2;
  const y = footerConfig.signatureY;

  if (assetConfig.signatureDataUrl) {
    return `<image data-asset-slot="attorney-request-signature" href="${assetConfig.signatureDataUrl}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return `<g data-asset-slot="attorney-request-signature" transform="translate(${x} ${y})" fill="none" stroke="#101010" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
    <ellipse cx="${width * 0.47}" cy="${height * 0.52}" rx="${width * 0.34}" ry="${height * 0.43}" transform="rotate(-18 ${width * 0.47} ${height * 0.52})"/>
    <path d="M${width * 0.18} ${height * 0.64} C${width * 0.28} ${height * 0.31}, ${width * 0.42} ${height * 0.78}, ${width * 0.53} ${height * 0.33} C${width * 0.58} ${height * 0.1}, ${width * 0.62} ${height * 0.77}, ${width * 0.7} ${height * 0.32} C${width * 0.74} ${height * 0.12}, ${width * 0.79} ${height * 0.68}, ${width * 0.87} ${height * 0.42}"/>
    <path d="M${width * 0.2} ${height * 0.66} C${width * 0.37} ${height * 0.58}, ${width * 0.58} ${height * 0.46}, ${width * 0.87} ${height * 0.22}"/>
    <path d="M${width * 0.32} ${height * 0.78} C${width * 0.52} ${height * 0.86}, ${width * 0.77} ${height * 0.81}, ${width * 0.96} ${height * 0.66}"/>
  </g>`;
}

function buildHeaderLines() {
  const left = layoutConfig.pagePadding.left;
  const right = PAGE_WIDTH - layoutConfig.pagePadding.right;
  const center = PAGE_WIDTH / 2;

  return `<line x1="${left}" y1="${headerConfig.topLineY}" x2="${right}" y2="${headerConfig.topLineY}" stroke="#111" stroke-width="2"/>
  <line x1="${left}" y1="${headerConfig.secondLineY}" x2="${right}" y2="${headerConfig.secondLineY}" stroke="#111" stroke-width="1"/>
  <text x="${center}" y="${headerConfig.stateTitleY}" font-family="${fontConfig.textFamily}" font-size="${fontConfig.stateTitleSize}" font-weight="700" text-anchor="middle">STATE OF SAN ANDREAS</text>
  <text x="${center}" y="${headerConfig.associationTitleY}" font-family="${fontConfig.textFamily}" font-size="${fontConfig.associationTitleSize}" font-weight="400" text-anchor="middle">BAR ASSOCIATION</text>`;
}

function buildFooter(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
  qrDataUrl: string;
}) {
  const signerTitle = input.payload.signerTitleSnapshot;
  const requestDigits = getRequestDigits(input.payload.requestNumberNormalized);
  const parsedDate = parseDocumentDateLabel(input.payload.documentDateMsk);
  const stampYear = parsedDate?.year ?? new Date().getFullYear();
  const footerTopY = footerConfig.topY;
  const footerRoleSize = fontConfig.footerRoleSize;
  const footerLineHeight = footerRoleSize * 1.22;
  const leftRoleLines = wrapText(signerTitle?.footerRu ?? input.authorSnapshot.position, footerConfig.leftRoleWidth, footerRoleSize)
    .map((line, index) => `<text x="${layoutConfig.pagePadding.left}" y="${footerTopY + index * footerLineHeight}" font-family="${fontConfig.textFamily}" font-size="${footerRoleSize}">${escapeXml(line)}</text>`)
    .join("");
  const filedDate = formatFiledDate(input.payload.documentDateMsk);
  const stampLines = [
    `[SAR Doc. ${stampYear}-${requestDigits || "0000"}`,
    `Filed ${filedDate}]`,
  ];

  return `<g>
    ${buildSignatureSvg()}
    ${leftRoleLines}
    <text x="${PAGE_WIDTH - layoutConfig.pagePadding.right}" y="${footerTopY}" font-family="${fontConfig.textFamily}" font-size="${fontConfig.footerNameSize}" text-anchor="end">${escapeXml(formatFooterName(input.authorSnapshot.fullName))}</text>
    ${stampLines
      .map(
        (line, index) =>
          `<text x="${layoutConfig.pagePadding.left}" y="${stampConfig.topY + fontConfig.stampSize + index * stampConfig.lineHeight}" font-family="${fontConfig.monoFamily}" font-size="${fontConfig.stampSize}" font-weight="600" letter-spacing="${stampConfig.letterSpacing}" xml:space="preserve">${escapeXml(line)}</text>`,
      )
      .join("")}
    <text x="${PAGE_WIDTH / 2}" y="${footerConfig.centerTitleY}" font-family="${fontConfig.textFamily}" font-size="${fontConfig.footerCenterTitleSize}" text-anchor="middle">SAN ANDREAS CAPITOL</text>
    <text x="${PAGE_WIDTH / 2}" y="${footerConfig.centerDateY}" font-family="${fontConfig.textFamily}" font-size="${fontConfig.footerCenterDateSize}" font-style="italic" text-anchor="middle">${escapeXml(formatRegisterDate(input.payload.documentDateMsk))}</text>
    <image href="${input.qrDataUrl}" x="${PAGE_WIDTH - layoutConfig.pagePadding.right - footerConfig.qrSize}" y="${footerConfig.qrY}" width="${footerConfig.qrSize}" height="${footerConfig.qrSize}"/>
  </g>`;
}

function buildRegisterBlock(input: {
  requestNumberNormalized: string;
  titleDate: string;
}) {
  const lines: SvgLine[] = [];
  let y = 0;

  y = pushWrappedLines({
    lines,
    text: "San Andreas Register",
    x: registerBlockConfig.x,
    y,
    width: registerBlockConfig.width,
    size: fontConfig.registerTitleSize,
    lineHeight: registerBlockConfig.titleLineHeight,
    bold: true,
  });
  lines.push({
    text: `No. ${input.requestNumberNormalized}`,
    x: registerBlockConfig.x,
    y,
    size: fontConfig.registerBodySize,
  });
  y += registerBlockConfig.bodyLineHeight;
  lines.push({
    text: input.titleDate,
    x: registerBlockConfig.x,
    y,
    size: fontConfig.registerBodySize,
  });

  return anchorBlockToBottomGap(
    finalizeBlock(lines, 0),
    layoutConfig.contentDividerY,
    registerBlockConfig.registerToDividerGap,
  );
}

function buildLeftRoleBlock(leftRole: string) {
  const lines: SvgLine[] = [
    {
      text: "Title 1 —",
      x: leftRoleBlockConfig.x,
      y: leftRoleBlockConfig.titleY,
      size: fontConfig.titleSize,
      bold: true,
    },
  ];

  let y = leftRoleBlockConfig.roleY;

  for (const roleLine of wrapText(leftRole, leftRoleBlockConfig.width, fontConfig.titleSize)) {
    lines.push({
      text: roleLine,
      x: leftRoleBlockConfig.x,
      y,
      size: fontConfig.titleSize,
      bold: true,
    });
    y += leftRoleBlockConfig.roleLineGap;
  }

  return finalizeBlock(lines, leftRoleBlockConfig.titleY);
}

function buildTitleBlock(titleDate: string) {
  const lines: SvgLine[] = [
    {
      text: `Адвокатский запрос от ${titleDate}.`,
      x: titleBlockConfig.x,
      y: titleBlockConfig.titleY,
      size: fontConfig.titleSize,
      bold: true,
    },
    {
      text: "О предоставлении запрашиваемой информации",
      x: titleBlockConfig.x,
      y: titleBlockConfig.titleY + titleBlockConfig.subtitleGap,
      size: fontConfig.titleSize,
      bold: true,
    },
  ];

  return finalizeBlock(lines, titleBlockConfig.titleY);
}

function buildIntroBlock(input: {
  topY: number;
  intro: string;
}) {
  const lines: SvgLine[] = [];

  pushWrappedLines({
    lines,
    text: input.intro,
    x: introBlockConfig.x,
    y: input.topY,
    width: introBlockConfig.width,
    size: fontConfig.introSize,
    lineHeight: introBlockConfig.lineHeight,
    bold: true,
  });

  return finalizeBlock(lines, input.topY);
}

function buildSectionParagraphBlock(input: {
  label: string;
  subtitle: string;
  text: string;
  topY: number;
}) {
  const lines: SvgLine[] = [];

  pushInlineSectionParagraph({
    lines,
    label: input.label,
    descriptor: input.subtitle,
    text: input.text,
    x: sectionBlockConfig.x,
    y: input.topY,
    width: sectionBlockConfig.width,
  });

  return finalizeBlock(lines, input.topY);
}

function buildSection1Block(input: {
  topY: number;
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
}) {
  const lines: SvgLine[] = [];
  let y = pushInlineSectionParagraph({
    lines,
    label: "Section 1.",
    descriptor: "Резолюция.",
    text: buildSection1Intro(input),
    x: sectionBlockConfig.x,
    y: input.topY,
    width: sectionBlockConfig.width,
  });

  for (const item of input.payload.section1Items) {
    y = pushNumberedItem({
      lines,
      marker: `${item.id}.`,
      text: item.text,
      x: sectionBlockConfig.x,
      y,
      width: sectionBlockConfig.width,
    });
  }

  return finalizeBlock(lines, input.topY);
}

function buildVisualLines(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
}) {
  const signerTitle = input.payload.signerTitleSnapshot;
  const titleDate = formatRegisterDate(input.payload.documentDateMsk);
  const leftRole = signerTitle?.leftColumnEn ?? input.authorSnapshot.position;
  const intro = `Я, действующий ${signerTitle?.bodyRu ?? input.authorSnapshot.position} ${input.authorSnapshot.fullName}, руководствуясь действующей Конституцией Штата Сан-Андреас, а также другими нормативно-правовыми актами Штата Сан-Андреас, заявляю:`;
  const registerBlock = buildRegisterBlock({
    requestNumberNormalized: input.payload.requestNumberNormalized,
    titleDate,
  });
  const leftRoleBlock = buildLeftRoleBlock(leftRole);
  const titleBlock = buildTitleBlock(titleDate);
  const introBlock = buildIntroBlock({
    topY: titleBlock.bottomY + titleBlockConfig.subtitleToIntroGap,
    intro,
  });

  const rawSectionBlocks = [
    buildSection1Block({
      topY: introBlock.bottomY + sectionBlockConfig.introToSection1Gap,
      authorSnapshot: input.authorSnapshot,
      payload: input.payload,
    }),
    buildSectionParagraphBlock({
      label: "Section 2.",
      subtitle: "Срок исполнения, причины отказа.",
      text: buildSection2(input.payload),
      topY: 0,
    }),
    buildSectionParagraphBlock({
      label: "Section 3.",
      subtitle: "Ответственность.",
      text: input.payload.section3Text,
      topY: 0,
    }),
    buildSectionParagraphBlock({
      label: "Section 4.",
      subtitle: "Вступление в силу.",
      text: buildSection4(),
      topY: 0,
    }),
  ];

  rawSectionBlocks[1] = shiftBlock(
    rawSectionBlocks[1],
    rawSectionBlocks[0].bottomY + sectionBlockConfig.baseGap - rawSectionBlocks[1].topY,
  );
  rawSectionBlocks[2] = shiftBlock(
    rawSectionBlocks[2],
    rawSectionBlocks[1].bottomY + sectionBlockConfig.baseGap - rawSectionBlocks[2].topY,
  );
  rawSectionBlocks[3] = shiftBlock(
    rawSectionBlocks[3],
    rawSectionBlocks[2].bottomY + sectionBlockConfig.baseGap - rawSectionBlocks[3].topY,
  );

  const footerClearanceTargetY = footerConfig.signatureY - mm(1.2);
  const availableStretch = Math.max(0, footerClearanceTargetY - rawSectionBlocks[3].bottomY);
  const extraPerGap =
    rawSectionBlocks.length > 1
      ? Math.min(sectionBlockConfig.maxExtraGapPerSection, availableStretch / (rawSectionBlocks.length - 1))
      : 0;
  const sectionBlocks = rawSectionBlocks.map((block, index) => shiftBlock(block, extraPerGap * index));
  const lines = [
    ...registerBlock.lines,
    ...leftRoleBlock.lines,
    ...titleBlock.lines,
    ...introBlock.lines,
    ...sectionBlocks.flatMap((block) => block.lines),
  ].sort((leftLine, rightLine) => {
    const yDiff = (leftLine.y ?? 0) - (rightLine.y ?? 0);

    if (yDiff !== 0) {
      return yDiff;
    }

    return (leftLine.x ?? 0) - (rightLine.x ?? 0);
  });

  return {
    lines,
    contentBottomY: Math.max(introBlock.bottomY, ...sectionBlocks.map((block) => block.bottomY)),
  };
}

async function buildPageSvg(input: {
  title: string;
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
}) {
  const qrDataUrl = await buildQrDataUrl();
  const { lines, contentBottomY } = buildVisualLines(input);
  const pageBackground = `<rect width="100%" height="100%" fill="#ffffff"/>`;
  const contentLine = `<line x1="${layoutConfig.pagePadding.left}" y1="${layoutConfig.contentDividerY}" x2="${PAGE_WIDTH - layoutConfig.pagePadding.right}" y2="${layoutConfig.contentDividerY}" stroke="#111" stroke-width="2"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}" data-visual-reference="${visualReferenceConfig.referenceName}">
    ${pageBackground}
    ${buildSealSvg()}
    ${buildHeaderLines()}
    ${contentLine}
    ${lines.map(renderLine).join("\n")}
    ${buildFooter({
      authorSnapshot: input.authorSnapshot,
      payload: input.payload,
      qrDataUrl,
    })}
  </svg>`;

  return {
    svg,
    contentBottomY,
  };
}

function buildPreviewHtml(input: {
  title: string;
  pageSvg: string;
}) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    body { margin: 0; background: #f8f5ef; }
    .preview-shell { display: flex; justify-content: center; padding: 24px; }
    .page { width: min(100%, ${PAGE_WIDTH}px); box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16); background: #fff; }
    .page svg { display: block; width: 100%; height: auto; }
  </style>
</head>
<body>
  <main class="preview-shell">
    <div class="page">${input.pageSvg}</div>
  </main>
</body>
</html>`;
}

function buildPdfFromJpeg(input: {
  jpeg: Buffer;
  imageWidth: number;
  imageHeight: number;
}) {
  const offsets: number[] = [];
  const chunks: Buffer[] = [];
  const push = (chunk: string | Buffer) => {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "binary") : chunk);
  };
  const currentOffset = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const object = (id: number, body: Array<string | Buffer>) => {
    offsets[id] = currentOffset();
    push(`${id} 0 obj\n`);
    for (const part of body) {
      push(part);
    }
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  object(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  object(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
  object(3, [
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  ]);
  object(4, [
    `<< /Type /XObject /Subtype /Image /Width ${input.imageWidth} /Height ${input.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${input.jpeg.length} >>\nstream\n`,
    input.jpeg,
    "\nendstream",
  ]);
  const content = Buffer.from(`q\n${PAGE_WIDTH} 0 0 ${PAGE_HEIGHT} 0 0 cm\n/Im0 Do\nQ\n`, "binary");
  object(5, [`<< /Length ${content.length} >>\nstream\n`, content, "endstream"]);
  const xrefOffset = currentOffset();

  push("xref\n0 6\n0000000000 65535 f \n");
  for (let index = 1; index <= 5; index += 1) {
    push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return Buffer.concat(chunks);
}

function buildRasterSvg(pageSvg: string) {
  return pageSvg.replace(
    `width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}"`,
    `width="${PAGE_WIDTH * RASTER_SCALE}" height="${PAGE_HEIGHT * RASTER_SCALE}"`,
  );
}

async function buildPdfPngAndJpgDataUrls(pageSvg: string) {
  const raster = sharp(Buffer.from(buildRasterSvg(pageSvg))).sharpen(rasterConfig.sharpenSigma);
  const png = await raster
    .clone()
    .png({
      compressionLevel: rasterConfig.pngCompressionLevel,
      adaptiveFiltering: true,
      palette: false,
    })
    .toBuffer();
  const jpg = await raster
    .clone()
    .jpeg({
      quality: rasterConfig.jpegQuality,
      chromaSubsampling: rasterConfig.chromaSubsampling,
      mozjpeg: true,
    })
    .toBuffer();
  const metadata = await sharp(jpg).metadata();
  const pdf = buildPdfFromJpeg({
    jpeg: jpg,
    imageWidth: metadata.width ?? PAGE_WIDTH * RASTER_SCALE,
    imageHeight: metadata.height ?? PAGE_HEIGHT * RASTER_SCALE,
  });

  return {
    pdfDataUrl: makeDataUrl("application/pdf", pdf),
    pngDataUrl: makeDataUrl("image/png", png),
    jpgDataUrl: makeDataUrl("image/jpeg", jpg),
  };
}

export function validateAttorneyRequestForGeneration(input: {
  payload: AttorneyRequestDraftPayload;
  authorSnapshot: DocumentAuthorSnapshot;
}) {
  const issues: string[] = [];

  if (!input.payload.requestNumberNormalized) issues.push("Укажите номер запроса.");
  if (!input.payload.contractNumber.trim()) issues.push("Укажите номер договора.");
  if (!input.payload.addresseePreset) issues.push("Выберите адресата запроса.");
  if (!input.payload.targetOfficerInput.trim()) issues.push("Укажите сотрудника или нашивку.");
  if (!input.payload.requestDate.trim()) issues.push("Укажите дату, за которую запрашивается информация.");
  if (!input.payload.timeFrom.trim()) issues.push("Укажите время начала периода.");
  if (!input.payload.timeTo.trim()) issues.push("Укажите время окончания периода.");
  if (!input.payload.periodStartAt || !input.payload.periodEndAt) {
    issues.push("Проверьте дату и интервал времени запроса.");
  }
  if (!input.payload.signerTitleSnapshot) {
    issues.push("Укажите должность персонажа для шаблона адвокатского запроса.");
  }
  if (!input.authorSnapshot.fullName || !input.authorSnapshot.position || !input.authorSnapshot.icEmail) {
    issues.push("Заполните ФИО, должность и игровую почту персонажа.");
  }
  if (!input.payload.trustorSnapshot.fullName || !input.payload.trustorSnapshot.passportNumber) {
    issues.push("Заполните ФИО и паспорт доверителя.");
  }
  if (input.payload.section1Items.some((item) => item.text.trim().length === 0)) {
    issues.push("Заполните все три пункта раздела 1.");
  }
  if (!input.payload.section3Text.trim()) {
    issues.push("Заполните раздел 3.");
  }

  return issues;
}

export async function renderAttorneyRequestArtifact(input: {
  title: string;
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
}) {
  const blockingReasons = validateAttorneyRequestForGeneration(input);

  if (blockingReasons.length > 0) {
    throw new AttorneyRequestGenerationBlockedError(blockingReasons);
  }

  const previewText = buildPreviewText(input);
  const { svg: pageSvg, contentBottomY } = await buildPageSvg(input);

  if (contentBottomY > MAX_BODY_Y) {
    throw new AttorneyRequestGenerationBlockedError([
      "Документ не помещается в одну страницу. Сократите редактируемые пункты раздела 1 или раздела 3.",
    ]);
  }

  const previewHtml = buildPreviewHtml({
    title: input.title,
    pageSvg,
  });
  const { pdfDataUrl, pngDataUrl, jpgDataUrl } = await buildPdfPngAndJpgDataUrls(pageSvg);

  return {
    family: "attorney_request" as const,
    format: ATTORNEY_REQUEST_OUTPUT_FORMAT,
    rendererVersion: ATTORNEY_REQUEST_RENDERER_VERSION,
    previewHtml,
    previewText,
    pdfDataUrl,
    pngDataUrl,
    jpgDataUrl,
    pageCount: 1 as const,
    blockingReasons: [],
  };
}
