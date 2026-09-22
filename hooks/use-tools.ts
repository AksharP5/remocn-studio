"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Composer } from "@/hooks/use-composer";
import { type Exporting, useExport } from "@/hooks/use-export";
import { type Inspection, useInspect } from "@/hooks/use-inspect";
import {
  type ManagedObjects,
  useManagedObjects,
} from "@/hooks/use-managed-objects";
import { type PreviewControl, useOnPreview } from "@/hooks/use-preview";
import { type Snapshot, useSnapshot } from "@/hooks/use-snapshot";
import {
  PREVIEW_COMMAND_SOURCE,
  type PreviewMessage,
} from "@/lib/studio/preview";

type Tool = "snapshot" | null;

export interface Tools {
  exporting: Exporting;
  inspect: Inspection;
  managed?: ManagedObjects;
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

  const managed = useManagedObjects({
    armed: false,
    enabled: !isLocked && openedProjectId === previewProjectId,
    inlineEnabled: unavailable === null && tool === null,
    preview,
    projectId: writeProjectId,
  });
  const openObjects = managed.open;
  const { send, stage } = preview;

  const toggleInspect = useCallback(() => {
    if (isLocked) {
      onArm?.();
      return;
    }
    if (unavailable !== null) {
      return;
    }
    setTool(null);
    openObjects();
    stage.current?.focus();
  }, [isLocked, onArm, openObjects, stage, unavailable]);

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

  const inspect = useInspect({
    composer,
    isArmed: unavailable === null && tool === null,
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

  const { cancelComment } = inspect;
  const closeObjects = managed.close;
  const dismiss = useCallback(() => {
    if (tool === "snapshot") {
      setTool(null);
      return;
    }
    send({ source: PREVIEW_COMMAND_SOURCE, type: "inspect.clear" });
    cancelComment();
    closeObjects();
  }, [cancelComment, closeObjects, send, tool]);

  const onMessage = useCallback(
    (message: PreviewMessage) => {
      if (message.type === "rebuilt") {
        setTool(null);
      } else if (message.type === "inspect.clear") {
        dismiss();
      }
    },
    [dismiss]
  );
  useOnPreview(preview, onMessage);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        document.fullscreenElement === null
      ) {
        dismiss();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss]);

  const exporting = useExport({
    composition: preview.composition,
    isServing: preview.isServing,
    managedPending:
      managed.pending +
      (managed.busy || managed.awaitingPreview || managed.editingText ? 1 : 0),
    metadata: preview.pick?.metadata ?? null,
    openedProjectId,
    projectId: previewProjectId,
    projectPath,
    selections: composer.selections.items,
  });

  return useMemo(
    () => ({ exporting, inspect, managed, preview, snapshot }),
    [exporting, inspect, preview, snapshot, managed]
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
