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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { CanvasLayers } from "@/hooks/use-canvas-layers";
import { useCanvasOverlay, useCanvasPreview } from "@/hooks/use-canvas-preview";
import {
  type PreviewCameraControl,
  transformOf,
  useCameraView,
} from "@/hooks/use-preview-camera";
import type { Tools } from "@/hooks/use-tools";
import { formatShortcut, SHORTCUTS } from "@/lib/studio/command-registry";
import type { LayerRow } from "@/lib/studio/layers";
import { cn } from "@/lib/utils";
import { CanvasRulers } from "./canvas-rulers";
import { CanvasWorking } from "./canvas-working";
import { DOCK_SURFACE } from "./dock-layout";
import { FailureText } from "./failure-text";
import { HintTooltip } from "./hint-tooltip";
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
  const { tools, activeProject, openedProject, openedVideo, settings } =
    useStudio();
  const canvas = useCanvasPreview({
    hidden,
    projectId: activeProject?.id ?? null,
    settings,
    tools,
  });
  const { camera, failure, metadata, native, rulers } = canvas;
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
        <CanvasStage
          camera={camera}
          metadata={metadata}
          nativeStage={native.stage}
          shown={shown}
        />

        <div
          className="pointer-events-none absolute inset-0 z-10 [clip-path:inset(0)]"
          ref={native.overlays}
        />

        <CanvasWorking overlays={native.overlays} />

        {tools.managed?.isOpen ? null : (
          <CanvasInspectOverlay
            camera={camera}
            cwd={openedProject?.path ?? null}
            inspect={tools.inspect}
            metadata={metadata}
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
          videoName={openedVideo?.name ?? null}
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

export function CanvasStage({
  camera,
  metadata,
  nativeStage,
  shown,
}: {
  camera: PreviewCameraControl;
  metadata: Metadata;
  nativeStage: Canvas["native"]["stage"];
  shown: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          "absolute top-0 left-0 origin-top-left bg-black shadow-lg transition-[opacity,visibility] duration-base ease-out",
          shown ? "visible opacity-100" : "invisible opacity-0",
          camera.outside === "hide" && "overflow-clip"
        )}
        ref={camera.stage}
        style={{
          height: metadata?.height ?? 1080,
          transform: transformOf(camera.view.current()),
          width: metadata?.width ?? 1920,
        }}
      >
        <div className="relative size-full" ref={nativeStage} />
      </div>

      {shown ? <CanvasSurround camera={camera} /> : null}
    </>
  );
}

function CanvasSurround({ camera }: { camera: PreviewCameraControl }) {
  const { grid, surround } = useCameraView(camera);

  return (
    <>
      {surround.map((rect) => (
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
      ))}

      {grid === null ? null : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-[6]"
          data-pixel-grid
          style={{
            backgroundImage: GRID,
            backgroundPosition: `${grid.offsetX}px ${grid.offsetY}px`,
            backgroundSize: `${grid.size}px ${grid.size}px`,
            height: grid.height,
            left: grid.x,
            top: grid.y,
            width: grid.width,
          }}
        />
      )}
    </>
  );
}

function CanvasInspectOverlay({
  camera,
  cwd,
  inspect,
  metadata,
}: {
  camera: PreviewCameraControl;
  cwd: string | null;
  inspect: Tools["inspect"];
  metadata: Metadata;
}) {
  const overlay = useCanvasOverlay(camera, inspect, metadata);

  return (
    <InspectOverlay
      card={overlay.card}
      cwd={cwd}
      markers={overlay.markers}
      onCancel={inspect.cancelComment}
      onSubmit={inspect.submitComment}
    />
  );
}

function ZoomReadout({ camera }: { camera: PreviewCameraControl }) {
  const { zoom } = useCameraView(camera).camera;

  return <>{Math.round(zoom * 100)}%</>;
}

