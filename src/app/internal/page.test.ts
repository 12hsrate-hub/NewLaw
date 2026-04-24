import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/internal/access", () => ({
  getInternalAccessContext: vi.fn(),
}));

import InternalLandingPage from "@/app/internal/page";
import { getInternalAccessContext } from "@/server/internal/access";

describe("/internal page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("рендерит landing page с summary cards", async () => {
    vi.mocked(getInternalAccessContext).mockResolvedValue({
      status: "granted",
      viewer: {
        accountId: "account-1",
        email: "admin@example.com",
        login: "admin",
      },
    });

    const html = renderToStaticMarkup(await InternalLandingPage());

    expect(html).toContain("Internal admin contour");
    expect(html).toContain("Laws");
    expect(html).toContain("Precedents");
    expect(html).toContain("Security");
    expect(html).toContain("Access Requests");
    expect(html).toContain("Health");
  });

  it("показывает honest denied flow для не-super_admin", async () => {
    vi.mocked(getInternalAccessContext).mockResolvedValue({
      status: "denied",
      viewer: {
        accountId: "account-1",
        email: "user@example.com",
        login: "tester",
      },
    });

    const html = renderToStaticMarkup(await InternalLandingPage());

    expect(html).toContain("только super_admin");
    expect(html).toContain("tester");
    expect(html).toContain('href="/account"');
  });
});
