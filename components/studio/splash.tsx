import type { AnimationEventHandler } from "react";
import type { SplashPhase } from "@/lib/studio/splash";
import { GLYPH } from "./logo-mark";
import { ShaderField } from "./shader-field";

const SPEED = 0.26;
const SCALE = 2.4;
const BRIGHTNESS = 0.16;
const CONTRAST = 0.26;

export function Splash({
  isReduced,
  onAnimationEnd,
  phase,
}: {
  isReduced: boolean;
  onAnimationEnd: AnimationEventHandler<HTMLDivElement>;
  phase: SplashPhase | "gone";
}) {
  if (phase === "gone") {
    return null;
  }

  return (
    <div
      aria-label="Loading Remocn Studio"
      className="splash-surface fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-sidebar text-sidebar-foreground"
      data-reduced-motion={isReduced}
      data-splash={phase}
      data-tauri-drag-region
      onAnimationEnd={onAnimationEnd}
      role="status"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-75 [mask-image:radial-gradient(90%_80%_at_50%_50%,#000_0%,#000b_45%,transparent_100%)]"
      >
        <ShaderField
          brightness={BRIGHTNESS}
          className="animate-titlebar"
          contrast={CONTRAST}
          scale={SCALE}
          speed={SPEED}
        />
      </div>

      <div
        aria-hidden="true"
        className="splash-lockup relative flex items-baseline font-semibold text-3xl tracking-tight"
        data-splash-lockup
      >
        <svg
          className="h-[1em] w-auto overflow-visible"
          fill="none"
          viewBox="0 0 124.06 134.26"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>remocn</title>
          <path
            className="splash-glyph-stroke"
            d={GLYPH}
            pathLength="1"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path className="splash-glyph-fill" d={GLYPH} fill="currentColor" />
        </svg>
        <span className="splash-wordmark ml-[0.04em]">emocn Studio</span>
      </div>
    </div>
  );
}
