import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { usePathnameMock, useSearchParamsMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
  useSearchParamsMock: vi.fn(),
}));

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();

  return {
    ...actual,
    usePathname: usePathnameMock,
    useSearchParams: useSearchParamsMock,
  };
});

import { PrimaryServerSwitcher } from "@/components/product/shell/primary-server-switcher";

describe("primary server switcher", () => {
  it("собирает redirectTo из pathname и query-параметров", () => {
    usePathnameMock.mockReturnValue("/account/characters");
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams("server=blackberry&status=active"),
    );

    const html = renderToStaticMarkup(
      <PrimaryServerSwitcher
        activeServerId="server-1"
        availableServers={[
          {
            id: "server-1",
            name: "Blackberry",
            slug: "blackberry",
          },
        ]}
      />,
    );

    expect(html).toContain(
      'value="/account/characters?server=blackberry&amp;status=active"',
    );
    expect(html).toContain('value="server-1" selected');
  });

  it("использует /servers как fallback для пустого или подозрительного pathname", () => {
    usePathnameMock.mockReturnValue("//evil.example/path");
    useSearchParamsMock.mockReturnValue(new URLSearchParams("status=bad"));

    const html = renderToStaticMarkup(
      <PrimaryServerSwitcher
        activeServerId={null}
        availableServers={[
          {
            id: "server-1",
            name: "Blackberry",
            slug: "blackberry",
          },
        ]}
      />,
    );

    expect(html).toContain('value="/servers"');
  });
});