function CanvasToolbar({ canvas }: { canvas: Canvas }) {
  const { camera, hasSelection, metadata, rulers } = canvas;
  const dimmed = camera.outside === "dim";

  return (
    <div className="absolute top-2 left-4 flex h-10 items-center">
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-field p-0.5">
        <HintTooltip
          label="Pan tool — or hold"
          render={
            <Button
              aria-label="Pan tool"
              aria-pressed={camera.hand}
              onClick={camera.toggleHand}
              size="icon-sm"
              variant={camera.hand ? "secondary" : "ghost"}
            />
          }
          shortcut="Space"
        >
          <HandIcon />
        </HintTooltip>
        <HintTooltip
          label="Fit"
          render={
            <Button
              disabled={metadata === null}
              onClick={camera.fit}
              size="sm"
              variant="ghost"
            />
          }
          shortcut="⇧1"
        >
          Fit
        </HintTooltip>
        <HintTooltip
          label="Zoom to selection"
          render={
            <Button
              aria-label="Zoom to selection"
              disabled={!hasSelection}
              onClick={camera.zoomToSelection}
              size="icon-sm"
              variant="ghost"
            />
          }
          shortcut="⇧2"
        >
          <FocusIcon />
        </HintTooltip>
        <HintTooltip
          label="Zoom out"
          render={
            <Button
              aria-label="Zoom out"
              onClick={camera.zoomOut}
              size="icon-sm"
              variant="ghost"
            />
          }
          shortcut="⌘−"
        >
          <MinusIcon />
        </HintTooltip>
        <HintTooltip
          label="Zoom to 100%"
          render={
            <Button
              aria-label="Zoom to 100%"
              className="w-14 tabular-nums"
              onClick={camera.zoomReset}
              size="sm"
              variant="ghost"
            />
          }
          shortcut="⌘0"
        >
          <ZoomReadout camera={camera} />
        </HintTooltip>
        <HintTooltip
          label="Zoom in"
          render={
            <Button
              aria-label="Zoom in"
              onClick={camera.zoomIn}
              size="icon-sm"
              variant="ghost"
            />
          }
          shortcut="⌘+"
        >
          <PlusIcon />
        </HintTooltip>
        <HintTooltip
          label={
            dimmed
              ? "Hide content outside the frame"
              : "Show content outside the frame"
          }
          render={
            <Button
              aria-label="Show content outside the frame"
              aria-pressed={dimmed}
              onClick={camera.toggleOutside}
              size="icon-sm"
              variant={dimmed ? "secondary" : "ghost"}
            />
          }
        >
          <SquareDashedIcon />
        </HintTooltip>
        <HintTooltip
          label={rulers.shown ? "Hide rulers" : "Show rulers"}
          render={
            <Button
              aria-label="Rulers"
              aria-pressed={rulers.shown}
              onClick={rulers.toggle}
              size="icon-sm"
              variant={rulers.shown ? "secondary" : "ghost"}
            />
          }
          shortcut="⇧R"
        >
          <RulerIcon />
        </HintTooltip>
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
  videoName,
}: {
  duration: string;
  hasSelection: boolean;
  layers: CanvasLayers;
  metadata: Metadata;
  tools: Tools;
  videoName: string | null;
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
            duration={duration}
            layers={layers}
            metadata={metadata}
            name={videoName}
          />
        ) : null}
        {!layers.enabled && layers.view === "layers" ? (
          <VideoDetails
            duration={duration}
            metadata={metadata}
            name={videoName}
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
      <HintTooltip
        label={firstView}
        render={
          <Button
            aria-label={firstView}
            aria-pressed={layers.active === "layers"}
            onClick={layers.onView}
            size="icon-lg"
            value="layers"
            variant={layers.active === "layers" ? "secondary" : "ghost"}
          />
        }
        side="left"
      >
        {layers.enabled ? (
          <LayersIcon className="size-5" />
        ) : (
          <InfoIcon className="size-5" />
        )}
      </HintTooltip>
      <HintTooltip
        label={
          hasSelection
            ? "Properties"
            : "Properties — select something on the canvas"
        }
        render={
          <Button
            aria-disabled={!hasSelection}
            aria-label="Properties"
            aria-pressed={layers.active === "properties"}
            className="aria-disabled:opacity-50"
            onClick={hasSelection ? layers.onView : undefined}
            size="icon-lg"
            value="properties"
            variant={layers.active === "properties" ? "secondary" : "ghost"}
          />
        }
        side="left"
      >
        <SlidersHorizontalIcon className="size-5" />
      </HintTooltip>
      <div className="mt-auto flex flex-col items-center gap-1.5">
        <HintTooltip
          label={snapshot.unavailable ?? "Capture the frame, or part of it"}
          render={
            <Button
              aria-disabled={!snapshot.canSnapshot}
              aria-label="Snapshot"
              aria-pressed={snapshot.isArmed}
              className="aria-disabled:opacity-50"
              onClick={snapshot.toggle}
              size="icon-lg"
              variant={snapshot.isArmed ? "secondary" : "ghost"}
            />
          }
          shortcut={formatShortcut(SHORTCUTS.snapshot)}
          side="left"
        >
          {snapshot.isBusy ? (
            <Spinner aria-hidden="true" className="size-5" />
          ) : (
            <CameraIcon className="size-5" />
          )}
        </HintTooltip>
        <HintTooltip
          label={layers.shown ? "Collapse inspector" : "Expand inspector"}
          render={
            <Button
              aria-expanded={layers.shown}
              aria-label={
                layers.shown ? "Collapse inspector" : "Expand inspector"
              }
              onClick={layers.toggle}
              size="icon-lg"
              variant="ghost"
            />
          }
          side="left"
        >
          {layers.shown ? (
            <PanelRightCloseIcon className="size-5" />
          ) : (
            <PanelRightOpenIcon className="size-5" />
          )}
        </HintTooltip>
      </div>
    </nav>
  );
}

