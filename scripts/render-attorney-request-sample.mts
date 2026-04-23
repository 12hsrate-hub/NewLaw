import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const { resolveAttorneyRequestSignerTitle } = await import(
  "../src/features/documents/attorney-request/presets.ts"
);
const { renderAttorneyRequestArtifact } = await import(
  "../src/features/documents/attorney-request/render.ts"
);

function parseArgs(argv: string[]) {
  let out = ".tmp/attorney-request-1703-sample.jpg";

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--out") {
      out = argv[index + 1] ?? out;
      index += 1;
    }
  }

  return { out };
}

const authorSnapshot = {
  characterId: "character-1703",
  serverId: "server-blackberry",
  serverCode: "blackberry",
  serverName: "Blackberry",
  fullName: "Dom Dubolom",
  nickname: "Dom",
  passportNumber: "2141",
  position: "Адвокат",
  address: "San Andreas",
  phone: "123-45-67",
  icEmail: "12hsrate@sa.com",
  passportImageUrl: "https://example.com/passport.png",
  isProfileComplete: true,
  roleKeys: ["lawyer"],
  accessFlags: ["advocate"],
  capturedAt: "2026-04-23T12:00:00.000Z",
};

const payload = {
  requestNumberRawInput: "1703",
  requestNumberNormalized: "BAR-1703",
  contractNumber: "LS-103",
  addresseePreset: "FIB_DIRECTOR",
  targetOfficerInput: "Pavel Clayton",
  requestDate: "2025-10-30",
  timeFrom: "15:50",
  timeTo: "16:05",
  crossesMidnight: false,
  periodStartAt: "2025-10-30T12:50:00.000Z",
  periodEndAt: "2025-10-30T13:05:00.000Z",
  startedAtMsk: "31.10.2025 12:00",
  documentDateMsk: "31.10.2025",
  responseDueAtMsk: "2025-11-01T12:00:00.000Z",
  signerTitleSnapshot: resolveAttorneyRequestSignerTitle("Адвокат"),
  trustorSnapshot: {
    trustorId: "trustor-1703",
    fullName: "Marky Wexusov",
    passportNumber: "1030",
    phone: "123-45-67",
    icEmail: "12hsrate@sa.com",
    passportImageUrl: "https://example.com/passport.png",
    note: "",
  },
  section1Items: [
    {
      id: "1",
      text: "Фиксацию процессуальных действий с боди-камеры указанного сотрудника за 30.10.2025 15:50 по 16:05 в отношении гр-на Marky Wexusov.",
    },
    {
      id: "2",
      text: "В случае, если процессуальные действия проводились вне промежутка времени указанного в текущем документе, предоставить видеозапись всех процессуальных действий в отношении гр-на Marky Wexusov за 30.10.2025.",
    },
    {
      id: "3",
      text: "Личные данные сотрудника: ФИО, данные из государственной базы данных при наличии такового.",
    },
  ],
  section3Text:
    "Адвокатский запрос о предоставлении личных данных направлен Директору FIB и его заместителям. Адвокатский запрос о предоставлении видеофиксации направлен Pavel Clayton.",
  validationState: {},
  workingNotes: "",
};

const { out } = parseArgs(process.argv.slice(2));
const outPath = resolve(process.cwd(), out);
const artifact = await renderAttorneyRequestArtifact({
  title: "Адвокатский запрос",
  authorSnapshot,
  payload,
});
const imagePayload = artifact.jpgDataUrl.split(",")[1] ?? "";

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(imagePayload, "base64"));

console.log(`[attorney-request-sample] renderer=${artifact.rendererVersion}`);
console.log(`[attorney-request-sample] pageCount=${artifact.pageCount}`);
console.log(`[attorney-request-sample] wrote ${outPath}`);
