"use client";

import { type TransitionEvent, useCallback, useEffect, useState } from "react";

type Phase = "hidden" | "hiding" | "showing" | "shown";

const SETTLE_FALLBACK_MS = 400;

export interface SidebarCollapse {
  isAnimating: boolean;
  isExpanded: boolean;
  isMounted: boolean;
  onTransitionEnd: (event: TransitionEvent<HTMLElement>) => void;
}

function nextPhase(current: Phase, isShown: boolean, isInstant: boolean) {
  if (isInstant) {
    return isShown ? "shown" : "hidden";
  }
  if (isShown) {
    return current === "shown" || current === "showing" ? current : "showing";
  }
  return current === "hidden" || current === "hiding" ? current : "hiding";
}

export function useSidebarCollapse(
  isShown: boolean,
  hasRoom = true
): SidebarCollapse {
  const [phase, setPhase] = useState<Phase>(isShown ? "shown" : "hidden");
  const [seen, setSeen] = useState({ hasRoom, isShown });

  if (seen.isShown !== isShown || seen.hasRoom !== hasRoom) {
    setSeen({ hasRoom, isShown });
    setPhase(nextPhase(phase, isShown, seen.hasRoom !== hasRoom));
  }

  const settle = useCallback(() => {
    setPhase((current) => {
      if (current === "hiding") {
        return "hidden";
      }

      return current === "showing" ? "shown" : current;
    });
  }, []);

  useEffect(() => {
    if (phase !== "hiding" && phase !== "showing") {
      return;
    }

    const timer = setTimeout(settle, SETTLE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [phase, settle]);

  const onTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) {
        settle();
      }
    },
    [settle]
  );

  return {
    isAnimating: phase === "hiding" || phase === "showing",
    isExpanded: phase === "shown" || phase === "showing",
    isMounted: phase !== "hidden",
    onTransitionEnd,
  };
}
