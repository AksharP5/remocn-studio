"use client";

import {
  CameraIcon,
  FocusIcon,
  HandIcon,
  MinusIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PlusIcon,
  SquareDashedIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { type CSSProperties, memo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCanvasPreview } from "@/hooks/use-canvas-preview";
import type { Tools } from "@/hooks/use-tools";
import { cn } from "@/lib/utils";
import { DOCK_SURFACE } from "./dock-layout";
import { ExportButton } from "./export-button";
import { InspectOverlay } from "./inspect-overlay";
import { PreviewControls } from "./preview-controls";
import { useStudio } from "./studio-provider";

const PropsPane = dynamic(() =>
  import("./props-pane").then((module) => module.PropsPane)
);

const DIMMED = "color-mix(in oklab, var(--background) 72%, transparent)";

type Canvas = ReturnType<typeof useCanvasPreview>;
type Metadata = Canvas["metadata"];

export function CanvasPreview({
  header,
  hidden,
  status,
}: {
  header: ReactNode;
  hidden: boolean;
  status: ReactNode;
}) {
  const { tools, activeProject, openedProject } = useStudio();
  const canvas = useCanvasPreview({
    hidden,
    projectId: activeProject?.id ?? null,
    tools,
  });
  const { camera, failure, metadata, native, overlay } = canvas;
  const shown = metadata !== null && failure === null;

  return (
    <section
      aria-label="Canvas preview"
      className={cn(
        "relative isolate flex min-h-0 flex-1 overflow-hidden bg-background [&:fullscreen]:h-screen",
        hidden && "hidden"
      )}
      ref={canvas.transport.surface}
      style={
        {
          "--canvas-inspector-width": canvas.inspector
            ? "min(340px, calc(100% - 24px))"
            : "0px",
        } as CSSProperties
      }
    >
      <div
        aria-label="Video canvas. Click to select; double-click text to edit; arrow keys nudge the selection. Space and drag to pan; pinch to zoom; Shift 1 fits, Shift 2 zooms to the selection; K to play."
        className="relative min-h-0 flex-1 touch-none overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
        ref={camera.viewport}
        role="application"
        style={{ cursor: camera.cursor }}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the canvas is a keyboard-driven editing surface and must take focus for its shortcuts
        tabIndex={0}
      >
        <div
          className="absolute top-0 left-0 origin-top-left bg-black shadow-lg"
          style={{
            height: metadata?.height ?? 1080,
            transform: camera.transform,
            visibility: shown ? "visible" : "hidden",
            width: metadata?.width ?? 1920,
          }}
        >
          <div className="relative size-full" ref={native.stage} />
        </div>

        {shown ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-[5]"
            style={{
              ...camera.frame,
              boxShadow: `0 0 0 20000px ${camera.outside === "hide" ? "var(--background)" : DIMMED}`,
            }}
          />
        ) : null}

        <div
          className="pointer-events-none absolute inset-0 z-10 [clip-path:inset(0)]"
          ref={native.overlays}
        />

        {tools.managed?.isOpen ? null : (
          <InspectOverlay
            card={overlay.card}
            cwd={openedProject?.path ?? null}
            markers={overlay.markers}
            onCancel={tools.inspect.cancelComment}
            onSubmit={tools.inspect.submitComment}
          />
        )}

        <div
          className="absolute top-0 right-(--canvas-inspector-width) left-0 z-20"
          data-canvas-chrome
          data-canvas-occludes="top"
        >
          {header}
        </div>

        <CanvasToolbar canvas={canvas} />

        <CanvasInspector
          duration={canvas.transport.duration}
          hasSelection={canvas.hasSelection}
          hideInspector={canvas.hideInspector}
          metadata={metadata}
          shown={canvas.inspector}
          tools={tools}
        />

        {canvas.inspector ? null : (
          <Button
            aria-expanded={false}
            aria-label="Show inspector"
            className="absolute top-12 right-4 z-20 border border-border bg-field"
            data-canvas-chrome
            onClick={canvas.showInspector}
            size="icon-sm"
            title="Show inspector"
            variant="outline"
          >
            <PanelRightOpenIcon />
          </Button>
        )}

        <CanvasNotices canvas={canvas} restart={tools.preview.restart} />

        <div
          className={cn(
            DOCK_SURFACE,
            "absolute right-[calc(var(--canvas-inspector-width)+16px)] bottom-4 left-4 z-20 flex flex-col p-[11px]"
          )}
          data-canvas-chrome
          data-canvas-occludes="bottom"
        >
          <PreviewControls
            playShortcut="K"
            status={status}
            transport={canvas.transport}
          />
        </div>
      </div>
    </section>
  );
}

