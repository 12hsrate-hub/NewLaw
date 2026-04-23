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
const PAGE_PADDING_TOP = mm(10);
const PAGE_PADDING_RIGHT = mm(16);
const PAGE_PADDING_BOTTOM = mm(12);
const PAGE_PADDING_LEFT = mm(16);
const BODY_FONT_SIZE = pt(12);
const BODY_LINE_HEIGHT = BODY_FONT_SIZE * 1.45;
const SECTION_GAP = mm(7);
const REGISTER_WIDTH = mm(46);
const LEFT_ROLE_WIDTH = mm(30);
const COLUMN_GAP = mm(4);
const SEAL_SIZE = mm(12);
const SIGNATURE_WIDTH = mm(35);
const SIGNATURE_HEIGHT = mm(36);
const QR_SIZE = mm(20);
const CONTENT_START_Y = 207;
const MAX_BODY_Y = 900;
const TEXT_FONT = "Times New Roman, Liberation Serif, serif";
const MONO_FONT = "Courier New, Liberation Mono, monospace";
const SEAL_ASSET_DATA_URL = readLocalAssetDataUrl(
  "src/features/documents/attorney-request/assets/bar-seal-reference.png",
  "image/png",
);
const SIGNATURE_ASSET_DATA_URL: string | null = null;

type SvgSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
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

  return `${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}-${String(parsed.year).slice(-2)}.1`;
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

function estimateLineChars(width: number, size = BODY_FONT_SIZE) {
  return Math.max(16, Math.floor(width / (size * 0.5)));
}

function wrapText(input: string, width: number, size = BODY_FONT_SIZE) {
  const maxChars = estimateLineChars(width, size);
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

      if (candidate.length <= maxChars) {
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
  const size = input.size ?? BODY_FONT_SIZE;
  const lineHeight = input.lineHeight ?? BODY_LINE_HEIGHT;
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

function pushSectionHeading(input: {
  lines: SvgLine[];
  label: string;
  descriptor: string;
  x: number;
  y: number;
}) {
  input.lines.push({
    segments: [
      {
        text: `${input.label} `,
        bold: true,
      },
      {
        text: input.descriptor,
        italic: true,
      },
    ],
    x: input.x,
    y: input.y,
    size: BODY_FONT_SIZE,
  });

  return input.y + BODY_LINE_HEIGHT;
}

function pushNumberedItem(input: {
  lines: SvgLine[];
  marker: string;
  text: string;
  x: number;
  y: number;
  width: number;
}) {
  const markerWidth = BODY_FONT_SIZE * 1.25;
  const contentWidth = input.width - markerWidth;
  const wrapped = wrapText(input.text, contentWidth);
  let y = input.y;

  for (const [index, text] of wrapped.entries()) {
    input.lines.push({
      text: index === 0 ? `${input.marker} ${text}` : text,
      x: index === 0 ? input.x : input.x + markerWidth,
      y,
      size: BODY_FONT_SIZE,
    });
    y += BODY_LINE_HEIGHT;
  }

  return y;
}

function renderLine(line: SvgLine) {
  const content =
    line.segments
      ?.map((segment) => {
        const weight = segment.bold ? ' font-weight="700"' : "";
        const style = segment.italic ? ' font-style="italic"' : "";

        return `<tspan${weight}${style}>${escapeXml(segment.text)}</tspan>`;
      })
      .join("") ?? escapeXml(line.text ?? "");

  return `<text x="${line.x ?? PAGE_PADDING_LEFT}" y="${line.y ?? PAGE_PADDING_TOP}" font-family="${line.family ?? TEXT_FONT}" font-size="${line.size ?? BODY_FONT_SIZE}"${line.bold ? ' font-weight="700"' : ""}${line.italic ? ' font-style="italic"' : ""}${line.anchor ? ` text-anchor="${line.anchor}"` : ""}>${content}</text>`;
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
    "Section 1. Резолюция.",
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

async function buildQrDataUrl(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
}) {
  const qrPayload = JSON.stringify({
    type: "attorney_request",
    server: input.authorSnapshot.serverCode,
    requestNumber: input.payload.requestNumberNormalized,
    documentDate: input.payload.documentDateMsk,
    characterId: input.authorSnapshot.characterId,
    trustorId: input.payload.trustorSnapshot.trustorId,
  });

  return QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: Math.round(QR_SIZE * 2),
  });
}

