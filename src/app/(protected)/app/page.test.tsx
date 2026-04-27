import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

import ProtectedAppPage from "@/app/(protected)/app/page";
import { redirect } from "next/navigation";

describe("/app protected shell page", () => {
  it("переводит /app в новую главную dashboard zone", async () => {
    await expect(ProtectedAppPage()).rejects.toThrowError("redirect:/");

    expect(redirect).toHaveBeenCalledWith("/");
  });
});
