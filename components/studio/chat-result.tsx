"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { OpenTurn } from "@/hooks/use-open-turn";
import type { PreviewControl } from "@/hooks/use-preview";
import { seekCommand } from "@/lib/studio/preview";
import { useStudio, useStudioTurn } from "./studio-provider";

/** A server URL alone does not mean the rebuilt composition has mounted. */
export function ChatResult() {
  const { tools, docs, isPreviewShown, togglePreview } = useStudio();
  const turn = useStudioTurn();
  const { preview } = tools;
  const show = useCallback(() => {
    docs.pickMode("preview");
    if (!isPreviewShown) {
      togglePreview();
    }
  }, [docs, isPreviewShown, togglePreview]);
  return (
    <ChatResultLink
      key={preview.composition}
      onOpenPreview={show}
      preview={preview}
      turn={turn}
    />
  );
}

export function ChatResultLink({
  preview,
  turn,
  onOpenPreview,
}: {
  preview: PreviewControl;
  turn: Pick<
    OpenTurn,
    "entries" | "isRunning" | "turnError" | "permission" | "source"
  >;
  onOpenPreview: () => void;
}) {
  const request = turn.entries.findLast((entry) => entry.kind === "user");
  const [loaded, setLoaded] = useState<string | null>(null);
  const [rebuilt, setRebuilt] = useState<string | null>(null);
  const requestId = request?.id ?? null;

  useEffect(
    () =>
      preview.subscribe((message) => {
        if (message.type === "rebuilt") {
          setLoaded(null);
          setRebuilt(requestId);
        }
        if (message.type === "composition") {
          setLoaded(
            message.metadata !== null &&
              message.trouble === null &&
              message.compositionId === preview.composition
              ? requestId
              : null
          );
        }
      }),
    [preview.subscribe, preview.composition, requestId]
  );

  const target = request?.elements.find(
    (element) => element.composition === preview.composition && element.fps > 0
  );
  const open = useCallback(() => {
    onOpenPreview();
    if (target && preview.pick?.metadata) {
      preview.send(
        seekCommand(
          Math.max(
            0,
            Math.min(
              Math.round(
                (target.frame / target.fps) * preview.pick.metadata.fps
              ),
              preview.pick.metadata.durationInFrames - 1
            )
          )
        )
      );
    }
  }, [onOpenPreview, target, preview]);

  if (
    !requestId ||
    turn.isRunning ||
    turn.turnError !== null ||
    turn.permission !== null ||
    turn.source !== null ||
    rebuilt !== requestId ||
    loaded !== requestId ||
    preview.preview.phase !== "ready" ||
    turn.entries.at(-1)?.kind !== "assistant"
  ) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-muted-foreground text-xs">
      <span>Updated preview ready</span>
      <Button onClick={open} size="xs" variant="ghost">
        {target ? "View change" : "View preview"}
      </Button>
    </div>
  );
}
