"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Composer } from "@/hooks/use-composer";
import { type Exporting, useExport } from "@/hooks/use-export";
import { type Inspection, useInspect } from "@/hooks/use-inspect";
import { type PreviewControl, useOnPreview } from "@/hooks/use-preview";
import { type Snapshot, useSnapshot } from "@/hooks/use-snapshot";
import type { PreviewMessage } from "@/lib/studio/preview";

type Tool = "inspect" | "snapshot" | null;

export interface Tools {
  exporting: Exporting;
  inspect: Inspection;
  preview: PreviewControl;
  snapshot: Snapshot;
}

export interface ToolSettings {
  composer: Composer;
  isDocs: boolean;
  isLocked?: boolean;
  isMissing: boolean;
  isShown: boolean;
  isWaiting: boolean;
  lockedReason?: string;
  onArm?: () => void;
  openedProjectId: string | null;
  preview: PreviewControl;
  previewProjectId: string | null;
  projectPath?: string;
  writeProjectId?: string | null;
}

export function useTools({
  composer,
  isDocs,
  isLocked = false,
  lockedReason = PRO_ONLY,
  isMissing,
  isShown,
  isWaiting,
  onArm,
  openedProjectId,
  preview,
  previewProjectId,
  projectPath,
  writeProjectId = null,
}: ToolSettings): Tools {
  const [tool, setTool] = useState<Tool>(null);

  const unavailable = unavailableOf({
    isDocs,
    isLocked,
    isMissing,
    isServing: preview.isServing,
    isShown,
    isWaiting,
    lockedReason,
    openedProjectId,
    previewProjectId,
  });

  useEffect(() => {
    if (unavailable !== null) {
      setTool(null);
    }
  }, [unavailable]);

  const onMessage = useCallback((message: PreviewMessage) => {
    if (message.type === "rebuilt") {
      setTool(null);
    }
  }, []);

  useOnPreview(preview, onMessage);

  // On Free the buttons are the way to the trial card: a click arms nothing
  // and brings the invite back, which is what `onArm` does on Free anyway.
  const toggleInspect = useCallback(() => {
    if (isLocked) {
      onArm?.();
      return;
    }
    if (unavailable !== null) {
      return;
    }
    if (tool !== "inspect") {
      onArm?.();
    }
    setTool(tool === "inspect" ? null : "inspect");
  }, [isLocked, onArm, tool, unavailable]);

  const toggleSnapshot = useCallback(() => {
    if (isLocked) {
      onArm?.();
      return;
    }
    if (unavailable !== null) {
      return;
    }
    if (tool !== "snapshot") {
      onArm?.();
    }
    setTool(tool === "snapshot" ? null : "snapshot");
  }, [isLocked, onArm, tool, unavailable]);

  // The comment card and the composer answer Escape themselves and prevent the
  // default; anything they left alone disarms the mode.
  useEffect(() => {
    if (tool === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        setTool(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tool]);

  const inspect = useInspect({
    composer,
    isArmed: tool === "inspect",
    preview,
    projectId: writeProjectId,
    toggle: toggleInspect,
    unavailable,
  });

  const snapshot = useSnapshot({
    composer,
    isArmed: tool === "snapshot",
    preview,
    projectId: previewProjectId,
    toggle: toggleSnapshot,
    unavailable,
  });

  const exporting = useExport({
    composition: preview.composition,
    isServing: preview.isServing,
    openedProjectId,
    projectId: previewProjectId,
    projectPath,
  });

  return useMemo(
    () => ({ exporting, inspect, preview, snapshot }),
    [exporting, inspect, preview, snapshot]
  );
}

export const PRO_ONLY =
  "Inspect and Snapshot are part of Pro. Sign in to start the free trial.";

export const PRO_ONLY_UPGRADE =
  "Inspect and Snapshot are part of Pro. Upgrade to keep them.";

function unavailableOf(state: {
  isDocs: boolean;
  isLocked: boolean;
  isMissing: boolean;
  isServing: boolean;
  lockedReason: string;
  isShown: boolean;
  isWaiting: boolean;
  openedProjectId: string | null;
  previewProjectId: string | null;
  projectPath?: string;
}): string | null {
  if (state.isLocked) {
    return state.lockedReason;
  }
  if (!state.isShown) {
    return "The preview pane is hidden.";
  }
  // Moving to Docs disarms whatever was armed, down the same path a rebuild
  // takes: the tools point at pixels that are no longer on screen.
  if (state.isDocs) {
    return "The pane is showing the documents.";
  }
  if (state.openedProjectId === null) {
    return "Open a project to work on its preview.";
  }
  if (state.isMissing) {
    return "The project folder is not on disk anymore.";
  }
  if (state.isWaiting) {
    return "Answer the approval request first.";
  }
  if (!state.isServing) {
    return "The preview is not running yet.";
  }
  if (state.openedProjectId !== state.previewProjectId) {
    return "The preview is showing a different project than this session.";
  }
  return null;
}
