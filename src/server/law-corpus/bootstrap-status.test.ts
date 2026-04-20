import { describe, expect, it } from "vitest";

import { buildLawCorpusBootstrapHealth } from "@/server/law-corpus/bootstrap-status";

describe("law corpus bootstrap health", () => {
  it("помечает сервер как incomplete без current primary corpus", () => {
    const result = buildLawCorpusBootstrapHealth([
      {
        lawKind: "primary",
        isExcluded: false,
        classificationOverride: null,
        currentVersionId: null,
        versionCount: 0,
      },
    ]);

    expect(result.status).toBe("corpus_bootstrap_incomplete");
    expect(result.missingImportPrimaryCount).toBe(1);
  });

  it("помечает сервер как usable_with_gaps при частичном current coverage", () => {
    const result = buildLawCorpusBootstrapHealth([
      {
        lawKind: "primary",
        isExcluded: false,
        classificationOverride: null,
        currentVersionId: "version-1",
        versionCount: 1,
      },
      {
        lawKind: "primary",
        isExcluded: false,
        classificationOverride: null,
        currentVersionId: null,
        versionCount: 1,
      },
    ]);

    expect(result.status).toBe("usable_with_gaps");
    expect(result.currentPrimaryCount).toBe(1);
    expect(result.draftOnlyPrimaryCount).toBe(1);
  });

  it("помечает сервер как ready при полном current coverage", () => {
    const result = buildLawCorpusBootstrapHealth([
      {
        lawKind: "primary",
        isExcluded: false,
        classificationOverride: null,
        currentVersionId: "version-1",
        versionCount: 1,
      },
      {
        lawKind: "supplement",
        isExcluded: false,
        classificationOverride: null,
        currentVersionId: null,
        versionCount: 1,
      },
    ]);

    expect(result.status).toBe("current_corpus_ready");
    expect(result.primaryLawCount).toBe(1);
    expect(result.supplementCount).toBe(1);
  });
});
