"use client";

import { Effect, Exit, Fiber } from "effect";
import type { RefObject } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { previewFailure, previewRecovery } from "@/lib/studio/failures";
import {
  decodePreviewMessage,
  originOf,
  type PreviewCommand,
  type PreviewComposition,
  type PreviewMessage,
  startPreview,
} from "@/lib/studio/preview";
import {
  createPreviewSurfaceChannel,
  iframePreviewSurface,
  type PreviewSurface,
} from "@/lib/studio/preview-surface";
import type { PromptFrame, SidecarPhase } from "@/shared/ipc";

export type Preview =
  | { phase: "building"; percent: number }
  | { phase: "failed"; message: string }
  | { phase: "idle" }
  | { phase: "ready"; url: string };

export type PreviewListener = (message: PreviewMessage) => void;

export interface PreviewControl {
  attachSurface?: (surface: PreviewSurface) => () => void;
  focus?: () => void;
  composition: string | null;
  frameOf: () => number;
  hint: string | null;
  isServing: boolean;
  onFrame: (listen: () => void) => () => void;
  pick: PreviewComposition | null;
  playing: boolean;
  preview: Preview;
  restart: () => void;
  send: (command: PreviewCommand) => void;
  stage: RefObject<HTMLIFrameElement | null>;
  subscribe: (listen: PreviewListener) => () => void;
}

const IDLE: Preview = { phase: "idle" };
const EMPTY_COMPOSITIONS_SETTLE_MS = 250;

type Running = Fiber.Fiber<unknown, unknown>;

// One host per project, one page per video: the bundle is shared and the
// iframe asks for the composition it wants, so switching videos is a page
// load rather than another seven-second compile.
export function usePreview(
  projectId: string | null,
  compositionId: string | null,
  sidecarPhase: SidecarPhase | "unknown",
  projectPath?: string,
  surfaceKind: "iframe" | "canvas" = "iframe"
): PreviewControl {
  const [preview, setPreview] = useState<Preview>(IDLE);
  const [pick, setPick] = useState<PreviewComposition | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const running = useRef<Running | null>(null);
  const stage = useRef<HTMLIFrameElement>(null);
  const surface = useMemo(createPreviewSurfaceChannel, []);
  const listeners = useRef(new Set<PreviewListener>());
  const frame = useRef(0);
  const watchers = useRef(new Set<() => void>());

  const frameOf = useCallback(() => frame.current, []);

  const onFrame = useCallback((listen: () => void) => {
    watchers.current.add(listen);

    return () => {
      watchers.current.delete(listen);
    };
  }, []);

  const setFrame = useCallback((at: number) => {
    if (frame.current === at) {
      return;
    }

    frame.current = at;
    for (const watch of [...watchers.current]) {
      watch();
    }
  }, []);

  const origin = preview.phase === "ready" ? originOf(preview.url) : null;
  const url =
    preview.phase === "ready" ? playing(preview.url, compositionId) : null;

  const subscribe = useCallback((listen: PreviewListener) => {
    listeners.current.add(listen);

    return () => {
      listeners.current.delete(listen);
    };
  }, []);

  const stop = useCallback(() => {
    if (running.current !== null) {
      Effect.runFork(Fiber.interrupt(running.current));
      running.current = null;
    }
  }, []);

  const launch = useCallback(
    (target: string) => {
      let served = false;
      let failed = false;

      setPick(null);
      setFrame(0);
      setIsPlaying(false);
      setPreview({ percent: 0, phase: "building" });

      running.current = Effect.runFork(
        startPreview({ projectId: target }, (event) => {
          if (event.type === "building") {
            // A compile that failed still ticks to 100% afterwards; only a
            // fresh compile, starting from nothing, takes the error down.
            if (served || (failed && event.percent > 0)) {
              return;
            }
            failed = false;
            setPreview({ percent: event.percent, phase: "building" });
            return;
          }
          if (event.type === "ready") {
            served = true;
            failed = false;
            setPreview({ phase: "ready", url: event.url });
            return;
          }
          served = false;
          failed = true;
          setPreview({
            message: previewFailure(event.message),
            phase: "failed",
          });
        }).pipe(
          Effect.catch((error) =>
            Effect.sync(() => {
              setPreview({
                message: previewFailure(error.message),
                phase: "failed",
              });
            })
          )
        )
      );
    },
    [setFrame]
  );

  useEffect(() => {
    if (projectId === null) {
      setPick(null);
      setPreview(IDLE);
      return;
    }

    launch(projectId);

    return stop;
  }, [launch, projectId, stop]);

  // The preview's request dies with the sidecar and nothing brought it back,
  // so the one pane that costs seven seconds to rebuild was the only one left
  // needing a manual click. `lost` survives the render that sets it, because
  // the crash and the recovery are two separate status events.
  const lost = useRef(false);

  useEffect(() => {
    const next = previewRecovery(lost.current, sidecarPhase);
    lost.current = next.lost;

    if (next.relaunch && projectId !== null) {
      stop();
      launch(projectId);
    }
  }, [launch, projectId, sidecarPhase, stop]);

  useEffect(() => {
    if (origin === null) {
      return;
    }

    let pendingEmpty: ReturnType<typeof setTimeout> | null = null;

    const cancelPendingEmpty = () => {
      if (pendingEmpty !== null) {
        clearTimeout(pendingEmpty);
        pendingEmpty = null;
      }
    };

    const publish = (message: PreviewMessage) => {
      if (message.type === "composition") {
        setPick(message);
      }

      if (message.type === "playhead") {
        setIsPlaying(message.playing);
      }

      const at = frameIn(message);
      if (at !== null) {
        setFrame(at);
      }

      for (const listen of [...listeners.current]) {
        listen(message);
      }
    };

    const onMessage = (data: unknown) => {
      const decoded = decodePreviewMessage(data);
      if (Exit.isFailure(decoded)) {
        return;
      }

      const message = decoded.value;
      if (message.type === "composition") {
        cancelPendingEmpty();

        // Remotion mounts its provider with no compositions before the Root
        // registers the real list. Publishing that one transient snapshot
        // makes the chat, player, and sidebar all render an empty-project
        // error. A populated snapshot wins immediately; a genuinely empty
        // project still becomes visible after this short settle window.
        if (message.compositions.length === 0) {
          pendingEmpty = setTimeout(() => {
            pendingEmpty = null;
            publish(message);
          }, EMPTY_COMPOSITIONS_SETTLE_MS);
          return;
        }
      }

      publish(message);
    };

    const unsubscribe = surface.subscribe(onMessage);

    return () => {
      cancelPendingEmpty();
      unsubscribe();
    };
  }, [origin, setFrame, surface, url]);

  useEffect(() => {
    if (origin === null || surfaceKind !== "iframe") return;
    return surface.attach(iframePreviewSurface(() => stage.current, origin));
  }, [origin, surface, surfaceKind, url]);

  useEffect(() => () => surface.disconnect(), [surface]);

  const send = surface.send;

  const restart = useCallback(() => {
    stop();
    if (projectId !== null) {
      launch(projectId);
    }
  }, [launch, projectId, stop]);

  const previousLocation = useRef({ projectId, projectPath });
  useEffect(() => {
    const previous = previousLocation.current;
    previousLocation.current = { projectId, projectPath };
    if (
      previous.projectId === projectId &&
      previous.projectPath !== projectPath
    ) {
      restart();
    }
  }, [projectId, projectPath, restart]);

  const hint = useMemo(() => hintOf(pick), [pick]);

  return useMemo(
    () => ({
      attachSurface: surface.attach,
      focus: surface.focus,
      composition: pick?.compositionId ?? null,
      frameOf,
      hint,
      isServing: preview.phase === "ready",
      onFrame,
      pick,
      playing: isPlaying,
      preview: url === null ? preview : { phase: "ready" as const, url },
      restart,
      send,
      stage,
      subscribe,
    }),
    [
      frameOf,
      hint,
      isPlaying,
      onFrame,
      pick,
      preview,
      restart,
      send,
      subscribe,
      surface,
      url,
    ]
  );
}

