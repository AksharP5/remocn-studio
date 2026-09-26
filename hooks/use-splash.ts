"use client";

import { type AnimationEvent, useCallback, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useNow } from "@/hooks/use-now";
import {
  SPLASH_CAP,
  SPLASH_SETTLE_QUIET,
  type SplashPhase,
  splashPhase,
} from "@/lib/studio/splash";

const TICK = "50 millis";
const EXIT_ANIMATION = "splash-out";

export interface SplashControl {
  isReduced: boolean;
  onAnimationEnd: (event: AnimationEvent<HTMLDivElement>) => void;
  phase: SplashPhase | "gone";
}

export interface Boot {
  isBooting: boolean;
  onGone: () => void;
}

export function useBoot(): Boot {
  const [isBooting, setIsBooting] = useState(true);
  const onGone = useCallback(() => setIsBooting(false), []);

  return { isBooting, onGone };
}

export function useSplash(
  isSettled: boolean,
  onGone?: () => void
): SplashControl {
  const [isGone, setIsGone] = useState(false);
  const now = useNow(isGone ? null : TICK);
  const shownAt = useRef(now);
  const settledAt = useRef<number | null>(null);
  const isReduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  if (isSettled) {
    settledAt.current ??= now;
  } else {
    settledAt.current = null;
  }

  const hasQuieted =
    settledAt.current !== null &&
    now - settledAt.current >= SPLASH_SETTLE_QUIET;
  const livePhase = splashPhase({
    cap: SPLASH_CAP,
    isReduced,
    isSettled: hasQuieted,
    now,
    shownAt: shownAt.current,
  });

  const onAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLDivElement>) => {
      if (
        livePhase === "leaving" &&
        event.currentTarget === event.target &&
        event.animationName === EXIT_ANIMATION
      ) {
        setIsGone(true);
        onGone?.();
      }
    },
    [livePhase, onGone]
  );

  return {
    isReduced,
    onAnimationEnd,
    phase: isGone ? "gone" : livePhase,
  };
}
