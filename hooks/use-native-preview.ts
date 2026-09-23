"use client";

import { Effect, Fiber } from "effect";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type NativePreviewState,
  runNativePreview,
  type StagedDocument,
} from "@/lib/studio/native-preview";
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision is the retry trigger; bumping it must remount the preview
  useEffect(() => {
    const element = stage.current;
    if (!(element && url && viewport.current && overlays.current)) {
      return;
    }
    let live = true;
    setState({ phase: "loading" });
    const fiber = Effect.runFork(
      runNativePreview({
        accepts: (document) => gate.current?.(document) ?? true,
        attach: attachSurface,
        onState: (next) => {
          if (live) {
            setState(next);
          }
        },
        overlays: overlays.current,
        stage: element,
        url,
        viewport: viewport.current,
      })
    );
    return () => {
      live = false;
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [attachSurface, revision, url, viewport]);

  return { overlays, retry, stage, state };
}
