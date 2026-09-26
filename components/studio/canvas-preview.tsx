"use client";

import {
  CameraIcon,
  ChevronRightIcon,
  ClapperboardIcon,
  FocusIcon,
  HandIcon,
  InfoIcon,
  LayersIcon,
  MinusIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PlusIcon,
  RulerIcon,
  SlidersHorizontalIcon,
  SquareDashedIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { type CSSProperties, memo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { CanvasLayers } from "@/hooks/use-canvas-layers";
import { useCanvasPreview } from "@/hooks/use-canvas-preview";
import type { Tools } from "@/hooks/use-tools";
import type { LayerRow } from "@/lib/studio/layers";
import { cn } from "@/lib/utils";
import { CanvasRulers } from "./canvas-rulers";
import { DOCK_SURFACE } from "./dock-layout";
import { InspectOverlay } from "./inspect-overlay";
import { PreviewControls } from "./preview-controls";
import { useStudio } from "./studio-provider";

const PropsPane = dynamic(() =>
  import("./props-pane").then((module) => module.PropsPane)
);

const DIMMED = "color-mix(in oklab, var(--background) 72%, transparent)";
const GRID_LINE = "color-mix(in oklab, var(--foreground) 22%, transparent)";
const GRID = `linear-gradient(to right, ${GRID_LINE} 1px, transparent 1px), linear-gradient(to bottom, ${GRID_LINE} 1px, transparent 1px)`;

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
  const { tools, activeProject, openedProject, settings } = useStudio();
  const canvas = useCanvasPreview({
    hidden,
    projectId: activeProject?.id ?? null,
    settings,
    tools,
  });
  const { camera, failure, metadata, native, overlay, rulers } = canvas;
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
          "--canvas-inspector-width": canvas.layers.shown
            ? "min(340px, calc(100% - 24px))"
            : "3rem",
          "--canvas-ruler": `${rulers.size}px`,
        } as CSSProperties
      }
    >
      <div
        aria-label="Video canvas. Click to select; double-click text to edit; arrow keys nudge the selection. Space and drag to pan; pinch to zoom; Shift 1 fits, Shift 2 zooms to the selection; Shift R shows or hides the rulers; K to play."
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

        {shown
          ? camera.surround.map((rect) => (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-[5]"
                key={rect.id}
                style={{
                  background:
                    camera.outside === "hide" ? "var(--background)" : DIMMED,
                  height: rect.height,
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                }}
              />
            ))
          : null}

        {shown && camera.grid !== null ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-[6]"
            data-pixel-grid
            style={{
              backgroundImage: GRID,
              backgroundPosition: `${camera.grid.offsetX}px ${camera.grid.offsetY}px`,
              backgroundSize: `${camera.grid.size}px ${camera.grid.size}px`,
              height: camera.grid.height,
              left: camera.grid.x,
              top: camera.grid.y,
              width: camera.grid.width,
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

        {rulers.shown ? <CanvasRulers rulers={rulers} /> : null}

        <div
          className="absolute top-(--canvas-ruler) right-(--canvas-inspector-width) left-(--canvas-ruler) z-20 pt-2"
          data-canvas-chrome
          data-canvas-occludes="top"
        >
          {header}
          <CanvasToolbar canvas={canvas} />
        </div>

        <CanvasInspector
          duration={canvas.transport.duration}
          hasSelection={canvas.hasSelection}
          layers={canvas.layers}
          metadata={metadata}
          tools={tools}
        />

        <CanvasNotices canvas={canvas} restart={tools.preview.restart} />

        <div
          className={cn(
            DOCK_SURFACE,
            "absolute right-[calc(var(--canvas-inspector-width)+16px)] bottom-4 left-[calc(var(--canvas-ruler)+16px)] z-20 flex min-h-0 flex-col p-[11px]"
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
  const { camera, hasSelection, metadata, rulers } = canvas;
  const dimmed = camera.outside === "dim";

  return (
    <div className="absolute top-2 left-4 flex h-10 items-center">
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-field p-0.5">
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
        <Button
          aria-label="Rulers"
          aria-pressed={rulers.shown}
          onClick={rulers.toggle}
          size="icon-sm"
          title={rulers.shown ? "Hide rulers (⇧R)" : "Show rulers (⇧R)"}
          variant={rulers.shown ? "secondary" : "ghost"}
        >
          <RulerIcon />
        </Button>
      </div>
    </div>
  );
}

function InspectorPanel({
  duration,
  hasSelection,
  layers,
  metadata,
  tools,
}: {
  duration: string;
  hasSelection: boolean;
  layers: CanvasLayers;
  metadata: Metadata;
  tools: Tools;
}) {
  const { snapshot } = tools;

  return (
    <aside
      aria-label="Inspector"
      className="absolute inset-y-0 right-0 z-20 flex w-(--canvas-inspector-width) flex-row-reverse overflow-hidden border-pane-border border-l bg-background"
      data-canvas-chrome
      data-canvas-occludes="right"
    >
      <InspectorBar
        hasSelection={hasSelection}
        layers={layers}
        snapshot={snapshot}
      />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col border-pane-border border-r",
          !layers.shown && "hidden"
        )}
      >
        {hasSelection && layers.view === "properties" ? <PropsPane /> : null}
        {layers.enabled && layers.view === "layers" ? (
          <VideoLayers
            composition={tools.preview.composition}
            duration={duration}
            layers={layers}
            metadata={metadata}
          />
        ) : null}
        {!layers.enabled && layers.view === "layers" ? (
          <VideoDetails
            composition={tools.preview.composition}
            duration={duration}
            metadata={metadata}
          />
        ) : null}
      </div>
    </aside>
  );
}

function InspectorBar({
  hasSelection,
  layers,
  snapshot,
}: {
  hasSelection: boolean;
  layers: CanvasLayers;
  snapshot: Tools["snapshot"];
}) {
  const firstView = layers.enabled ? "Layers" : "Video details";

  return (
    <nav
      aria-label="Inspector views"
      className="flex w-12 shrink-0 flex-col items-center gap-1.5 py-2"
    >
      <Button
        aria-label={firstView}
        aria-pressed={layers.active === "layers"}
        onClick={layers.onView}
        size="icon-lg"
        title={firstView}
        value="layers"
        variant={layers.active === "layers" ? "secondary" : "ghost"}
      >
        {layers.enabled ? (
          <LayersIcon className="size-5" />
        ) : (
          <InfoIcon className="size-5" />
        )}
      </Button>
      <Button
        aria-label="Properties"
        aria-pressed={layers.active === "properties"}
        disabled={!hasSelection}
        onClick={layers.onView}
        size="icon-lg"
        title={
          hasSelection
            ? "Properties"
            : "Properties — select something on the canvas"
        }
        value="properties"
        variant={layers.active === "properties" ? "secondary" : "ghost"}
      >
        <SlidersHorizontalIcon className="size-5" />
      </Button>
      <div className="mt-auto flex flex-col items-center gap-1.5">
        <Button
          aria-disabled={!snapshot.canSnapshot}
          aria-label="Snapshot"
          aria-pressed={snapshot.isArmed}
          className="aria-disabled:opacity-50"
          onClick={snapshot.toggle}
          size="icon-lg"
          title={snapshot.unavailable ?? "Capture the frame, or part of it"}
          variant={snapshot.isArmed ? "secondary" : "ghost"}
        >
          {snapshot.isBusy ? (
            <Spinner aria-hidden="true" className="size-5" />
          ) : (
            <CameraIcon className="size-5" />
          )}
        </Button>
        <Button
          aria-expanded={layers.shown}
          aria-label={layers.shown ? "Collapse inspector" : "Expand inspector"}
          onClick={layers.toggle}
          size="icon-lg"
          title={layers.shown ? "Collapse inspector" : "Expand inspector"}
          variant="ghost"
        >
          {layers.shown ? (
            <PanelRightCloseIcon className="size-5" />
          ) : (
            <PanelRightOpenIcon className="size-5" />
          )}
        </Button>
      </div>
    </nav>
  );
}

const CanvasInspector = memo(InspectorPanel);

function VideoLayers({
  composition,
  duration,
  layers,
  metadata,
}: {
  composition: string | null;
  duration: string;
  layers: CanvasLayers;
  metadata: Metadata;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col text-xs">
      <h3
        className="truncate px-4 pt-3 pb-2 font-medium"
        title={composition ?? undefined}
      >
        {composition ?? "Video"}
      </h3>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <LayerList layers={layers} />
      </div>
      {metadata === null ? null : (
        <p className="shrink-0 border-pane-border border-t px-4 py-2.5 text-muted-foreground tabular-nums">
          {metadata.width} × {metadata.height} · {metadata.fps} fps · {duration}
        </p>
      )}
    </div>
  );
}

function LayerList({ layers }: { layers: CanvasLayers }) {
  if (layers.error !== null) {
    return (
      <p className="px-2 py-1 text-destructive" role="alert">
        {layers.error}
      </p>
    );
  }
  if (layers.rows.length === 0) {
    return layers.loading ? null : (
      <p className="px-2 py-1 text-muted-foreground">
        This video has no editable objects. Select an element on the canvas to
        ask for changes to it.
      </p>
    );
  }
  return (
    <ul aria-label="Objects in this video" className="flex flex-col">
      {layers.visible.map((row) => (
        <LayerItem key={row.id} layers={layers} row={row} />
      ))}
    </ul>
  );
}

function LayerItem({ layers, row }: { layers: CanvasLayers; row: LayerRow }) {
  const open = layers.isOpen(row);
  const present = layers.isPresent(row);

  return (
    <li
      className="flex items-center"
      style={{ paddingInlineStart: `${row.depth * 12}px` }}
    >
      {row.hasChildren ? (
        <button
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${row.label}`}
          className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:bg-muted"
          onClick={layers.onToggle}
          type="button"
          value={row.id}
        >
          <ChevronRightIcon
            className={cn(
              "size-3.5 transition-transform duration-fast ease-out",
              open && "rotate-90"
            )}
          />
        </button>
      ) : (
        <span aria-hidden="true" className="size-6 shrink-0" />
      )}
      <button
        aria-current={row.id === layers.selectedId ? "true" : undefined}
        className={cn(
          "flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted aria-[current]:bg-muted aria-[current]:font-medium",
          row.isScene && "font-medium",
          !present && "text-muted-foreground/60"
        )}
        onBlur={layers.onLeave}
        onClick={layers.onSelect}
        onFocus={layers.onEnter}
        onPointerEnter={layers.onEnter}
        onPointerLeave={layers.onLeave}
        title={present ? row.label : `${row.label} — not in this frame`}
        type="button"
        value={row.id}
      >
        {row.isScene ? (
          <ClapperboardIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        ) : null}
        <span className="truncate">{row.label}</span>
      </button>
    </li>
  );
}

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
