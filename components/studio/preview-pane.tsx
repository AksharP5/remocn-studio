"use client";

import {
  CameraIcon,
  FileTextIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  MonitorPlayIcon,
  PanelRightCloseIcon,
  RotateCwIcon,
} from "lucide-react";
import { type RefObject, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Docs, PreviewMode } from "@/hooks/use-docs";
import type { Preview } from "@/hooks/use-preview";
import type { Snapshot } from "@/hooks/use-snapshot";
import type { Tools } from "@/hooks/use-tools";
import { exportLabel } from "@/lib/studio/export";
import { fileManagerName } from "@/lib/studio/platform";
import { cn } from "@/lib/utils";
import { DocsView } from "./docs-view";
import { ExportButton } from "./export-button";
import { InspectOverlay } from "./inspect-overlay";
import { Pane, PaneActions, PaneBody, PaneHeader } from "./pane";
import { PreviewSurface } from "./preview-controls";
import { useStudio } from "./studio-provider";

export function PreviewPane({ isBooting = false }: { isBooting?: boolean }) {
  const { activeProject, docs, openedProject, togglePreview, tools } =
    useStudio();
  const isDocs = docs.mode === "docs";
  const { inspect, snapshot } = tools;
  const { preview, stage } = tools.preview;

  return (
    <Pane>
      <PaneHeader data-tauri-drag-region>
        <ModeSwitch mode={docs.mode} onPick={docs.onPickMode} />
        <PaneActions>
          <PreviewActions isDocs={isDocs} tools={tools} />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Hide the preview"
                  className="text-muted-foreground"
                  onClick={togglePreview}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <PanelRightCloseIcon />
            </TooltipTrigger>
            <TooltipContent side="bottom">Hide the preview</TooltipContent>
          </Tooltip>
        </PaneActions>
      </PaneHeader>

      {isDocs ? <DocsView docs={docs} /> : null}

      {/* The preview is hidden, never unmounted: taking the iframe down would
          cost a page load and the frame the person was looking at every time
          they read a document. */}
      <PaneBody className={cn("gap-2 p-4", isDocs && "hidden")}>
        <PreviewSurface
          enabled={!isDocs && activeProject !== null}
          preview={tools.preview}
        >
          {activeProject === null ? (
            <NoFolder />
          ) : (
            <Stage isBooting={isBooting} preview={preview} stage={stage} />
          )}

          {tools.managed?.isOpen ||
          (inspect.card === null && inspect.markers.length === 0) ? null : (
            <InspectOverlay
              card={inspect.card}
              cwd={openedProject?.path ?? null}
              markers={inspect.markers}
              onCancel={inspect.cancelComment}
              onSubmit={inspect.submitComment}
            />
          )}
        </PreviewSurface>

        <StatusSlot
          projectPath={activeProject?.path ?? null}
          snapshot={snapshot}
          tools={tools}
        />
      </PaneBody>
    </Pane>
  );
}

/**
 * Snapshot leaves the header entirely in Docs — it points at
 * pixels that are not on screen — while Export stays, because a render already
 * running must not be hidden by looking at a document.
 *
 * `aria-disabled`, not `disabled`: a native disabled control fires no mouse
 * events, so the `title` explaining *why* it is off could never show, and the
 * button fell out of the tab order. The click handlers no-op while
 * unavailable.
 */
function PreviewActions({ isDocs, tools }: { isDocs: boolean; tools: Tools }) {
  const { exporting, snapshot } = tools;
  const { preview, restart } = tools.preview;

  if (isDocs) {
    return (
      <ExportButton
        composition={tools.preview.composition}
        exporting={exporting}
      />
    );
  }

  return (
    <>
      {preview.phase === "failed" ? (
        <Button onClick={restart} size="sm" variant="ghost">
          <RotateCwIcon />
          Restart
        </Button>
      ) : null}
      <Button
        aria-disabled={!snapshot.canSnapshot}
        aria-pressed={snapshot.isArmed}
        className="aria-disabled:opacity-50"
        onClick={snapshot.toggle}
        size="sm"
        title={snapshot.unavailable ?? "Capture the frame, or part of it"}
        variant={snapshot.isArmed ? "default" : "outline"}
      >
        {snapshot.isBusy ? (
          <Spinner
            aria-hidden="true"
            className="size-4"
            data-icon="inline-start"
          />
        ) : (
          <CameraIcon data-icon="inline-start" />
        )}
        Snapshot
      </Button>
      <ExportButton
        composition={tools.preview.composition}
        exporting={exporting}
      />
    </>
  );
}

/**
 * The frame's width derives from the container's height, so a status row
 * appearing in the flow would rescale the video. This slot keeps one row's
 * height reserved whether or not anything is being said.
 */
