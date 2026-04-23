import { Buffer } from "node:buffer";

import sharp from "sharp";

import { attorneyRequestAddresseePresets } from "@/features/documents/attorney-request/presets";
import {
  ATTORNEY_REQUEST_OUTPUT_FORMAT,
  ATTORNEY_REQUEST_RENDERER_VERSION,
} from "@/features/documents/attorney-request/types";
import type { AttorneyRequestDraftPayload } from "@/features/documents/attorney-request/schemas";
import type { DocumentAuthorSnapshot } from "@/schemas/document";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_MARGIN = 56;
const FONT_SIZE = 15;
const LINE_HEIGHT = 22;
const MAX_LINE_CHARS = 86;
const MAX_PAGE_LINES = Math.floor((PAGE_HEIGHT - PAGE_MARGIN * 2) / LINE_HEIGHT);

export class AttorneyRequestGenerationBlockedError extends Error {
  constructor(public readonly reasons: string[]) {
    super("Адвокатский запрос не готов к генерации.");
    this.name = "AttorneyRequestGenerationBlockedError";
  }
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

function buildSection2(payload: AttorneyRequestDraftPayload) {
  return `На основании статьи 5 Закона о Коллегии Адвокатов прошу предоставить ответ в течение 1 дня. Крайний срок ответа: ${formatMskDateTime(payload.responseDueAtMsk)}. Отказ допускается только в случаях, прямо предусмотренных законом.`;
}

function buildSection4() {
  return "Настоящий запрос вступает в законную силу с момента его публикации.";
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
    `Адвокатский запрос ${input.payload.requestNumberNormalized || input.payload.requestNumberRawInput}`,
    `Кому: ${addressee}`,
    `От: ${input.authorSnapshot.fullName}, ${signerTitle?.bodyRu ?? input.authorSnapshot.position}`,
    `Доверитель: ${input.payload.trustorSnapshot.fullName}, паспорт ${input.payload.trustorSnapshot.passportNumber}`,
    `Договор: ${input.payload.contractNumber}`,
    `Период: ${input.payload.requestDate} ${input.payload.timeFrom}-${input.payload.timeTo}`,
    "",
    "1. Запрашиваемая информация",
    ...input.payload.section1Items.map((item) => `${item.id}) ${item.text}`),
    "",
    `2. Порядок ответа: ${buildSection2(input.payload)}`,
    "",
    `3. Адресация: ${input.payload.section3Text}`,
    "",
    `4. Вступление в силу: ${buildSection4()}`,
    "",
    `${signerTitle?.footerRu ?? input.authorSnapshot.position}: ${input.authorSnapshot.fullName}`,
  ].join("\n");
}

function wrapTextLine(input: string) {
  const line = input.trimEnd();

  if (line.length <= MAX_LINE_CHARS) {
    return [line];
  }

  const words = line.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= MAX_LINE_CHARS) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function buildPageLines(previewText: string) {
  return previewText.split("\n").flatMap((line) => {
    if (line.trim().length === 0) {
      return [""];
    }

    return wrapTextLine(line);
  });
}

function buildPreviewHtml(input: {
  title: string;
  authorSnapshot: DocumentAuthorSnapshot;
  payload: AttorneyRequestDraftPayload;
}) {
  const addressee = input.payload.addresseePreset
    ? attorneyRequestAddresseePresets[input.payload.addresseePreset].label
    : "Адресат не выбран";
  const signerTitle = input.payload.signerTitleSnapshot;
  const section1 = input.payload.section1Items
    .map((item) => `<li>${escapeHtml(item.text)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    body { font-family: "Times New Roman", serif; color: #111; background: #fff; }
    .page { width: 794px; min-height: 1123px; margin: 0 auto; padding: 56px; box-sizing: border-box; }
    .top { display: grid; grid-template-columns: 1fr 1.2fr; gap: 40px; font-size: 13px; }
    .right { text-align: right; }
    h1 { text-align: center; font-size: 22px; margin: 34px 0 20px; }
    p, li { font-size: 15px; line-height: 1.35; }
    ol { padding-left: 22px; }
    .footer { margin-top: 26px; display: flex; justify-content: space-between; font-size: 15px; }
  </style>
</head>
<body>
  <main class="page">
    <section class="top">
      <div>
        <p>${escapeHtml(signerTitle?.leftColumnEn ?? input.authorSnapshot.position)}</p>
        <p>${escapeHtml(input.authorSnapshot.fullName)}</p>
        <p>IC email: ${escapeHtml(input.authorSnapshot.icEmail)}</p>
      </div>
      <div class="right">
        <p>${escapeHtml(addressee)}</p>
        <p>Attorney request № ${escapeHtml(input.payload.requestNumberNormalized)}</p>
      </div>
    </section>
    <h1>Адвокатский запрос</h1>
    <p>Я, ${escapeHtml(signerTitle?.bodyRu ?? input.authorSnapshot.position)} ${escapeHtml(input.authorSnapshot.fullName)}, действуя в интересах доверителя ${escapeHtml(input.payload.trustorSnapshot.fullName)}, направляю настоящий адвокатский запрос.</p>
    <p>Договор № ${escapeHtml(input.payload.contractNumber)}. Запрашиваемый период: ${escapeHtml(input.payload.requestDate)} ${escapeHtml(input.payload.timeFrom)}-${escapeHtml(input.payload.timeTo)}.</p>
    <h2>1. Запрашиваемая информация</h2>
    <ol>${section1}</ol>
    <h2>2. Порядок ответа</h2>
    <p>${escapeHtml(buildSection2(input.payload))}</p>
    <h2>3. Адресация</h2>
    <p>${escapeHtml(input.payload.section3Text)}</p>
    <h2>4. Заключительное положение</h2>
    <p>${escapeHtml(buildSection4())}</p>
    <section class="footer">
      <span>${escapeHtml(signerTitle?.footerRu ?? input.authorSnapshot.position)}</span>
      <span>${escapeHtml(input.authorSnapshot.fullName)}</span>
    </section>
  </main>
</body>
</html>`;
}

function makeDataUrl(mediaType: string, content: Buffer) {
  return `data:${mediaType};base64,${content.toString("base64")}`;
}

function buildPageSvg(lines: string[]) {
  const tspans = lines
    .map((line, index) => {
      const y = PAGE_MARGIN + FONT_SIZE + index * LINE_HEIGHT;

      if (line.length === 0) {
        return `<tspan x="${PAGE_MARGIN}" y="${y}"> </tspan>`;
      }

      return `<tspan x="${PAGE_MARGIN}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text font-family="DejaVu Sans, Arial, sans-serif" font-size="${FONT_SIZE}" fill="#111111">${tspans}</text>
</svg>`;
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

async function buildPdfAndJpgDataUrls(lines: string[]) {
  const svg = buildPageSvg(lines);
  const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
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
    issues.push("Должность персонажа не поддерживается для шаблона адвокатского запроса.");
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
  const previewHtml = buildPreviewHtml(input);
  const pageLines = buildPageLines(previewText);

  if (pageLines.length > MAX_PAGE_LINES) {
    throw new AttorneyRequestGenerationBlockedError([
      "Документ не помещается в одну страницу. Сократите редактируемые пункты раздела 1 или раздела 3.",
    ]);
  }
  const { pdfDataUrl, jpgDataUrl } = await buildPdfAndJpgDataUrls(pageLines);

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
