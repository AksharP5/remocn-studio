"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  PreviewRect,
  PreviewWindow,
  TuningTarget,
} from "@/lib/studio/preview";
import type {
  CodeEdit,
  CodeTargetStatus,
  PromptElement,
  TuningValue,
  VideoConfigValues,
} from "@/shared/ipc";

export interface SelectionTuning {
  assetBase: string | null;
  assets: readonly string[];
  fonts: readonly string[];
  open: number;
  originals: Readonly<Record<string, Readonly<Record<string, TuningValue>>>>;
  statuses: Readonly<Record<string, CodeTargetStatus>>;
  targets: readonly TuningTarget[];
  text: string | null;
  video: VideoConfigValues | null;
  window: PreviewWindow | null;
}

export interface Selection {
  element: PromptElement;
  id: string;
  rect: PreviewRect;
  stale: boolean;
  tuning: SelectionTuning | null;
  /** The codemod edits this chip carries, run when the message is sent. */
  writes: readonly CodeEdit[];
}

export interface Added {
  id: string;
  index: number;
}

export interface Selections {
  add: (
    element: PromptElement,
    rect: PreviewRect,
    tuning?: SelectionTuning | null,
    writes?: readonly CodeEdit[]
  ) => Added;
  clear: () => void;
  items: Selection[];
  markStale: () => void;
  removeAt: (index: number) => void;
  restore: (elements: readonly PromptElement[]) => void;
}

const OFF_FRAME: PreviewRect = { height: 0, width: 0, x: 0, y: 0 };

export function useSelections(): Selections {
  const [items, setItems] = useState<Selection[]>([]);
  const held = useRef<Selection[]>([]);
  const minted = useRef(0);

  const commit = useCallback((next: Selection[]) => {
    held.current = next;
    setItems(next);
  }, []);

  const add = useCallback(
    (
      element: PromptElement,
      rect: PreviewRect,
      tuning: SelectionTuning | null = null,
      writes: readonly CodeEdit[] = []
    ): Added => {
      minted.current += 1;
      const id = `selection-${minted.current}`;
      commit([
        ...held.current,
        { element, id, rect, stale: false, tuning, writes },
      ]);
      return { id, index: held.current.length - 1 };
    },
    [commit]
  );

  const removeAt = useCallback(
    (index: number) => {
      commit(held.current.filter((_, at) => at !== index));
    },
    [commit]
  );

  const clear = useCallback(() => commit([]), [commit]);

  const markStale = useCallback(() => {
    commit(
      held.current.map((item) =>
        item.tuning === null ? item : { ...item, stale: true }
      )
    );
  }, [commit]);

  const restore = useCallback(
    (elements: readonly PromptElement[]) => {
      commit(
        elements.map((element) => {
          minted.current += 1;
          return {
            element,
            id: `selection-${minted.current}`,
            rect: OFF_FRAME,
            stale: false,
            tuning: null,
            writes: [],
          };
        })
      );
    },
    [commit]
  );

  return useMemo(
    () => ({ add, clear, items, markStale, removeAt, restore }),
    [add, clear, items, markStale, removeAt, restore]
  );
}
