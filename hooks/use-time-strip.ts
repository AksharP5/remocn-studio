"use client";

import type { ChangeEvent } from "react";
import { useCallback, useMemo } from "react";
import type { PreviewWindow } from "@/lib/studio/preview";

export const NO_WINDOW = "This element has no timed window";

export interface TimeStrip {
  canReplay: boolean;
  frame: number;
  label: string;
  max: number;
  min: number;
  onSeek: (event: ChangeEvent<HTMLInputElement>) => void;
  replay: () => void;
  span: PreviewWindow | null;
  tooltip: string;
}

export interface TimeStripSettings {
  frame: number;
  onReplay: () => void;
  onSeek: (frame: number) => void;
  span: PreviewWindow | null;
}

export function useTimeStrip({
  frame,
  onReplay,
  onSeek,
  span,
}: TimeStripSettings): TimeStrip {
  const seek = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onSeek(Number(event.currentTarget.value));
    },
    [onSeek]
  );

  return useMemo(() => {
    const canReplay = span !== null && span.until > span.from;

    return {
      canReplay,
      frame,
      label: labelOf(frame, span),
      max: span?.until ?? frame,
      min: span?.from ?? frame,
      onSeek: seek,
      replay: onReplay,
      span,
      tooltip: canReplay ? "Play this element's own window" : NO_WINDOW,
    };
  }, [frame, onReplay, seek, span]);
}

function labelOf(frame: number, span: PreviewWindow | null): string {
  return span === null
    ? `frame ${frame}`
    : `frame ${frame} · enters ${span.from}–${span.until}`;
}