function playing(url: string, compositionId: string | null): string {
  if (compositionId === null) {
    return url;
  }

  const asked = new URL(url);
  asked.searchParams.set("composition", compositionId);
  return asked.toString();
}

export function usePlayingFrame(
  preview: PreviewControl
): () => PromptFrame | null {
  const { composition, frameOf } = preview;
  const open = useRef(composition);
  open.current = composition;

  return useCallback(
    () =>
      open.current === null
        ? null
        : { composition: open.current, frame: frameOf() },
    [frameOf]
  );
}

export function usePreviewFrame(preview: PreviewControl): number {
  const { frameOf, onFrame } = preview;

  return useSyncExternalStore(onFrame, frameOf, frameOf);
}

export function useOnPreview(
  preview: PreviewControl,
  listen: PreviewListener
): void {
  const { subscribe } = preview;

  useEffect(() => subscribe(listen), [listen, subscribe]);
}

function frameIn(message: PreviewMessage): number | null {
  if (message.type === "selection") {
    return message.element.frame;
  }
  if (message.type === "capture" || message.type === "playhead") {
    return message.frame;
  }
  return null;
}

function hintOf(message: PreviewComposition | null): string | null {
  if (message === null) {
    return null;
  }

  if (message.compositionId === null) {
    return "This project registers no videos.";
  }

  // Naming the video the pane asked for is the whole point of this branch:
  // playing a neighbour instead would read as the wrong video rendering.
  if (message.reason === "missing") {
    return `Nothing in this project renders ${message.compositionId}. Ask Claude to register it, or open a video that is in the code.`;
  }

  if (message.unmeasured) {
    return `${message.compositionId} computes its metadata, which the preview cannot resolve yet.`;
  }

  if (message.reason === "folder") {
    return `Playing ${message.compositionId}, matched from the folder you opened.`;
  }

  if (message.reason === "first") {
    return `No video was asked for, so ${message.compositionId} is playing.`;
  }

  return null;
}
