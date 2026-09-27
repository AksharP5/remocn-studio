"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";
import type { OpenTurn } from "@/hooks/use-open-turn";
import { SELECTION_LABEL_ATTR } from "@/lib/studio/preview-camera";

const GAP = 4;
const WATCHED: MutationObserverInit = {
  attributeFilter: ["style"],
  characterData: true,
  childList: true,
  subtree: true,
};

type WorkingTurn = Pick<OpenTurn, "isRunning" | "permission" | "source">;

function shownLabel(root: HTMLElement): DOMRect | null {
  for (const label of root.querySelectorAll<HTMLElement>(
    `[${SELECTION_LABEL_ATTR}]`
  )) {
    const rect = label.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return rect;
    }
  }
  return null;
}

export function useCanvasWorking(
  overlays: RefObject<HTMLElement | null>,
  turn: WorkingTurn
) {
  const working =
    turn.isRunning && turn.permission === null && turn.source === null;
  const mark = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const root = overlays.current;
    const node = mark.current;
    if (!(working && root && node)) {
      return;
    }
    let placed = "";
    const place = () => {
      const rect = shownLabel(root);
      node.hidden = rect === null;
      if (rect === null) {
        return;
      }
      const left = `${rect.right + GAP}px`;
      const top = `${rect.top + rect.height / 2}px`;
      if (`${left} ${top}` !== placed) {
        placed = `${left} ${top}`;
        node.style.left = left;
        node.style.top = top;
      }
    };
    const observer = new MutationObserver(place);
    observer.observe(root, WATCHED);
    place();
    return () => {
      observer.disconnect();
      node.hidden = true;
    };
  }, [overlays, working]);

  return { mark, working };
}