const CanvasInspector = memo(InspectorPanel);

function VideoLayers({
  duration,
  layers,
  metadata,
  name,
}: {
  duration: string;
  layers: CanvasLayers;
  metadata: Metadata;
  name: string | null;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col text-xs">
      <h3
        className="truncate px-4 pt-3 pb-2 font-medium"
        title={name ?? undefined}
      >
        {name ?? "Video"}
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
    return layers.loading ? (
      <LayerSkeleton />
    ) : (
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

const SKELETON_ROWS = [
  { depth: 0, id: "a", width: "w-3/5" },
  { depth: 1, id: "b", width: "w-2/5" },
  { depth: 1, id: "c", width: "w-1/2" },
  { depth: 0, id: "d", width: "w-2/3" },
  { depth: 1, id: "e", width: "w-1/3" },
];

function LayerSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading objects" className="flex flex-col">
      {SKELETON_ROWS.map((row) => (
        <li
          className="flex h-7 items-center px-1.5"
          key={row.id}
          style={{ paddingInlineStart: `${row.depth * 12 + 30}px` }}
        >
          <Skeleton className={cn("h-3 rounded-sm", row.width)} />
        </li>
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
  duration,
  metadata,
  name,
}: {
  duration: string;
  metadata: Metadata;
  name: string | null;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto text-xs">
      <div className="p-4">
        <h3 className="truncate font-medium" title={name ?? undefined}>
          {name ?? "Video"}
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
  const { card, failure, stale } = canvas;

  if (card.shown === null) {
    return stale === null ? null : (
      <div className="pointer-events-none absolute top-24 right-(--canvas-inspector-width) left-0 z-20 flex justify-center px-4">
        <p
          className="surface-floating max-w-sm animate-fade-in px-3 py-1.5 text-muted-foreground text-xs"
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
        className="surface-floating pointer-events-auto w-72 max-w-full animate-fade-in p-4 text-center text-sm transition-opacity duration-fast ease-out data-leaving:opacity-0"
        data-canvas-chrome
        data-leaving={card.isLeaving ? "" : undefined}
        role={failure === null ? "status" : "alert"}
      >
        {failure === null ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center justify-center gap-2">
              <Spinner aria-hidden="true" className="size-3.5 shrink-0" />
              {card.shown}
            </p>
            {canvas.building ? (
              <Progress aria-label="Build progress" value={canvas.percent} />
            ) : null}
          </div>
        ) : (
          <>
            <FailureText
              align="center"
              fallback="The preview could not start."
              text={failure}
            />
            <div className="mt-3 flex justify-center gap-2">
              <Button onClick={canvas.native.retry} size="sm" variant="outline">
                Try again
              </Button>
              <Button onClick={restart} size="sm" variant="ghost">
                Restart preview
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
