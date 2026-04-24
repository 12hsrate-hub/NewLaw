import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const { legalServicesAgreementFixtureAuthorSnapshot, legalServicesAgreementFixturePayload } =
  await import("../src/features/documents/legal-services-agreement/fixtures.ts");
const { renderLegalServicesAgreementArtifact } = await import(
  "../src/features/documents/legal-services-agreement/render.ts"
);

function parseArgs(argv: string[]) {
  let out = ".tmp/legal-services-agreement-sample.html";
  let pagesDir = ".tmp/legal-services-agreement-pages";

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
    }
  }

  return { out, pagesDir };
}

const { out, pagesDir } = parseArgs(process.argv.slice(2));
const outPath = resolve(process.cwd(), out);
const pagesOutDir = resolve(process.cwd(), pagesDir);
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

console.log(`[legal-services-agreement-sample] renderer=${artifact.rendererVersion}`);
console.log(`[legal-services-agreement-sample] referenceState=${artifact.referenceState}`);
console.log(`[legal-services-agreement-sample] pageCount=${artifact.pageCount}`);
console.log(`[legal-services-agreement-sample] wrote ${outPath}`);
console.log(`[legal-services-agreement-sample] wrote pages to ${pagesOutDir}`);