function StatusSlot({
  projectPath,
  snapshot,
  tools,
}: {
  projectPath: string | null;
  snapshot: Snapshot;
  tools: Tools;
}) {
  const { exporting, inspect } = tools;
  const { hint } = tools.preview;
  const trouble = inspect.trouble ?? snapshot.trouble;
  const quiet =
    trouble === null &&
    snapshot.status === null &&
    exporting.result === null &&
    exporting.trouble === null &&
    exporting.notices.length === 0 &&
    hint === null;

  return (
    <div className="flex min-h-9 shrink-0 flex-col justify-center gap-2">
      {trouble === null ? null : (
        /* A percent-encoded URL is one unbreakable word, and this block used
           to carry them: the text ran past the pane's right edge and off the
           window, clipped mid-token with no wrap and no scroll.
           `renderFailure` words those away, and this is the insurance for
           whatever a renderer says next. */
        <p
          className="max-h-24 shrink-0 overflow-auto text-center text-destructive text-xs [overflow-wrap:anywhere]"
          role="alert"
        >
          {trouble}
        </p>
      )}

      {snapshot.status === null ? null : (
        <p
          className="shrink-0 text-center text-muted-foreground text-xs"
          role="status"
        >
          {snapshot.status}
        </p>
      )}

      {exporting.result === null ? null : (
        <div
          className="flex shrink-0 items-center justify-center gap-2 text-xs"
          role="status"
        >
          <span className="text-muted-foreground">Exported</span>
          <span className="font-mono">
            {exportLabel(exporting.result, projectPath)}
          </span>
          <Button onClick={exporting.reveal} size="xs" variant="ghost">
            <FolderOpenIcon data-icon="inline-start" />
            Show in {fileManagerName()}
          </Button>
        </div>
      )}

      {exporting.notices.map((notice) => (
        <p
          className="shrink-0 text-center text-muted-foreground text-xs [overflow-wrap:anywhere]"
          key={notice}
          role="status"
        >
          {notice}
        </p>
      ))}

      {exporting.trouble === null ? null : (
        <pre
          className="max-h-32 shrink-0 overflow-auto whitespace-pre-wrap text-destructive text-xs"
          role="alert"
        >
          {exporting.trouble}
        </pre>
      )}

      {hint === null ? null : (
        <p className="shrink-0 text-center text-muted-foreground text-xs">
          {hint}
        </p>
      )}

      {quiet && tools.preview.isServing && !snapshot.isArmed ? (
        <p className="text-center text-muted-foreground text-xs">
          {inspect.unavailable ??
            (tools.managed?.editingText
              ? "Click outside to save · Esc to cancel"
              : inspect.card !== null || tools.managed?.isOpen
                ? "Double-click text to edit · Esc to clear selection"
                : "Click to select · Double-click text to edit")}
        </p>
      ) : null}
    </div>
  );
}

const MODES: readonly {
  icon: typeof MonitorPlayIcon;
  label: string;
  mode: PreviewMode;
}[] = [
  { icon: MonitorPlayIcon, label: "Preview", mode: "preview" },
  { icon: FileTextIcon, label: "Docs", mode: "docs" },
];

/**
 * The pane's two modes, said once. It replaces the title rather than joining
 * it: the switch already names what is on screen, and the header's four
 * actions leave no room for a word that repeats one of them.
 */
function ModeSwitch({
  mode,
  onPick,
}: {
  mode: PreviewMode;
  onPick: Docs["onPickMode"];
}) {
  return (
    <div className="flex h-8 shrink-0 items-stretch rounded-md bg-input/30 p-0.5 ring-1 ring-border ring-inset sm:h-7">
      {MODES.map(({ icon: Icon, label, mode: value }) => (
        <button
          aria-pressed={mode === value}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-sm px-2 font-medium text-xs outline-none transition-[color,background-color] duration-150 ease-out",
            "focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-1",
            mode === value
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          key={value}
          onClick={onPick}
          type="button"
          value={value}
        >
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}

function Stage({
  isBooting,
  preview,
  stage,
}: {
  readonly isBooting: boolean;
  readonly preview: Preview;
  readonly stage: RefObject<HTMLIFrameElement | null>;
}) {
  if (preview.phase === "ready") {
    return (
      <PreviewFrame
        isBooting={isBooting}
        key={preview.url}
        ref={stage}
        url={preview.url}
      />
    );
  }

  if (preview.phase === "failed") {
    return (
      <div className="h-full overflow-auto p-4">
        <pre className="whitespace-pre-wrap font-mono text-destructive text-xs leading-relaxed [overflow-wrap:anywhere]">
          {preview.message}
        </pre>
      </div>
    );
  }

  if (preview.phase === "building") {
    return (
      <Empty className="h-full p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner className="size-6" />
          </EmptyMedia>
          <EmptyTitle>Building the project</EmptyTitle>
          <EmptyDescription className="tabular-nums">
            {preview.percent > 0
              ? `Compiling — ${preview.percent}%`
              : "Starting the compiler."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Empty className="h-full p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MonitorPlayIcon />
        </EmptyMedia>
        <EmptyTitle>Preview not running</EmptyTitle>
        <EmptyDescription>
          The player starts once there is something to play.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function PreviewFrame({
  isBooting,
  ref,
  url,
}: {
  readonly isBooting: boolean;
  readonly ref: RefObject<HTMLIFrameElement | null>;
  readonly url: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const onLoad = useCallback(() => setIsLoaded(true), []);

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: load is the embedded document becoming paintable, not a user interaction
    <iframe
      allow="autoplay; fullscreen"
      className={cn(
        "h-full w-full border-0 opacity-0 transition-opacity duration-200 ease-[cubic-bezier(0.19,1,0.22,1)] motion-reduce:duration-150",
        isLoaded && "opacity-100",
        isBooting && "transition-none"
      )}
      onLoad={onLoad}
      ref={ref}
      src={url}
      title="Remotion preview"
    />
  );
}

function NoFolder() {
  return (
    <Empty className="h-full p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderPlusIcon />
        </EmptyMedia>
        <EmptyTitle>No project open</EmptyTitle>
        <EmptyDescription>
          The preview mirrors the project on disk.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