function CanvasToolbar({ canvas }: { canvas: Canvas }) {
  const { camera, hasSelection, metadata } = canvas;
  const dimmed = camera.outside === "dim";

  return (
    <div
      className="absolute top-12 left-4 z-20 flex items-center gap-1 rounded-lg border border-border bg-field p-1"
      data-canvas-chrome
      data-canvas-occludes="top"
    >
      <Button
        aria-label="Pan tool"
        aria-pressed={camera.hand}
        onClick={camera.toggleHand}
        size="icon-sm"
        variant={camera.hand ? "secondary" : "ghost"}
      >
        <HandIcon />
      </Button>
      <Button
        disabled={metadata === null}
        onClick={camera.fit}
        size="sm"
        title="Fit (⇧1)"
        variant="ghost"
      >
        Fit
      </Button>
      <Button
        aria-label="Zoom to selection"
        disabled={!hasSelection}
        onClick={camera.zoomToSelection}
        size="icon-sm"
        title="Zoom to selection (⇧2)"
        variant="ghost"
      >
        <FocusIcon />
      </Button>
      <Button
        aria-label="Zoom out"
        onClick={camera.zoomOut}
        size="icon-sm"
        title="Zoom out (⌘−)"
        variant="ghost"
      >
        <MinusIcon />
      </Button>
      <Button
        aria-label="Zoom to 100%"
        className="w-14 tabular-nums"
        onClick={camera.zoomReset}
        size="sm"
        title="Zoom to 100% (⌘0)"
        variant="ghost"
      >
        {Math.round(camera.camera.zoom * 100)}%
      </Button>
      <Button
        aria-label="Zoom in"
        onClick={camera.zoomIn}
        size="icon-sm"
        title="Zoom in (⌘+)"
        variant="ghost"
      >
        <PlusIcon />
      </Button>
      <Button
        aria-label="Show content outside the frame"
        aria-pressed={dimmed}
        onClick={camera.toggleOutside}
        size="icon-sm"
        title={
          dimmed
            ? "Hide content outside the frame"
            : "Show content outside the frame"
        }
        variant={dimmed ? "secondary" : "ghost"}
      >
        <SquareDashedIcon />
      </Button>
    </div>
  );
}

function InspectorPanel({
  duration,
  hasSelection,
  hideInspector,
  metadata,
  shown,
  tools,
}: {
  duration: string;
  hasSelection: boolean;
  hideInspector: () => void;
  metadata: Metadata;
  shown: boolean;
  tools: Tools;
}) {
  const { snapshot } = tools;

  return (
    <aside
      aria-label="Inspector"
      className={cn(
        "absolute inset-y-0 right-0 z-20 flex w-[340px] max-w-[calc(100%_-_24px)] flex-col overflow-hidden border-pane-border border-l bg-background",
        !shown && "hidden"
      )}
      data-canvas-chrome
      data-canvas-occludes="right"
    >
      <div className="flex h-10 shrink-0 items-center gap-1 px-4">
        <h2 className="min-w-0 flex-1 font-medium text-xs">Inspect</h2>
        <Button
          aria-disabled={!snapshot.canSnapshot}
          aria-label="Snapshot"
          aria-pressed={snapshot.isArmed}
          className="aria-disabled:opacity-50"
          onClick={snapshot.toggle}
          size="icon-sm"
          title={snapshot.unavailable ?? "Capture the frame, or part of it"}
          variant={snapshot.isArmed ? "secondary" : "ghost"}
        >
          {snapshot.isBusy ? (
            <Spinner aria-hidden="true" className="size-4" />
          ) : (
            <CameraIcon />
          )}
        </Button>
        <ExportButton
          composition={tools.preview.composition}
          exporting={tools.exporting}
        />
        <Button
          aria-label="Hide inspector"
          onClick={hideInspector}
          size="icon-sm"
          title="Hide inspector"
          variant="ghost"
        >
          <PanelRightCloseIcon />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {hasSelection ? (
          <PropsPane />
        ) : (
          <VideoDetails
            composition={tools.preview.composition}
            duration={duration}
            metadata={metadata}
          />
        )}
      </div>
    </aside>
  );
}

const CanvasInspector = memo(InspectorPanel);

function VideoDetails({
  composition,
  duration,
  metadata,
}: {
  composition: string | null;
  duration: string;
  metadata: Metadata;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto text-xs">
      <div className="p-4">
        <h3 className="truncate font-medium" title={composition ?? undefined}>
          {composition ?? "Video"}
        </h3>
        {metadata === null ? null : (
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 tabular-nums">
            <dt className="text-muted-foreground">Dimensions</dt>
            <dd className="text-right">
              {metadata.width} × {metadata.height}
            </dd>
            <dt className="text-muted-foreground">Frame rate</dt>
            <dd className="text-right">{metadata.fps} fps</dd>
            <dt className="text-muted-foreground">Duration</dt>
            <dd className="text-right">{duration}</dd>
          </dl>
        )}
      </div>
      <p className="px-4 pb-4 text-muted-foreground">
        {metadata === null
          ? "Select a video to see its properties."
          : "Select an element on the canvas to edit its properties."}
      </p>
    </div>
  );
}

function CanvasNotices({
  canvas,
  restart,
}: {
  canvas: Canvas;
  restart: () => void;
}) {
  const { failure, notice, stale } = canvas;
  const message = failure ?? notice;

  if (message === null) {
    return stale === null ? null : (
      <div className="pointer-events-none absolute top-24 right-(--canvas-inspector-width) left-0 z-20 flex justify-center px-4">
        <p
          className="max-w-sm rounded-md border bg-popover px-3 py-1.5 text-muted-foreground text-xs"
          role="status"
        >
          {stale}
        </p>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-y-0 right-(--canvas-inspector-width) left-0 z-30 flex items-center justify-center p-10">
      <div
        className="pointer-events-auto max-w-sm rounded-lg border bg-popover p-4 text-center text-sm"
        data-canvas-chrome
        role={failure === null ? "status" : "alert"}
      >
        <p>{message}</p>
        {failure === null ? null : (
          <div className="mt-3 flex justify-center gap-2">
            <Button onClick={canvas.native.retry} size="sm" variant="outline">
              Retry
            </Button>
            <Button onClick={restart} size="sm" variant="ghost">
              Restart preview
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
