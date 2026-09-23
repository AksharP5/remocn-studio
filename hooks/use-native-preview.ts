"use client";

import { Effect, Fiber } from "effect";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { type NativePreviewState, runNativePreview, type StagedDocument } from "@/lib/studio/native-preview";
import type { PreviewControl } from "./use-preview";

export function useNativePreview(
  preview: PreviewControl,
  viewport: RefObject<HTMLDivElement | null>,
  accepts?: (document: StagedDocument | null) => boolean
) {
  const gate = useRef(accepts);
  gate.current = accepts;
  const stage = useRef<HTMLDivElement>(null);
  const overlays = useRef<HTMLDivElement>(null);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<NativePreviewState>({ phase: "loading" });
  const url = preview.preview.phase === "ready" ? preview.preview.url : null;
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  const { attachSurface } = preview;

  useEffect(() => {
    const element = stage.current;
    if (!element || !url || !attachSurface || !viewport.current || !overlays.current) return;
    let live = true;
    setState({ phase: "loading" });
    const fiber = Effect.runFork(runNativePreview({
      stage: element,
      url,
      viewport: viewport.current,
      overlays: overlays.current,
      attach: attachSurface,
      accepts: (document) => gate.current?.(document) ?? true,
      onState: (next) => { if (live) setState(next); },
    }));
    return () => {
      live = false;
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [attachSurface, revision, url, viewport]);

  return { stage, overlays, retry, state };
}
