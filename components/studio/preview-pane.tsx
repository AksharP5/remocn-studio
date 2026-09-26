"use client";

import {
  ArrowLeftIcon,
  FolderOpenIcon,
  PanelRightCloseIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Snapshot } from "@/hooks/use-snapshot";
import type { Tools } from "@/hooks/use-tools";
import { exportLabel } from "@/lib/studio/export";
import { fileManagerName } from "@/lib/studio/platform";
import { DocsView } from "./docs-view";
import { ExportButton } from "./export-button";
import { FailureText } from "./failure-text";
import { Pane, PaneActions, PaneHeader } from "./pane";
import { useStudio } from "./studio-provider";

const CanvasPreview = dynamic(() =>
  import("./canvas-preview").then((module) => module.CanvasPreview)
);

export function PreviewPane() {
  const { activeProject, docs, togglePreview, tools } = useStudio();
  const isDocs = docs.mode === "docs";

  const header = (
    <PaneHeader data-tauri-drag-region>
      {isDocs ? (
        <Button
          className="text-muted-foreground"
          onClick={docs.onPickMode}
          size="sm"
          value="preview"
          variant="ghost"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Preview
        </Button>
      ) : null}
      <PaneActions className="ms-auto">
        <ExportButton
          composition={tools.preview.composition}
          exporting={tools.exporting}
        />
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
  );

  return (
    <Pane>
      {isDocs ? header : null}

      {isDocs ? <DocsView docs={docs} /> : null}

      {/* The preview is hidden, never unmounted: taking the runtime down would
          cost a rebuild and the frame the person was looking at every time
          they read a document. */}
      <CanvasPreview
        header={isDocs ? null : header}
        hidden={isDocs}
        status={
          <StatusSlot
            projectPath={activeProject?.path ?? null}
            snapshot={tools.snapshot}
            tools={tools}
          />
        }
      />
    </Pane>
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
    <div className="flex min-h-8 shrink-0 flex-col justify-center gap-2">
      {trouble === null ? null : (
        /* A percent-encoded URL is one unbreakable word, and this block used
           to carry them: the text ran past the pane's right edge and off the
           window, clipped mid-token with no wrap and no scroll.
           `renderFailure` words those away, and this is the insurance for
           whatever a renderer says next. */
        <div className="max-h-32 shrink-0 overflow-auto">
          <FailureText
            align="center"
            className="text-center text-destructive text-xs [overflow-wrap:anywhere]"
            fallback="The preview could not do that."
            role="alert"
            text={trouble}
          />
        </div>
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
            canvasHint(
              tools.managed?.editingText === true,
              inspect.card !== null || tools.managed?.isOpen === true
            )}
        </p>
      ) : null}
    </div>
  );
}

function canvasHint(editingText: boolean, selecting: boolean) {
  if (editingText) {
    return "Click outside to save · Esc to cancel";
  }
  if (selecting) {
    return "Double-click text to edit · Esc to clear selection";
  }
  return "Click to select · Double-click text to edit";
}
