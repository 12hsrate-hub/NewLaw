import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/internal/access", () => ({
  getInternalAccessContext: vi.fn(),
}));

import InternalHealthPage from "@/app/internal/health/page";
import InternalLawsPage from "@/app/internal/laws/page";
import InternalPrecedentsPage from "@/app/internal/precedents/page";
import InternalSecurityPage from "@/app/internal/security/page";
import { getInternalAccessContext } from "@/server/internal/access";

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
  });

  it("рендерит /internal/laws как skeleton route", async () => {
    const html = renderToStaticMarkup(await InternalLawsPage());

    expect(html).toContain("Law Corpus");
    expect(html).toContain("target contour");
  });

  it("рендерит /internal/precedents как skeleton route", async () => {
    const html = renderToStaticMarkup(await InternalPrecedentsPage());

    expect(html).toContain("Precedents Corpus");
    expect(html).toContain("target contour");
  });

  it("рендерит /internal/security как skeleton route", async () => {
    const html = renderToStaticMarkup(await InternalSecurityPage());

    expect(html).toContain("Admin Security");
    expect(html).toContain("/account/security");
  });

  it("рендерит /internal/health как skeleton route", async () => {
    const html = renderToStaticMarkup(await InternalHealthPage());

    expect(html).toContain("Health");
    expect(html).toContain("full diagnostics suite");
  });
});
