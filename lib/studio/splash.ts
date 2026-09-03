export const SPLASH_MIN_SHOWN = 1500;
export const SPLASH_CAP = 6000;
export const SPLASH_SETTLE_QUIET = 150;

export type SplashPhase = "drawing" | "holding" | "leaving";

export function isStudioBootReady({
  isLoadingProjects,
  isLoadingSessions,
  isReady,
  isVideosReady,
}: {
  isLoadingProjects: boolean;
  isLoadingSessions: boolean;
  isReady: boolean;
  isVideosReady: boolean;
}): boolean {
  return isReady && !isLoadingProjects && !isLoadingSessions && isVideosReady;
}

export function splashPhase({
  cap,
  isReduced,
  isSettled,
  now,
  shownAt,
}: {
  cap: number;
  isReduced: boolean;
  isSettled: boolean;
  now: number;
  shownAt: number;
}): SplashPhase {
  const elapsed = Math.max(0, now - shownAt);

  if (elapsed >= cap) {
    return "leaving";
  }

  if (elapsed < SPLASH_MIN_SHOWN) {
    return isReduced ? "holding" : "drawing";
  }

  return isSettled ? "leaving" : "holding";
}
