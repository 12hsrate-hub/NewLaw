import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/internal/access", () => ({
  getInternalAccessContext: vi.fn(),
}));

vi.mock("@/server/internal/corpus", () => ({
  getInternalLawCorpusPageData: vi.fn(),
  getInternalPrecedentCorpusPageData: vi.fn(),
}));

vi.mock("@/server/admin-security/account-search", () => ({
  findAccountForAdminSearch: vi.fn(),
}));

import InternalHealthPage from "@/app/internal/health/page";
import InternalLawsPage from "@/app/internal/laws/page";
import InternalPrecedentsPage from "@/app/internal/precedents/page";
import InternalSecurityPage from "@/app/internal/security/page";
import { findAccountForAdminSearch } from "@/server/admin-security/account-search";
import { getInternalAccessContext } from "@/server/internal/access";
import {
  getInternalLawCorpusPageData,
  getInternalPrecedentCorpusPageData,
} from "@/server/internal/corpus";

describe("internal target route skeletons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInternalAccessContext).mockResolvedValue({
      status: "granted",
      viewer: {
        accountId: "account-1",
        email: "admin@example.com",
        login: "admin",
      },
    });
    vi.mocked(getInternalLawCorpusPageData).mockResolvedValue({
      bootstrapHealthByServerId: {},
      laws: [],
      previewQuery: "",
      retrievalPreview: null,
      selectedPreviewServerId: "",
      servers: [
        {
          id: "server-1",
          name: "Blackberry",
        },
      ],
      sourceIndexes: [],
    });
    vi.mocked(getInternalPrecedentCorpusPageData).mockResolvedValue({
      servers: [
        {
          id: "server-1",
          name: "Blackberry",
        },
      ],
      sourceIndexes: [],
      sourceTopics: [],
    });
    vi.mocked(findAccountForAdminSearch).mockResolvedValue({
      status: "idle",
      identifier: "",
      account: null,
      message: null,
    });
  });

  it("рендерит /internal/laws как target corpus section внутри /internal contour", async () => {
    const html = renderToStaticMarkup(await InternalLawsPage({}));

    expect(html).toContain("Law Corpus");
    expect(html).toContain("Internal Source Management");
    expect(html).toContain('value="/internal/laws"');
  });

  it("рендерит /internal/precedents как target corpus section внутри /internal contour", async () => {
    const html = renderToStaticMarkup(await InternalPrecedentsPage({}));

    expect(html).toContain("Precedent Corpus Review");
    expect(html).toContain('value="/internal/precedents"');
  });

  it("сохраняет denied flow для /internal/laws", async () => {
    vi.mocked(getInternalAccessContext).mockResolvedValue({
      status: "denied",
      viewer: {
        accountId: "account-2",
        email: "user@example.com",
        login: "tester",
      },
    });

    const html = renderToStaticMarkup(await InternalLawsPage({}));

    expect(html).toContain("только super_admin");
    expect(html).toContain("tester");
  });

  it("рендерит /internal/security как target admin security section внутри /internal contour", async () => {
    const html = renderToStaticMarkup(await InternalSecurityPage({}));

    expect(html).toContain("Admin Account Security");
    expect(html).toContain('action="/internal/security"');
    expect(html).toContain("Super Admin");
  });

  it("рендерит /internal/health как skeleton route", async () => {
    const html = renderToStaticMarkup(await InternalHealthPage());

    expect(html).toContain("Health");
    expect(html).toContain("full diagnostics suite");
  });
});
