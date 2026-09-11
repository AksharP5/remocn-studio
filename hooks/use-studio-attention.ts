"use client";

import { useCallback, useMemo } from "react";
import { useAttention } from "@/hooks/use-attention";
import { useDock } from "@/hooks/use-dock";
import type { ExportState } from "@/hooks/use-export";
import { useWindowFocus } from "@/hooks/use-window-focus";
import type { AttentionReading, NotifyEvent } from "@/lib/studio/attention";
import type { TurnState } from "@/lib/studio/turns";
import type { HistorySession, SidecarPhase, Video } from "@/shared/ipc";

export interface StudioAttentionSettings {
  readonly exportState: ExportState;
  readonly isEnabled: boolean;
  readonly isEventEnabled: (event: NotifyEvent) => boolean;
  readonly sessions: readonly HistorySession[];
  readonly sidecarPhase: SidecarPhase | "unknown";
  readonly turns: ReadonlyMap<string, TurnState>;
  readonly videos: readonly Video[];
}

export function useStudioAttention({
  exportState,
  isEnabled,
  isEventEnabled,
  sessions,
  sidecarPhase,
  turns,
  videos,
}: StudioAttentionSettings): void {
  const isFocused = useWindowFocus();

  const reading = useMemo<AttentionReading>(
    () => ({ exportPhase: exportState.phase, sidecarPhase, turns }),
    [exportState.phase, sidecarPhase, turns]
  );

  const videoNameOf = useCallback(
    (historyId: string) => {
      const session = sessions.find((row) => row.id === historyId);
      return (
        videos.find((video) => video.id === session?.videoId)?.name ?? null
      );
    },
    [sessions, videos]
  );

  const composition =
    exportState.phase === "idle" ? null : exportState.composition;
  const exportVideoName =
    videos.find((video) => video.compositionId === composition)?.name ?? null;

  useAttention({
    exportVideoName,
    isEnabled,
    isEventEnabled,
    isFocused,
    reading,
    videoNameOf,
  });

  useDock(
    {
      event: exportState.phase === "running" ? exportState.event : null,
      phase: exportState.phase,
    },
    turns
  );
}
