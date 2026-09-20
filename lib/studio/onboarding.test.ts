import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { ONBOARDING_CHAPTERS, onboardingProgress } from "./onboarding";

describe("feature overview catalog", () => {
  it("ships the six recordings and posters without the background-work chapter", () => {
    expect(ONBOARDING_CHAPTERS.map((chapter) => chapter.id)).toEqual([
      "inspect",
      "snapshot",
      "assets",
      "components",
      "brand",
      "export",
    ]);
    for (const chapter of ONBOARDING_CHAPTERS) {
      expect(existsSync(`public/onboarding/${chapter.id}.mp4`)).toBe(true);
      expect(existsSync(`public/onboarding/${chapter.id}.jpg`)).toBe(true);
    }
  });
  it("recovers missing, malformed and removed chapters without forgetting dismissal", () => {
    for (const value of [undefined, "broken", "null", "12", "[]"]) {
      expect(onboardingProgress(value)).toEqual({
        chapter: "inspect",
        dismissed: false,
      });
    }
    expect(onboardingProgress('{"chapter":"plan","dismissed":true}')).toEqual({
      chapter: "inspect",
      dismissed: true,
    });
    expect(
      onboardingProgress('{"chapter":"export","dismissed":"true"}')
    ).toEqual({ chapter: "export", dismissed: false });
  });
});
