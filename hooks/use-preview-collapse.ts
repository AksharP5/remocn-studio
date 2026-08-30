"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

type Phase = "hidden" | "hiding" | "showing" | "shown";

const SETTLE_FALLBACK_MS = 400;

export interface PreviewCollapse {
  isAnimating: boolean;
  isMounted: boolean;
  panelRef: React.RefObject<PanelImperativeHandle | null>;
}

export function usePreviewCollapse(isShown: boolean): PreviewCollapse {
  const panelRef = useRef<PanelImperativeHandle | null>(null);
  const [phase, setPhase] = useState<Phase>(isShown ? "shown" : "hidden");
  const previous = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const was = previous.current;
    previous.current = isShown;

    if (panel === null) {
      return;
    }

    if (was === null || was === isShown) {
      if (!isShown) {
        panel.collapse();
      }
      return;
    }

    setPhase(isShown ? "showing" : "hiding");
    if (isShown) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [isShown]);

  useEffect(() => {
    if (phase !== "hiding" && phase !== "showing") {
      return;
    }

    const timer = setTimeout(() => {
      setPhase((current) => {
        if (current === "hiding") {
          return "hidden";
        }

        return current === "showing" ? "shown" : current;
      });
    }, SETTLE_FALLBACK_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  return {
    isAnimating: phase === "hiding" || phase === "showing",
    isMounted: phase !== "hidden",
    panelRef,
  };
}
