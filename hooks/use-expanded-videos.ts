"use client";

import { Effect } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type StudioSettings, saveExpandedVideos } from "@/lib/studio/settings";

export interface ExpandedVideos {
  expandedVideos: ReadonlySet<string>;
  expandVideo: (videoId: string) => void;
  onToggleVideo: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function useExpandedVideos(
  settings: StudioSettings | null,
  activeVideoId: string | null
): ExpandedVideos {
  const [chosen, setChosen] = useState<readonly string[] | null>(null);
  const opened = useRef<string | null>(null);
  const stored = settings?.expandedVideos ?? [];
  const remembered = chosen ?? stored;

  const keep = useCallback((ids: readonly string[]) => {
    setChosen(ids);
    Effect.runFork(saveExpandedVideos(ids));
  }, []);

  const expandVideo = useCallback(
    (videoId: string) => {
      if (remembered.includes(videoId)) {
        return;
      }
      keep([...remembered, videoId]);
    },
    [keep, remembered]
  );

  const onToggleVideo = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const videoId = event.currentTarget.value;
      keep(
        remembered.includes(videoId)
          ? remembered.filter((id) => id !== videoId)
          : [...remembered, videoId]
      );
    },
    [keep, remembered]
  );

  useEffect(() => {
    if (activeVideoId === null || opened.current === activeVideoId) {
      return;
    }
    opened.current = activeVideoId;
    expandVideo(activeVideoId);
  }, [activeVideoId, expandVideo]);

  const expandedVideos = useMemo(() => new Set(remembered), [remembered]);

  return useMemo(
    () => ({ expandedVideos, expandVideo, onToggleVideo }),
    [expandVideo, expandedVideos, onToggleVideo]
  );
}
