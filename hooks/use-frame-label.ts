"use client";

import { useLayoutEffect, useRef } from "react";
import type { OpenTurn } from "@/hooks/use-open-turn";
import {
  insetsOf,
  type PreviewCameraControl,
} from "@/hooks/use-preview-camera";
import { frameLabelOf } from "@/lib/studio/preview-camera";

export type FrameCamera = Pick<
  PreviewCameraControl,
  "bounds" | "frameSize" | "view" | "viewport"
>;

export interface FrameChrome {
  inspector: boolean;
  rulers: boolean;
}

export function isTurnWorking(
  turn: Pick<OpenTurn, "isRunning" | "permission" | "source">
): boolean {
  return turn.isRunning && turn.permission === null && turn.source === null;
}

export function useFrameLabel(camera: FrameCamera, chrome: FrameChrome) {
  const label = useRef<HTMLDivElement>(null);
  const { bounds, frameSize, view, viewport } = camera;
  const { inspector, rulers } = chrome;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the rulers and the inspector are what cover the canvas's edges, so they are the measure's trigger
  useLayoutEffect(() => {
    const node = label.current;
    if (!node) {
      return;
    }
    const insets = insetsOf(viewport.current, 0);
    let placed = "";
    const place = () => {
      const spot = frameLabelOf(view.current(), frameSize, bounds, insets);
      node.hidden = spot === null;
      if (spot === null) {
        return;
      }
      const transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
      const maxWidth = `${Math.floor(spot.maxWidth)}px`;
      if (`${transform} ${maxWidth}` !== placed) {
        placed = `${transform} ${maxWidth}`;
        node.style.transform = transform;
        node.style.maxWidth = maxWidth;
      }
    };
    place();
    return view.subscribe(place);
  }, [bounds, frameSize, inspector, rulers, view, viewport]);

  return label;
}
