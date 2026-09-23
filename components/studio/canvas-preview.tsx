"use client";

import { CameraIcon, HandIcon, MinusIcon, PanelRightCloseIcon, PanelRightOpenIcon, PlusIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { type CSSProperties, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useNativePreview } from "@/hooks/use-native-preview";
import { usePreviewCamera } from "@/hooks/use-preview-camera";
import { usePreviewTransport } from "@/hooks/use-preview-transport";
import { cn } from "@/lib/utils";
import { DOCK_SURFACE } from "./dock-layout";
import { ExportButton } from "./export-button";
import { InspectOverlay } from "./inspect-overlay";
import { PreviewControls } from "./preview-controls";
import { useStudio } from "./studio-provider";

const PropsPane = dynamic(() => import("./props-pane").then((module) => module.PropsPane));

type Rect = { x: number; y: number; width: number; height: number };

export function CanvasPreview({ header, hidden, status }: { header: React.ReactNode; hidden: boolean; status: React.ReactNode }) {
  const { tools, activeProject, openedProject } = useStudio();
  const { inspect, managed, preview } = tools;
  const [inspector, setInspector] = useState(true);
  const hasSelection = Boolean(managed?.isOpen || inspect.card?.tuning);
  const metadata = preview.pick?.metadata ?? null;
  const transport = usePreviewTransport(preview, !hidden);
  const identity = activeProject ? `${activeProject.id}:${preview.composition}` : null;
  const camera = usePreviewCamera(metadata, identity, inspector, transport.toggle);
  const native = useNativePreview(preview, camera.viewport, managed?.acceptsPreview);
  const failure = preview.preview.phase === "failed" ? preview.preview.message
    : preview.preview.phase === "ready" && native.state.phase === "failed" ? native.state.message : null;
  const unavailable = activeProject === null ? "Open a project to preview your video."
    : preview.preview.phase !== "ready" ? "Preparing the project…"
    : native.state.phase === "loading" ? "Preparing the canvas…"
    : preview.hint ?? (metadata === null ? "Loading the video…" : null);
  const stale = native.state.phase === "ready" ? native.state.stale : null;
  const mapRect = (rect: Rect): Rect => {
    const width = camera.bounds.width || 1;
    const height = camera.bounds.height || 1;
    const videoWidth = (metadata?.width ?? 0) * camera.camera.zoom;
    const videoHeight = (metadata?.height ?? 0) * camera.camera.zoom;
    return {
      x: (camera.camera.x + rect.x * videoWidth) / width,
      y: (camera.camera.y + rect.y * videoHeight) / height,
      width: rect.width * videoWidth / width,
      height: rect.height * videoHeight / height,
    };
  };

  return <section
    aria-label="Canvas preview"
    className={cn("relative isolate flex min-h-0 flex-1 overflow-hidden bg-background [&:fullscreen]:h-screen", hidden && "hidden")}
    ref={transport.surface}
    style={{ "--canvas-inspector-width": inspector ? "min(340px, calc(100% - 24px))" : "0px" } as CSSProperties}
  >
    <div
      aria-label="Video canvas. Click to select; double-click text to edit. Space and drag to pan; pinch to zoom; K to play."
      className="relative min-h-0 flex-1 touch-none overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      ref={camera.viewport}
      style={{ cursor: camera.cursor }}
      tabIndex={0}
    >
      <div className="absolute top-0 left-0 origin-top-left bg-black shadow-lg"
        style={{ width: metadata?.width ?? 1920, height: metadata?.height ?? 1080, transform: camera.transform, visibility: metadata && !failure ? "visible" : "hidden" }}>
        <div ref={native.stage} style={{ position: "relative", width: "100%", height: "100%" }} />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10" ref={native.overlays} style={{ clipPath: "inset(0)" }} />

      {managed?.isOpen ? null : <InspectOverlay
        card={inspect.card ? { ...inspect.card, rect: mapRect(inspect.card.rect) } : null}
        cwd={openedProject?.path ?? null}
        markers={inspect.markers.map((marker) => ({ ...marker, rect: mapRect(marker.rect) }))}
        onCancel={inspect.cancelComment}
        onSubmit={inspect.submitComment}
      />}

      <div className="absolute top-0 left-0 z-20" data-canvas-chrome style={{ right: "var(--canvas-inspector-width)" }}>
        {header}
      </div>

      <div className="absolute top-12 left-4 z-20 flex items-center gap-1 rounded-lg border border-border bg-field p-1" data-canvas-chrome>
        <Button aria-label="Pan tool" aria-pressed={camera.hand} onClick={() => camera.setHand(!camera.hand)} size="icon-sm" variant={camera.hand ? "secondary" : "ghost"}><HandIcon /></Button>
        <Button onClick={camera.fit} size="sm" variant="ghost" disabled={!metadata}>Fit</Button>
        <Button aria-label="Zoom out" onClick={() => camera.zoomTo(camera.camera.zoom / 1.2)} size="icon-sm" variant="ghost"><MinusIcon /></Button>
        <Button aria-label="Zoom to 100%" className="w-14 tabular-nums" onClick={() => camera.zoomTo(1)} size="sm" variant="ghost">{Math.round(camera.camera.zoom * 100)}%</Button>
        <Button aria-label="Zoom in" onClick={() => camera.zoomTo(camera.camera.zoom * 1.2)} size="icon-sm" variant="ghost"><PlusIcon /></Button>
      </div>

      <aside
        aria-label="Inspector"
        className={cn("absolute inset-y-0 right-0 z-20 flex w-[340px] max-w-[calc(100%_-_24px)] flex-col overflow-hidden border-l border-pane-border bg-background", !inspector && "hidden")}
        data-canvas-chrome
      >
        <div className="flex h-10 shrink-0 items-center gap-1 px-4">
          <h2 className="min-w-0 flex-1 font-medium text-xs">Inspect</h2>
          <Button
            aria-disabled={!tools.snapshot.canSnapshot}
            aria-label="Snapshot"
            aria-pressed={tools.snapshot.isArmed}
            className="aria-disabled:opacity-50"
            onClick={tools.snapshot.toggle}
            size="icon-sm"
            title={tools.snapshot.unavailable ?? "Capture the frame, or part of it"}
            variant={tools.snapshot.isArmed ? "secondary" : "ghost"}
          >
            {tools.snapshot.isBusy ? <Spinner aria-hidden="true" className="size-4" /> : <CameraIcon />}
          </Button>
          <ExportButton composition={preview.composition} exporting={tools.exporting} />
          <Button aria-label="Hide inspector" onClick={() => setInspector(false)} size="icon-sm" title="Hide inspector" variant="ghost">
            <PanelRightCloseIcon />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {hasSelection ? <PropsPane /> : <div className="flex min-h-0 flex-1 flex-col overflow-auto text-xs">
            <div className="p-4">
              <h3 className="truncate font-medium" title={preview.composition ?? undefined}>{preview.composition ?? "Video"}</h3>
              {metadata ? <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 tabular-nums">
                <dt className="text-muted-foreground">Dimensions</dt><dd className="text-right">{metadata.width} × {metadata.height}</dd>
                <dt className="text-muted-foreground">Frame rate</dt><dd className="text-right">{metadata.fps} fps</dd>
                <dt className="text-muted-foreground">Duration</dt><dd className="text-right">{transport.duration}</dd>
              </dl> : null}
            </div>
            <p className="px-4 pb-4 text-muted-foreground">{metadata ? "Select an element on the canvas to edit its properties." : "Select a video to see its properties."}</p>
          </div>}
        </div>
      </aside>

      {!inspector ? <Button
        aria-label="Show inspector"
        aria-expanded={false}
        className="absolute top-12 right-4 z-20 border border-border bg-field"
        data-canvas-chrome
        onClick={() => setInspector(true)}
        size="icon-sm"
        title="Show inspector"
        variant="outline"
      ><PanelRightOpenIcon /></Button> : null}

      {stale && !failure && !unavailable ? <div className="pointer-events-none absolute top-24 left-0 z-20 flex justify-center px-4" style={{ right: "var(--canvas-inspector-width)" }}>
        <p className="max-w-sm rounded-md border bg-popover px-3 py-1.5 text-muted-foreground text-xs" role="status">{stale}</p>
      </div> : null}

      {failure || unavailable ? <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex items-center justify-center p-10" style={{ right: "var(--canvas-inspector-width)" }}>
        <div className="pointer-events-auto max-w-sm rounded-lg border bg-popover p-4 text-center text-sm" data-canvas-chrome role={failure ? "alert" : "status"}>
          <p>{failure ?? unavailable}</p>
          {failure ? <div className="mt-3 flex justify-center gap-2">
            <Button onClick={native.retry} size="sm" variant="outline">Retry</Button>
            <Button onClick={preview.restart} size="sm" variant="ghost">Restart preview</Button>
          </div> : null}
        </div>
      </div> : null}

      <div className={cn(DOCK_SURFACE, "absolute bottom-4 left-4 z-20 flex flex-col p-[11px]")} data-canvas-chrome style={{ right: "calc(var(--canvas-inspector-width) + 16px)" }}>
        <PreviewControls transport={transport} playShortcut="K" status={status} />
      </div>
    </div>
  </section>;
}
