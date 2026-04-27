import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccountSecuritySection } from "@/components/product/security/account-security-section";

describe("account security section", () => {
  it("показывает безопасный status banner без технического кода", () => {
    const html = renderToStaticMarkup(
      createElement(AccountSecuritySection, {
        accountEmail: "user@example.com",
        accountLogin: "tester",
        mustChangePassword: false,
        pendingEmail: null,
        status: "admin-access-denied",
      }),
    );

    expect(html).toContain("Этот раздел недоступен. Здесь можно управлять только безопасностью своего аккаунта.");
    expect(html).not.toContain("ACCOUNT_ADMIN_SECURITY_DENIED");
  });
});
