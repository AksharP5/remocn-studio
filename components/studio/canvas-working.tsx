"use client";

import { memo, type RefObject } from "react";
import { useCanvasWorking } from "@/hooks/use-canvas-working";
import { useStudioTurn } from "./studio-provider";
import { ThinkingMark } from "./thinking";

const Mark = memo(ThinkingMark);

export function CanvasWorking({
  overlays,
}: {
  overlays: RefObject<HTMLElement | null>;
}) {
  const { mark, working } = useCanvasWorking(overlays, useStudioTurn());

  return working ? (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 [clip-path:inset(0)]"
      data-canvas-working
    >
      <span className="fixed flex -translate-y-1/2" hidden ref={mark}>
        <Mark />
      </span>
    </div>
  ) : null;
}
