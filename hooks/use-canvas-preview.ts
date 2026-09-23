"use client";

import { useMemo } from "react";
import type { NativePreviewState } from "@/lib/studio/native-preview";
import type { PreviewComposition } from "@/lib/studio/preview";
import { useCanvasLayers } from "./use-canvas-layers";
import { useNativePreview } from "./use-native-preview";
import type { Preview, PreviewControl } from "./use-preview";
import { usePreviewCamera } from "./use-preview-camera";
import { usePreviewTransport } from "./use-preview-transport";
import type { Tools } from "./use-tools";

interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

type Metadata = NonNullable<PreviewComposition["metadata"]>;

function failureOf(served: Preview, state: NativePreviewState): string | null {
  if (served.phase === "failed") {
    return served.message;
  }
  if (served.phase === "ready" && state.phase === "failed") {
    return state.message;
  }
  return null;
}

function noticeOf(
  projectId: string | null,
  preview: PreviewControl,
  state: NativePreviewState,
  metadata: Metadata | null
): string | null {
  if (projectId === null) {
    return "Open a project to preview your video.";
  }
  const served = preview.preview;
  if (served.phase === "building") {
    return served.percent > 0
      ? `Building the project — ${served.percent}%`
      : "Starting the compiler…";
  }
  if (served.phase !== "ready") {
    return "Preparing the project…";
  }
  if (state.phase === "loading") {
    return "Preparing the canvas…";
  }
  if (preview.hint !== null) {
    return preview.hint;
  }
  return metadata === null ? "Loading the video…" : null;
}

function selectionOf(
  managed: Tools["managed"],
  card: Tools["inspect"]["card"]
): unknown {
  if (managed?.isOpen) {
    return `object:${managed.selected?.id ?? ""}`;
  }
  return card?.tuning ? card.element : null;
}

export function useCanvasPreview({
  hidden,
  projectId,
  tools,
}: {
  hidden: boolean;
  projectId: string | null;
  tools: Tools;
}) {
  const { inspect, managed, preview } = tools;
  const metadata = preview.pick?.metadata ?? null;
  const transport = usePreviewTransport(preview, !hidden);
  const camera = usePreviewCamera(
    metadata,
    projectId === null ? null : `${projectId}:${preview.composition}`,
    transport.toggle
  );
  const layers = useCanvasLayers({
    managed,
    preview,
    scenes: transport.scenes,
    seekTo: transport.seekTo,
    selection: selectionOf(managed, inspect.card),
    viewport: camera.viewport,
  });
  const native = useNativePreview(
    preview,
    camera.viewport,
    managed?.acceptsPreview
  );
  const failure = failureOf(preview.preview, native.state);
  const notice = noticeOf(projectId, preview, native.state, metadata);
  const stale = native.state.phase === "ready" ? native.state.stale : null;

  const { bounds } = camera;
  const view = camera.camera;
  const overlay = useMemo(() => {
    const scaleX = ((metadata?.width ?? 0) * view.zoom) / (bounds.width || 1);
    const scaleY = ((metadata?.height ?? 0) * view.zoom) / (bounds.height || 1);
    const onCanvas = (rect: Rect): Rect => ({
      height: rect.height * scaleY,
      width: rect.width * scaleX,
      x: view.x / (bounds.width || 1) + rect.x * scaleX,
      y: view.y / (bounds.height || 1) + rect.y * scaleY,
    });
    return {
      card:
        inspect.card === null
          ? null
          : { ...inspect.card, rect: onCanvas(inspect.card.rect) },
      markers: inspect.markers.map((marker) => ({
        ...marker,
        rect: onCanvas(marker.rect),
      })),
    };
  }, [bounds, inspect.card, inspect.markers, metadata, view]);

  return {
    camera,
    failure,
    hasSelection: selectionOf(managed, inspect.card) !== null,
    layers,
    metadata,
    native,
    notice,
    overlay,
    stale,
    transport,
  };
}
