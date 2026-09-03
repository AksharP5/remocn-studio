"use client";

import { Effect, Exit } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastManager } from "@/components/ui/toast";
import { causeMessage } from "@/lib/error-message";
import type { VideoFormat } from "@/lib/studio/formats";
import { sizeOf } from "@/lib/studio/formats";
import {
  createVideo,
  listVideos,
  reconcileVideos,
  registerVideo,
  removeVideo,
  renameVideo,
  restoreVideo,
} from "@/lib/studio/projects";
import type { Video } from "@/shared/ipc";

export interface StudioVideos {
  activeVideo: Video | null;
  createVideo: (
    projectId: string,
    name: string,
    format: VideoFormat
  ) => Promise<Video | null>;
  isLoadingVideos: boolean;
  isVideosReady: boolean;
  reconcile: (projectId: string, compositions: readonly string[]) => void;
  registerVideo: (videoId: string) => Promise<boolean>;
  reloadVideos: () => void;
  removeVideo: (videoId: string) => Promise<boolean>;
  renameVideo: (videoId: string, name: string) => Promise<Video | null>;
  restoreVideo: (videoId: string) => Promise<Video | null>;
  selectVideo: (videoId: string) => void;
  videos: readonly Video[];
  videosError: string | null;
}

export function useVideos(projectId: string | null): StudioVideos {
  const [videos, setVideos] = useState<readonly Video[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const opened = useRef<string | null>(null);

  const load = useCallback((target: string) => {
    setIsLoadingVideos(true);

    Effect.runFork(
      listVideos(target).pipe(
        Effect.tap((rows) =>
          Effect.sync(() => {
            setVideos(rows);
            setVideosError(null);
            setActiveId((current) => current ?? rows.at(0)?.id ?? null);
          })
        ),
        Effect.catch((failure) =>
          Effect.sync(() => setVideosError(failure.message))
        ),
        Effect.ensuring(
          Effect.sync(() => {
            setLoadedProjectId(target);
            setIsLoadingVideos(false);
          })
        )
      )
    );
  }, []);

  useEffect(() => {
    opened.current = projectId;
    setActiveId(null);

    if (projectId === null) {
      setVideos([]);
      return;
    }

    load(projectId);
  }, [load, projectId]);

  const reloadVideos = useCallback(() => {
    if (projectId !== null) {
      load(projectId);
    }
  }, [load, projectId]);

  // The bundle answers seconds after the pane has already drawn, and it can
  // answer for a project the person has since left; the guard is what keeps
  // one project's compositions out of another's list.
  const reconcile = useCallback(
    (target: string, compositions: readonly string[]) => {
      Effect.runFork(
        reconcileVideos(target, compositions).pipe(
          Effect.tap((rows) =>
            Effect.sync(() => {
              if (opened.current !== target) {
                return;
              }
              setVideos(rows);
              setActiveId((current) => current ?? rows.at(0)?.id ?? null);
            })
          ),
          Effect.ignore
        )
      );
    },
    []
  );

  // The project is an argument rather than the prop, because a video is
  // created in the same tick a project is: the prop is a render behind.
  const create = useCallback(
    async (target: string, name: string, format: VideoFormat) => {
      const exit = await Effect.runPromiseExit(
        createVideo(target, name, sizeOf(format))
      );

      if (Exit.isFailure(exit)) {
        setVideosError(causeMessage(exit.cause));
        return null;
      }

      opened.current = target;
      setVideos((current) => [
        exit.value,
        ...current.filter((row) => row.projectId === target),
      ]);
      setActiveId(exit.value.id);
      return exit.value;
    },
    []
  );

  const rename = useCallback(async (videoId: string, name: string) => {
    const exit = await Effect.runPromiseExit(renameVideo(videoId, name));

    if (Exit.isFailure(exit)) {
      setVideosError(causeMessage(exit.cause));
      return null;
    }

    setVideos((current) =>
      current.map((row) => (row.id === videoId ? exit.value : row))
    );
    return exit.value;
  }, []);

  const register = useCallback(async (videoId: string) => {
    const exit = await Effect.runPromiseExit(registerVideo(videoId));

    if (Exit.isFailure(exit)) {
      setVideosError(causeMessage(exit.cause));
      return false;
    }

    // `missing` only clears when the bundle names it, which is the next
    // compile — saying it worked here would be a claim we cannot make yet.
    toastManager.add({
      description: "It appears in the preview once the project rebuilds.",
      title: "Registered in the project",
    });
    return true;
  }, []);

  const restore = useCallback(async (videoId: string) => {
    const exit = await Effect.runPromiseExit(restoreVideo(videoId));

    if (Exit.isFailure(exit)) {
      setVideosError(causeMessage(exit.cause));
      return null;
    }

    setVideos((current) => [
      exit.value,
      ...current.filter((row) => row.id !== videoId),
    ]);
    return exit.value;
  }, []);

  // The delete is soft on disk and in the row, so Undo is not a race against
  // a timer: it clears the mark, and it works long after the toast is gone.
  const remove = useCallback(
    async (videoId: string) => {
      const name = videos.find((row) => row.id === videoId)?.name ?? null;
      const exit = await Effect.runPromiseExit(removeVideo(videoId));

      if (Exit.isFailure(exit)) {
        setVideosError(causeMessage(exit.cause));
        return false;
      }

      setVideos((current) => current.filter((row) => row.id !== videoId));
      setActiveId((current) => (current === videoId ? null : current));

      toastManager.add({
        actionProps: { children: "Undo", onClick: () => restore(videoId) },
        description: name,
        title: "Video deleted",
      });

      return exit.value;
    },
    [restore, videos]
  );

  return useMemo(
    () => ({
      activeVideo: videos.find((row) => row.id === activeId) ?? null,
      createVideo: create,
      isLoadingVideos,
      // `isLoadingVideos` is still false in the render where a newly loaded
      // project first becomes active. Matching the completed request to that
      // project closes that one-render gap for the splash boot gate.
      isVideosReady: projectId === null || loadedProjectId === projectId,
      reconcile,
      registerVideo: register,
      reloadVideos,
      removeVideo: remove,
      renameVideo: rename,
      restoreVideo: restore,
      selectVideo: setActiveId,
      videos,
      videosError,
    }),
    [
      activeId,
      create,
      isLoadingVideos,
      loadedProjectId,
      projectId,
      reconcile,
      register,
      reloadVideos,
      remove,
      rename,
      restore,
      videos,
      videosError,
    ]
  );
}
