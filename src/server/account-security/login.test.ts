import { describe, expect, it } from "vitest";

import { accountLoginSchema } from "@/schemas/account-security";
import {
  createBackfillLoginSeed,
  createUniqueLoginVariant,
  isReservedAccountLogin,
  normalizeAccountLogin,
  resolveAccountLoginWithFallback,
} from "@/server/account-security/login";

describe("account login foundation", () => {
  it("приводит login к lowercase", () => {
    expect(normalizeAccountLogin("Lawyer_User")).toBe("lawyer_user");
  });

  it("запрещает reserved logins", () => {
    expect(isReservedAccountLogin("admin")).toBe(true);
    expect(accountLoginSchema.safeParse("support").success).toBe(false);
  });

  it("строит backfill login из email local-part", () => {
    expect(createBackfillLoginSeed("Lawyer.User@example.com", "f4d465a1-4e56-4262-bf0e-d73b52bdbeb3")).toBe(
      "lawyer_user",
    );
  });

  it("переходит на fallback при reserved или дублирующемся backfill login", async () => {
    const result = await resolveAccountLoginWithFallback({
      requestedLogin: null,
      email: "admin@example.com",
      accountId: "f4d465a1-4e56-4262-bf0e-d73b52bdbeb3",
      isLoginTaken: async (login) => login === "user_f4d465a1",
      allowRequestedConflictFallback: true,
    });

    expect(result).toBe(createUniqueLoginVariant("user_f4d465a1", "f4d465a1-4e56-4262-bf0e-d73b52bdbeb3"));
  });
});