function buildSealSvg() {
  const x = PAGE_PADDING_LEFT;
  const y = mm(5.8);
  const cx = x + SEAL_SIZE / 2;
  const cy = y + SEAL_SIZE / 2;

  if (SEAL_ASSET_DATA_URL) {
    return `<image data-asset-slot="attorney-request-seal" href="${SEAL_ASSET_DATA_URL}" x="${x}" y="${y}" width="${SEAL_SIZE}" height="${SEAL_SIZE}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return `<g data-asset-slot="attorney-request-seal" opacity="0.88">
    <circle cx="${cx}" cy="${cy}" r="${SEAL_SIZE / 2 - 1.3}" fill="#ebe7df" stroke="#242424" stroke-width="1.15"/>
    <circle cx="${cx}" cy="${cy}" r="${SEAL_SIZE / 2 - 4.2}" fill="#f8f6ef" stroke="#5f6470" stroke-width="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="${SEAL_SIZE / 2 - 8.2}" fill="none" stroke="#8a6f4d" stroke-width="0.7"/>
    <path d="M${cx - 9} ${cy - 1} C${cx - 4} ${cy - 8}, ${cx + 5} ${cy - 8}, ${cx + 9} ${cy - 1}" fill="none" stroke="#4b5563" stroke-width="0.8"/>
    <path d="M${cx - 7} ${cy + 4} C${cx - 2} ${cy + 8}, ${cx + 5} ${cy + 8}, ${cx + 8} ${cy + 3}" fill="none" stroke="#4b5563" stroke-width="0.8"/>
    <text x="${cx}" y="${cy - 1}" font-family="${TEXT_FONT}" font-size="5.6" font-weight="700" text-anchor="middle">BA</text>
  </g>`;
}

function buildSignatureSvg() {
  const x = PAGE_WIDTH / 2 - SIGNATURE_WIDTH / 2;
  const y = 825;

  if (SIGNATURE_ASSET_DATA_URL) {
    return `<image data-asset-slot="attorney-request-signature" href="${SIGNATURE_ASSET_DATA_URL}" x="${x}" y="${y}" width="${SIGNATURE_WIDTH}" height="${SIGNATURE_HEIGHT}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return `<g data-asset-slot="attorney-request-signature" transform="translate(${x} ${y})" fill="none" stroke="#101010" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
    <ellipse cx="${SIGNATURE_WIDTH * 0.47}" cy="${SIGNATURE_HEIGHT * 0.52}" rx="${SIGNATURE_WIDTH * 0.34}" ry="${SIGNATURE_HEIGHT * 0.43}" transform="rotate(-18 ${SIGNATURE_WIDTH * 0.47} ${SIGNATURE_HEIGHT * 0.52})"/>
    <path d="M${SIGNATURE_WIDTH * 0.18} ${SIGNATURE_HEIGHT * 0.64} C${SIGNATURE_WIDTH * 0.28} ${SIGNATURE_HEIGHT * 0.31}, ${SIGNATURE_WIDTH * 0.42} ${SIGNATURE_HEIGHT * 0.78}, ${SIGNATURE_WIDTH * 0.53} ${SIGNATURE_HEIGHT * 0.33} C${SIGNATURE_WIDTH * 0.58} ${SIGNATURE_HEIGHT * 0.1}, ${SIGNATURE_WIDTH * 0.62} ${SIGNATURE_HEIGHT * 0.77}, ${SIGNATURE_WIDTH * 0.7} ${SIGNATURE_HEIGHT * 0.32} C${SIGNATURE_WIDTH * 0.74} ${SIGNATURE_HEIGHT * 0.12}, ${SIGNATURE_WIDTH * 0.79} ${SIGNATURE_HEIGHT * 0.68}, ${SIGNATURE_WIDTH * 0.87} ${SIGNATURE_HEIGHT * 0.42}"/>
    <path d="M${SIGNATURE_WIDTH * 0.2} ${SIGNATURE_HEIGHT * 0.66} C${SIGNATURE_WIDTH * 0.37} ${SIGNATURE_HEIGHT * 0.58}, ${SIGNATURE_WIDTH * 0.58} ${SIGNATURE_HEIGHT * 0.46}, ${SIGNATURE_WIDTH * 0.87} ${SIGNATURE_HEIGHT * 0.22}"/>
    <path d="M${SIGNATURE_WIDTH * 0.32} ${SIGNATURE_HEIGHT * 0.78} C${SIGNATURE_WIDTH * 0.52} ${SIGNATURE_HEIGHT * 0.86}, ${SIGNATURE_WIDTH * 0.77} ${SIGNATURE_HEIGHT * 0.81}, ${SIGNATURE_WIDTH * 0.96} ${SIGNATURE_HEIGHT * 0.66}"/>
  </g>`;
}

function buildHeaderLines() {
  const left = PAGE_PADDING_LEFT;
  const right = PAGE_WIDTH - PAGE_PADDING_RIGHT;
  const center = PAGE_WIDTH / 2;

  return `<line x1="${left}" y1="65" x2="${right}" y2="65" stroke="#111" stroke-width="2"/>
  <line x1="${left}" y1="70" x2="${right}" y2="70" stroke="#111" stroke-width="1"/>
  <text x="${center}" y="98" font-family="${TEXT_FONT}" font-size="${pt(20)}" font-weight="700" text-anchor="middle">STATE OF SAN ANDREAS</text>
  <text x="${center}" y="124" font-family="${TEXT_FONT}" font-size="${pt(14)}" font-weight="400" text-anchor="middle">BAR ASSOCIATION</text>`;
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
  const footerTopY = 930;
  const footerRoleSize = pt(12);
  const footerLineHeight = footerRoleSize * 1.25;
  const leftRoleLines = wrapText(signerTitle?.footerRu ?? input.authorSnapshot.position, LEFT_ROLE_WIDTH, footerRoleSize)
    .map((line, index) => `<text x="${PAGE_PADDING_LEFT}" y="${footerTopY + index * footerLineHeight}" font-family="${TEXT_FONT}" font-size="${footerRoleSize}">${escapeXml(line)}</text>`)
    .join("");
  const filedDate = formatFiledDate(input.payload.documentDateMsk);
  const stampLines = [
    `|SAI Dec. ${stampYear}-BAR-`,
    requestDigits || "0000",
    `Filed ${filedDate}`,
  ];

  return `<g>
    ${buildSignatureSvg()}
    ${leftRoleLines}
    <text x="${PAGE_WIDTH - PAGE_PADDING_RIGHT}" y="${footerTopY}" font-family="${TEXT_FONT}" font-size="${pt(12)}" text-anchor="end">${escapeXml(input.authorSnapshot.fullName)}</text>
    ${stampLines
      .map(
        (line, index) =>
          `<text x="${PAGE_PADDING_LEFT}" y="${1032 + index * pt(11) * 1.12}" font-family="${MONO_FONT}" font-size="${pt(11)}">${escapeXml(line)}</text>`,
      )
      .join("")}
    <text x="${PAGE_WIDTH / 2}" y="1050" font-family="${TEXT_FONT}" font-size="${pt(13)}" text-anchor="middle">SAN ANDREAS CAPITOL</text>
    <text x="${PAGE_WIDTH / 2}" y="1074" font-family="${TEXT_FONT}" font-size="${pt(12)}" font-style="italic" text-anchor="middle">${escapeXml(formatRegisterDate(input.payload.documentDateMsk))}</text>
    <image href="${input.qrDataUrl}" x="${PAGE_WIDTH - PAGE_PADDING_RIGHT - QR_SIZE}" y="${PAGE_HEIGHT - PAGE_PADDING_BOTTOM - QR_SIZE}" width="${QR_SIZE}" height="${QR_SIZE}"/>
  </g>`;
}

function buildVisualLines(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
}) {
  const lines: SvgLine[] = [];
  const bodyX = PAGE_PADDING_LEFT + LEFT_ROLE_WIDTH + COLUMN_GAP;
  const bodyWidth = PAGE_WIDTH - PAGE_PADDING_RIGHT - bodyX;
  const signerTitle = input.payload.signerTitleSnapshot;
  const titleDate = formatRegisterDate(input.payload.documentDateMsk);
  const leftRole = signerTitle?.footerRu ?? input.authorSnapshot.position;
  const intro = `Я, действующий ${signerTitle?.bodyRu ?? input.authorSnapshot.position} ${input.authorSnapshot.fullName}, руководствуясь действующей Конституцией Штата Сан-Андреас, а также другими нормативно-правовыми актами Штата Сан-Андреас, заявляю:`;

  let registerY = 164;
  registerY = pushWrappedLines({
    lines,
    text: "San Andreas Register",
    x: PAGE_PADDING_LEFT,
    y: registerY,
    width: REGISTER_WIDTH,
    size: pt(12),
    lineHeight: pt(12) * 1.12,
    bold: true,
  });
  lines.push({
    text: `No. ${input.payload.requestNumberNormalized}`,
    x: PAGE_PADDING_LEFT,
    y: registerY,
    size: pt(11.5),
  });
  registerY += pt(11.5) * 1.12;
  lines.push({
    text: titleDate,
    x: PAGE_PADDING_LEFT,
    y: registerY,
    size: pt(11.5),
  });

  lines.push({
    text: "Title 1 —",
    x: PAGE_PADDING_LEFT,
    y: CONTENT_START_Y + 30,
    size: BODY_FONT_SIZE,
    bold: true,
  });

  let roleY = CONTENT_START_Y + 54;
  for (const roleLine of wrapText(leftRole, LEFT_ROLE_WIDTH, BODY_FONT_SIZE)) {
    lines.push({
      text: roleLine,
      x: PAGE_PADDING_LEFT,
      y: roleY,
      size: BODY_FONT_SIZE,
      bold: true,
    });
    roleY += BODY_LINE_HEIGHT * 0.95;
  }

  let y = CONTENT_START_Y + 30;
  lines.push({
    text: `Адвокатский запрос от ${titleDate}.`,
    x: bodyX,
    y,
    size: BODY_FONT_SIZE,
    bold: true,
  });
  y += BODY_LINE_HEIGHT * 0.94;
  lines.push({
    text: "О предоставлении запрашиваемой информации",
    x: bodyX,
    y,
    size: BODY_FONT_SIZE,
    bold: true,
  });
  y += BODY_LINE_HEIGHT * 1.32;
  y = pushWrappedLines({
    lines,
    text: intro,
    x: bodyX,
    y,
    width: bodyWidth,
    size: BODY_FONT_SIZE,
    lineHeight: BODY_LINE_HEIGHT,
    bold: true,
  });
  y += mm(2);

  const sectionBlocks = [
    {
      label: "Section 1.",
      subtitle: "Резолюция.",
      paragraphs: input.payload.section1Items.map((item) => `${item.id}. ${item.text}`),
    },
    {
      label: "Section 2.",
      subtitle: "Срок исполнения, причины отказа.",
      paragraphs: [buildSection2(input.payload)],
    },
    {
      label: "Section 3.",
      subtitle: "Ответственность.",
      paragraphs: [input.payload.section3Text],
    },
    {
      label: "Section 4.",
      subtitle: "Вступление в силу.",
      paragraphs: [buildSection4()],
    },
  ];

  for (const section of sectionBlocks) {
    y = pushSectionHeading({
      lines,
      label: section.label,
      descriptor: section.subtitle,
      x: bodyX,
      y,
    });

    for (const paragraph of section.paragraphs) {
      const numberedItem = /^(\d+)\.\s*(.*)$/.exec(paragraph);

      if (numberedItem) {
        y = pushNumberedItem({
          lines,
          marker: `${numberedItem[1]}.`,
          text: numberedItem[2] ?? "",
          x: bodyX,
          y,
          width: bodyWidth,
        });
        continue;
      }

      y = pushWrappedLines({
        lines,
        text: paragraph,
        x: bodyX,
        y,
        width: bodyWidth,
      });
    }

    y += SECTION_GAP;
  }

  return {
    lines,
    contentBottomY: Math.max(...lines.map((line) => (line.y ?? 0) + (line.size ?? BODY_FONT_SIZE) * 0.35)),
  };
}

async function buildPageSvg(input: {
  title: string;
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
}) {
  const qrDataUrl = await buildQrDataUrl(input);
  const { lines, contentBottomY } = buildVisualLines(input);
  const pageBackground = `<rect width="100%" height="100%" fill="#ffffff"/>`;
  const contentLine = `<line x1="${PAGE_PADDING_LEFT}" y1="216" x2="${PAGE_WIDTH - PAGE_PADDING_RIGHT}" y2="216" stroke="#111" stroke-width="2"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">
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

function buildPdfFromJpeg(jpeg: Buffer) {
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
    `<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH} /Height ${PAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
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

async function buildPdfAndJpgDataUrls(pageSvg: string) {
  const jpg = await sharp(Buffer.from(pageSvg)).jpeg({ quality: 95 }).toBuffer();
  const pdf = buildPdfFromJpeg(jpg);

  return {
    pdfDataUrl: makeDataUrl("application/pdf", pdf),
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
  const { pdfDataUrl, jpgDataUrl } = await buildPdfAndJpgDataUrls(pageSvg);

  return {
    family: "attorney_request" as const,
    format: ATTORNEY_REQUEST_OUTPUT_FORMAT,
    rendererVersion: ATTORNEY_REQUEST_RENDERER_VERSION,
    previewHtml,
    previewText,
    pdfDataUrl,
    jpgDataUrl,
    pageCount: 1 as const,
    blockingReasons: [],
  };
}
