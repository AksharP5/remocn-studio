"use client";

import { useCallback, useRef } from "react";
import { curvePoint } from "@/lib/studio/easing";

export type BezierHandle = 1 | 2;

function captured(element: Element, pointerId: number): boolean {
  try {
    element.setPointerCapture(pointerId);
    return true;
  } catch {
    return false;
  }
}

export function useBezierDrag(
  onMove: (handle: BezierHandle, x: number, y: number) => void
): {
  cancel: (event: React.PointerEvent<SVGSVGElement>) => void;
  down: (event: React.PointerEvent<SVGSVGElement>) => void;
  move: (event: React.PointerEvent<SVGSVGElement>) => void;
  up: (event: React.PointerEvent<SVGSVGElement>) => void;
} {
  const dragging = useRef<BezierHandle | null>(null);
  const moved = useRef(onMove);
  moved.current = onMove;

  const down = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const handle = (event.target as Element)
      .closest("[data-handle]")
      ?.getAttribute("data-handle");

    if (handle !== "1" && handle !== "2") {
      return;
    }

    dragging.current = handle === "1" ? 1 : 2;
    event.preventDefault();
    captured(event.currentTarget, event.pointerId);
  }, []);

  const move = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const handle = dragging.current;

    if (handle === null) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const point = curvePoint(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height
    );

    moved.current(handle, point.x, point.y);
  }, []);

  const up = useCallback(() => {
    dragging.current = null;
  }, []);

  return { cancel: up, down, move, up };
}
