import { describe, expect, it } from "vitest";
import {
  isStudioBootReady,
  SPLASH_CAP,
  splashPhase,
} from "@/lib/studio/splash";

const SHOWN_AT = 10_000;

function phaseAt(
  elapsed: number,
  options: { isReduced?: boolean; isSettled?: boolean } = {}
) {
  return splashPhase({
    cap: SPLASH_CAP,
    isReduced: options.isReduced ?? false,
    isSettled: options.isSettled ?? false,
    now: SHOWN_AT + elapsed,
    shownAt: SHOWN_AT,
  });
}

describe("splashPhase", () => {
  it("keeps drawing when the shell settles before the animation lands", () => {
    expect(phaseAt(1499, { isSettled: true })).toBe("drawing");
  });

  it("leaves as soon as a settled shell has shown the full draw", () => {
    expect(phaseAt(1500, { isSettled: true })).toBe("leaving");
  });

  it("holds after the draw while the shell is unsettled", () => {
    expect(phaseAt(1500)).toBe("holding");
  });

  it("leaves an unsettled shell at the safety cap", () => {
    expect(phaseAt(SPLASH_CAP)).toBe("leaving");
  });

  it("skips drawing when reduced motion is requested", () => {
    expect(phaseAt(0, { isReduced: true })).toBe("holding");
  });
});

describe("isStudioBootReady", () => {
  it("keeps the shell covered while its initial sessions are still arriving", () => {
    expect(
      isStudioBootReady({
        isLoadingProjects: false,
        isLoadingSessions: true,
        isReady: true,
        isVideosReady: true,
      })
    ).toBe(false);
  });
});
