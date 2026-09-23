"use client";

import { type MouseEvent, useCallback, useMemo, useRef, useState } from "react";
import type { PreviewScene } from "@/lib/studio/preview";
import { segmentsOf } from "@/lib/studio/seek-scenes";

export function useSeekScenes({
  frame,
  scenes,
  seekTo,
  totalFrames,
}: {
  frame: number;
  scenes: readonly PreviewScene[];
  seekTo: (frame: number) => void;
  totalFrames: number;
}) {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const measure = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (node === null) {
      return;
    }
    setWidth(node.clientWidth);
    const watcher = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });
    watcher.observe(node);
    observer.current = watcher;
  }, []);

  const segments = useMemo(
    () => segmentsOf(scenes, totalFrames, width),
    [scenes, totalFrames, width]
  );

  const onPick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      seekTo(Number(event.currentTarget.value)),
    [seekTo]
  );

  const current =
    segments.findLast((segment) => segment.from <= frame)?.id ?? null;

  return { current, measure, onPick, segments };
}
