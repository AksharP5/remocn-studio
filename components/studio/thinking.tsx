import type { CSSProperties } from "react";
import { DotmSquare11 } from "@/components/ui/dotm-square-11";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { usePrefersReducedMotion } from "@/lib/dotmatrix-hooks";
import {
  STRIP_COLUMNS,
  STRIP_RINGS,
  STRIP_ROWS,
  stripDots,
} from "@/lib/studio/thinking-strip";
import { runningTime } from "@/lib/studio/time";
import { cn } from "@/lib/utils";

export function ThinkingMark({ className }: { className?: string }) {
  return (
    <DotmSquare11
      animated
      ariaLabel=""
      className={className}
      colorPreset="grad-prism"
      dotSize={2}
      opacityBase={0.12}
      opacityMid={0.42}
      opacityPeak={1}
      pattern="full"
      size={14}
      speed={1.05}
    />
  );
}

const STRIP_DOT = 2;
const STRIP_GAP = 1;
const STRIP_STYLE = {
  "--dmx-opacity-base": 0.12,
  "--dmx-opacity-mid": 0.42,
  "--dmx-opacity-peak": 1,
  "--dmx-speed": 1 / 1.05,
} as CSSProperties;
const STRIP_GRID = {
  gap: STRIP_GAP,
  gridTemplateColumns: `repeat(${STRIP_COLUMNS}, ${STRIP_DOT}px)`,
  gridTemplateRows: `repeat(${STRIP_ROWS}, ${STRIP_DOT}px)`,
} as CSSProperties;
const DOTS = stripDots();

export function ThinkingStrip({ className }: { className?: string }) {
  const still = usePrefersReducedMotion();

  return (
    <span
      aria-hidden="true"
      className={cn("dmx-root", className)}
      style={STRIP_STYLE}
    >
      <span className="dmx-grid" style={STRIP_GRID}>
        {DOTS.map((dot) => (
          <span
            className={cn("dmx-dot", !still && "dmx-ripple-echo")}
            key={dot.id}
            style={
              {
                "--dmx-dot-fill": dot.color,
                "--dmx-ripple-parity": dot.parity,
                "--dmx-ripple-ring": dot.ring,
                height: STRIP_DOT,
                width: STRIP_DOT,
                ...(still
                  ? { opacity: 0.2 + (1 - dot.ring / STRIP_RINGS) * 0.72 }
                  : {}),
              } as CSSProperties
            }
          />
        ))}
      </span>
    </span>
  );
}

export function Thinking({
  label,
  now,
  shimmer = false,
  startedAt,
}: {
  label: string | null;
  now: number;
  shimmer?: boolean;
  startedAt: number | null;
}) {
  return (
    <Marker className="min-w-0 items-baseline text-xs">
      <ThinkingMark className="shrink-0 self-center" />
      <MarkerContent
        className={cn("min-w-0 truncate", shimmer && "shimmer")}
        title={label ?? "Thinking…"}
      >
        {label ?? "Thinking…"}
      </MarkerContent>
      {startedAt === null ? null : (
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
          {runningTime(startedAt, now)}
        </span>
      )}
    </Marker>
  );
}
