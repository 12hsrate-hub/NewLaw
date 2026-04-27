import { describe, expect, it } from "vitest";

import {
  getSafeServerSwitchRedirectBase,
  resolveServerSwitchRedirectTarget,
} from "@/server/actions/server-switch-resolver";

describe("server switch resolver", () => {
  it("оставляет /assistant верхнеуровневой страницей", () => {
    expect(
      resolveServerSwitchRedirectTarget({
        redirectTo: "/assistant",
        selectedServerSlug: "new",
      }),
    ).toBe("/assistant");
  });

  it("перенаправляет /assistant/[serverSlug] на новый сервер", () => {
    expect(
      resolveServerSwitchRedirectTarget({
        redirectTo: "/assistant/old",
        selectedServerSlug: "new",
      }),
    ).toBe("/assistant/new");
  });

  it("оставляет /servers верхнеуровневой страницей", () => {
    expect(
      resolveServerSwitchRedirectTarget({
        redirectTo: "/servers",
        selectedServerSlug: "new",
      }),
    ).toBe("/servers");
  });

  it("перенаправляет /servers/[serverSlug] на новый сервер", () => {
    expect(
      resolveServerSwitchRedirectTarget({
        redirectTo: "/servers/old",
        selectedServerSlug: "new",
      }),
    ).toBe("/servers/new");
  });

  it("перенаправляет /servers/[serverSlug]/documents на новый documents hub", () => {
    expect(
      resolveServerSwitchRedirectTarget({
        redirectTo: "/servers/old/documents",
        selectedServerSlug: "new",
      }),
    ).toBe("/servers/new/documents");
  });

  it("обрезает глубокие documents routes до hub нового сервера", () => {
    expect(
      resolveServerSwitchRedirectTarget({
        redirectTo: "/servers/old/documents/ogp-complaints/new",
        selectedServerSlug: "new",
      }),
    ).toBe("/servers/new/documents");
  });

  it("сохраняет account path и обычные query-параметры", () => {
    expect(
      resolveServerSwitchRedirectTarget({
        redirectTo: "/account/security?status=saved",
        selectedServerSlug: "new",
      }),
    ).toBe("/account/security?status=saved");
  });

  it("обновляет server query в account path", () => {
    expect(
      resolveServerSwitchRedirectTarget({
        redirectTo: "/account/characters?server=old&status=active",
        selectedServerSlug: "new",
      }),
    ).toBe("/account/characters?status=active&server=new");
  });

  it("сохраняет /app compatibility path без переписывания в новую IA", () => {
    expect(
      resolveServerSwitchRedirectTarget({
        redirectTo: "/app",
        selectedServerSlug: "new",
      }),
    ).toBe("/app");
  });

  it("отклоняет внешние и небезопасные redirectTo", () => {
    expect(getSafeServerSwitchRedirectBase("https://evil.example/path")).toBe("/servers");
    expect(getSafeServerSwitchRedirectBase("//evil.example/path")).toBe("/servers");
    expect(
      resolveServerSwitchRedirectTarget({
        redirectTo: "//evil.example/path",
        selectedServerSlug: "new",
      }),
    ).toBe("/servers");
  });
});
