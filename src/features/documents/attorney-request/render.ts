import { Buffer } from "node:buffer";

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
const PAGE_WIDTH = Math.round(210 * PX_PER_MM);
const PAGE_HEIGHT = Math.round(297 * PX_PER_MM);
const PAGE_PADDING_TOP = 10 * PX_PER_MM;
const PAGE_PADDING_RIGHT = 16 * PX_PER_MM;
const PAGE_PADDING_BOTTOM = 12 * PX_PER_MM;
const PAGE_PADDING_LEFT = 16 * PX_PER_MM;
const BODY_FONT_SIZE = 14;
const BODY_LINE_HEIGHT = BODY_FONT_SIZE * 1.45;
const SECTION_GAP = 7 * PX_PER_MM;
const LEFT_ROLE_WIDTH = 30 * PX_PER_MM;
const SEAL_SIZE = 12 * PX_PER_MM;
const SIGNATURE_WIDTH = 35 * PX_PER_MM;
const QR_SIZE = 20 * PX_PER_MM;
const CONTENT_START_Y = 207;
const MAX_BODY_Y = 900;
const TEXT_FONT = "Times New Roman, Liberation Serif, serif";
const MONO_FONT = "Courier New, Liberation Mono, monospace";

type SvgLine = {
  text: string;
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

function renderLine(line: SvgLine) {
  return `<text x="${line.x ?? PAGE_PADDING_LEFT}" y="${line.y ?? PAGE_PADDING_TOP}" font-family="${line.family ?? TEXT_FONT}" font-size="${line.size ?? BODY_FONT_SIZE}"${line.bold ? ' font-weight="700"' : ""}${line.italic ? ' font-style="italic"' : ""}${line.anchor ? ` text-anchor="${line.anchor}"` : ""}>${escapeXml(line.text)}</text>`;
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
  const y = 22;
  const cx = x + SEAL_SIZE / 2;
  const cy = y + SEAL_SIZE / 2;

  return `<g opacity="0.82">
    <circle cx="${cx}" cy="${cy}" r="${SEAL_SIZE / 2 - 1}" fill="#f4f0e8" stroke="#1f2937" stroke-width="1.4"/>
    <circle cx="${cx}" cy="${cy}" r="${SEAL_SIZE / 2 - 5}" fill="none" stroke="#64748b" stroke-width="1"/>
    <text x="${cx}" y="${cy - 1}" font-family="${TEXT_FONT}" font-size="7" font-weight="700" text-anchor="middle">SA</text>
    <text x="${cx}" y="${cy + 7}" font-family="${TEXT_FONT}" font-size="5" text-anchor="middle">BAR</text>
  </g>`;
}

function buildSignatureSvg() {
  const x = PAGE_WIDTH / 2 - SIGNATURE_WIDTH / 2;
  const y = 842;

  return `<g transform="translate(${x} ${y})" fill="none" stroke="#111111" stroke-width="1.5" stroke-linecap="round" opacity="0.86">
    <ellipse cx="${SIGNATURE_WIDTH / 2}" cy="44" rx="${SIGNATURE_WIDTH * 0.35}" ry="54" transform="rotate(-18 ${SIGNATURE_WIDTH / 2} 44)"/>
    <path d="M26 72 C46 34, 58 88, 76 36 C83 20, 86 84, 98 36 C103 20, 108 76, 116 44" />
    <path d="M34 74 C58 66, 81 58, 113 30" />
  </g>`;
}

function buildHeaderLines() {
  const left = PAGE_PADDING_LEFT;
  const right = PAGE_WIDTH - PAGE_PADDING_RIGHT;
  const center = PAGE_WIDTH / 2;

  return `<line x1="${left}" y1="68" x2="${right}" y2="68" stroke="#111" stroke-width="2"/>
  <line x1="${left}" y1="74" x2="${right}" y2="74" stroke="#111" stroke-width="1"/>
  <text x="${center}" y="104" font-family="${TEXT_FONT}" font-size="26.666" font-weight="700" text-anchor="middle">STATE OF SAN ANDREAS</text>
  <text x="${center}" y="132" font-family="${TEXT_FONT}" font-size="18.666" text-anchor="middle">BAR ASSOCIATION</text>`;
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
  const leftRoleLines = wrapText(signerTitle?.footerRu ?? input.authorSnapshot.position, 150, 16)
    .map((line, index) => `<text x="${PAGE_PADDING_LEFT}" y="${922 + index * 20}" font-family="${TEXT_FONT}" font-size="16">${escapeXml(line)}</text>`)
    .join("");
  const filedDate = formatFiledDate(input.payload.documentDateMsk);

  return `<g>
    ${buildSignatureSvg()}
    ${leftRoleLines}
    <text x="${PAGE_WIDTH - PAGE_PADDING_RIGHT}" y="922" font-family="${TEXT_FONT}" font-size="16" text-anchor="end">${escapeXml(input.authorSnapshot.fullName)}</text>
    <text x="${PAGE_PADDING_LEFT}" y="1038" font-family="${MONO_FONT}" font-size="14.666">|SAI Dec. ${stampYear}-BAR-</text>
    <text x="${PAGE_PADDING_LEFT}" y="1058" font-family="${MONO_FONT}" font-size="14.666">${escapeXml(requestDigits || "0000")}</text>
    <text x="${PAGE_PADDING_LEFT}" y="1078" font-family="${MONO_FONT}" font-size="14.666">Filed ${escapeXml(filedDate)}</text>
    <text x="${PAGE_WIDTH / 2}" y="1048" font-family="${TEXT_FONT}" font-size="17.333" text-anchor="middle">SAN ANDREAS CAPITOL</text>
    <text x="${PAGE_WIDTH / 2}" y="1072" font-family="${TEXT_FONT}" font-size="16" font-style="italic" text-anchor="middle">${escapeXml(formatRegisterDate(input.payload.documentDateMsk))}</text>
    <image href="${input.qrDataUrl}" x="${PAGE_WIDTH - PAGE_PADDING_RIGHT - QR_SIZE}" y="${PAGE_HEIGHT - PAGE_PADDING_BOTTOM - QR_SIZE}" width="${QR_SIZE}" height="${QR_SIZE}"/>
  </g>`;
}

function buildVisualLines(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
}) {
  const lines: SvgLine[] = [];
  const bodyX = PAGE_PADDING_LEFT + LEFT_ROLE_WIDTH;
  const bodyWidth = PAGE_WIDTH - PAGE_PADDING_RIGHT - bodyX;
  const signerTitle = input.payload.signerTitleSnapshot;
  const titleDate = formatRegisterDate(input.payload.documentDateMsk);
  const leftRole = signerTitle?.footerRu ?? input.authorSnapshot.position;
  const intro = `Я, действующий ${signerTitle?.bodyRu ?? input.authorSnapshot.position} ${input.authorSnapshot.fullName}, руководствуясь действующей Конституцией Штата Сан-Андреас, а также другими нормативно-правовыми актами Штата Сан-Андреас, заявляю:`;

  lines.push({
    text: "San Andreas Register",
    x: PAGE_PADDING_LEFT,
    y: 164,
    size: 16,
    bold: true,
  });
  lines.push({
    text: `No. ${input.payload.requestNumberNormalized}`,
    x: PAGE_PADDING_LEFT,
    y: 184,
    size: 15.333,
  });
  lines.push({
    text: titleDate,
    x: PAGE_PADDING_LEFT,
    y: 204,
    size: 15.333,
  });

  lines.push({
    text: "Title 1 —",
    x: PAGE_PADDING_LEFT,
    y: CONTENT_START_Y + 30,
    size: 15,
    bold: true,
  });

  let roleY = CONTENT_START_Y + 54;
  for (const roleLine of wrapText(leftRole, LEFT_ROLE_WIDTH, 15)) {
    lines.push({
      text: roleLine,
      x: PAGE_PADDING_LEFT,
      y: roleY,
      size: 15,
      bold: true,
    });
    roleY += 19;
  }

  let y = CONTENT_START_Y + 30;
  lines.push({
    text: `Адвокатский запрос от ${titleDate}.`,
    x: bodyX,
    y,
    size: 15,
    bold: true,
  });
  y += 20;
  lines.push({
    text: "О предоставлении запрашиваемой информации",
    x: bodyX,
    y,
    size: 15,
    bold: true,
  });
  y += 29;
  y = pushWrappedLines({
    lines,
    text: intro,
    x: bodyX,
    y,
    width: bodyWidth,
    size: 15,
    lineHeight: 21,
    bold: true,
  });
  y += 8;

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
    lines.push({
      text: `${section.label} ${section.subtitle}`,
      x: bodyX,
      y,
      size: BODY_FONT_SIZE,
      bold: true,
      italic: true,
    });
    y += BODY_LINE_HEIGHT;

    for (const paragraph of section.paragraphs) {
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
    contentBottomY: y,
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
