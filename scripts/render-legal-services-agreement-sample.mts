import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const { legalServicesAgreementFixtureAuthorSnapshot, legalServicesAgreementFixturePayload } =
  await import("../src/features/documents/legal-services-agreement/fixtures.ts");
const { renderLegalServicesAgreementArtifact } = await import(
  "../src/features/documents/legal-services-agreement/render.ts"
);

function parseArgs(argv: string[]) {
  let out = ".tmp/legal-services-agreement-sample.html";
  let pagesDir = ".tmp/legal-services-agreement-pages";
  let compareOut = ".tmp/legal-services-agreement-page1-compare.html";

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--out") {
      out = argv[index + 1] ?? out;
      index += 1;
      continue;
    }

    if (value === "--pages-dir") {
      pagesDir = argv[index + 1] ?? pagesDir;
      index += 1;
      continue;
    }

    if (value === "--compare-out") {
      compareOut = argv[index + 1] ?? compareOut;
      index += 1;
    }
  }

  return { out, pagesDir, compareOut };
}

function makeDataUrl(mediaType: string, content: Buffer) {
  return `data:${mediaType};base64,${content.toString("base64")}`;
}

function buildCompareHtml(input: {
  referenceDataUrl: string;
  renderedDataUrl: string;
}) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Legal Services Agreement · Page 1 Compare</title>
  <style>
    body { margin: 0; font-family: "Times New Roman", serif; background: #0f172a; color: #e2e8f0; }
    .shell { display: grid; gap: 16px; max-width: 1440px; margin: 0 auto; padding: 20px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .stage { position: relative; width: 953px; height: 1348px; background: #fff; overflow: hidden; }
    .stage img { position: absolute; inset: 0; width: 953px; height: 1348px; object-fit: contain; }
    .rendered { opacity: 0.65; }
    .difference .rendered { mix-blend-mode: difference; opacity: 1; }
    .grid { display: grid; gap: 20px; grid-template-columns: auto minmax(280px, 1fr); align-items: start; }
    .panel { display: grid; gap: 12px; }
    label { display: grid; gap: 6px; font-size: 14px; }
    input[type="range"] { width: 100%; }
  </style>
</head>
<body>
  <main class="shell">
    <h1>Калибровка 1-й страницы договора</h1>
    <div class="grid">
      <div class="stage" id="stage">
        <img alt="reference" src="${input.referenceDataUrl}" />
        <img alt="rendered" class="rendered" id="rendered" src="${input.renderedDataUrl}" />
      </div>
      <section class="panel">
        <div class="toolbar">
          <button id="differenceToggle" type="button">Difference mode: off</button>
        </div>
        <label>
          Opacity overlay
          <input id="opacityRange" type="range" min="0" max="100" value="65" />
        </label>
        <p>Подгонять нужно глобальные tokens: inset рамки, crest size, title scale, body scale, line-height, width intro, width register.</p>
      </section>
    </div>
  </main>
  <script>
    const stage = document.getElementById('stage');
    const rendered = document.getElementById('rendered');
    const opacityRange = document.getElementById('opacityRange');
    const differenceToggle = document.getElementById('differenceToggle');
    opacityRange.addEventListener('input', () => {
      rendered.style.opacity = String(Number(opacityRange.value) / 100);
    });
    differenceToggle.addEventListener('click', () => {
      stage.classList.toggle('difference');
      differenceToggle.textContent = stage.classList.contains('difference')
        ? 'Difference mode: on'
        : 'Difference mode: off';
    });
  </script>
</body>
</html>`;
}

const { out, pagesDir, compareOut } = parseArgs(process.argv.slice(2));
const outPath = resolve(process.cwd(), out);
const pagesOutDir = resolve(process.cwd(), pagesDir);
const compareOutPath = resolve(process.cwd(), compareOut);
const artifact = await renderLegalServicesAgreementArtifact({
  title: "Договор на оказание юридических услуг",
  authorSnapshot: legalServicesAgreementFixtureAuthorSnapshot,
  payload: legalServicesAgreementFixturePayload,
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, artifact.previewHtml, "utf8");
mkdirSync(pagesOutDir, { recursive: true });

for (const page of artifact.pages) {
  const base64 = page.pngDataUrl.replace(/^data:image\/png;base64,/, "");
  writeFileSync(resolve(pagesOutDir, page.fileName), Buffer.from(base64, "base64"));
}

const referencePage1Path = resolve(
  process.cwd(),
  "src/features/documents/legal-services-agreement/assets/reference/page-1.png",
);
const referencePage1DataUrl = makeDataUrl("image/png", readFileSync(referencePage1Path));
const renderedPage1 = artifact.pages[0];

if (renderedPage1) {
  mkdirSync(dirname(compareOutPath), { recursive: true });
  writeFileSync(
    compareOutPath,
    buildCompareHtml({
      referenceDataUrl: referencePage1DataUrl,
      renderedDataUrl: renderedPage1.pngDataUrl,
    }),
    "utf8",
  );
}

console.log(`[legal-services-agreement-sample] renderer=${artifact.rendererVersion}`);
console.log(`[legal-services-agreement-sample] referenceState=${artifact.referenceState}`);
console.log(`[legal-services-agreement-sample] pageCount=${artifact.pageCount}`);
console.log(`[legal-services-agreement-sample] wrote ${outPath}`);
console.log(`[legal-services-agreement-sample] wrote pages to ${pagesOutDir}`);
console.log(`[legal-services-agreement-sample] wrote compare to ${compareOutPath}`);
