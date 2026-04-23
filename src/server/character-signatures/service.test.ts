import { describe, expect, it } from "vitest";

import { isCharacterSignatureAspectRatioAccepted } from "@/server/character-signatures/service";

describe("character signature upload validation", () => {
  it("принимает подпись, которая практически совпадает с минимальным широким форматом", () => {
    expect(isCharacterSignatureAspectRatioAccepted(685 / 350)).toBe(true);
  });

  it("по-прежнему отклоняет слишком высокий формат подписи", () => {
    expect(isCharacterSignatureAspectRatioAccepted(1.7)).toBe(false);
  });
});
