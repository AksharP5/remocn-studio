import { describe, expect, it } from "bun:test";
import {
  isStudioBootReady,
  SPLASH_CAP,
  SPLASH_MIN_SHOWN,
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
    expect(phaseAt(SPLASH_MIN_SHOWN - 1, { isSettled: true })).toBe("drawing");
  });

  it("leaves as soon as a settled shell has shown the full draw", () => {
    expect(phaseAt(SPLASH_MIN_SHOWN, { isSettled: true })).toBe("leaving");
  });

  it("holds after the draw while the shell is unsettled", () => {
    expect(phaseAt(SPLASH_MIN_SHOWN)).toBe("holding");
  });

  it("leaves an unsettled shell at the safety cap", () => {
    expect(phaseAt(SPLASH_CAP)).toBe("leaving");
  });

  it("skips drawing when reduced motion is requested", () => {
    expect(phaseAt(0, { isReduced: true })).toBe("holding");
  });
});

describe("SPLASH_MIN_SHOWN", () => {
  it("is no shorter than the draw, which lands at 775 ms", () => {
    expect(SPLASH_MIN_SHOWN).toBeGreaterThanOrEqual(775);
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
