"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type PreviewControl,
  useOnPreview,
  usePreviewFrame,
} from "@/hooks/use-preview";
import {
  PREVIEW_COMMAND_SOURCE,
  type PreviewMessage,
  seekCommand,
} from "@/lib/studio/preview";

type TransportState = Extract<PreviewMessage, { type: "transport.state" }>;

const INTERACTIVE =
  "input, textarea, select, button, a, [contenteditable]:not([contenteditable='false']), [role='slider'], [role='textbox'], [role='button']";

export function usePreviewTransport(preview: PreviewControl, enabled: boolean) {
  const surface = useRef<HTMLElement>(null);
  const frame = usePreviewFrame(preview);
  const { composition, isServing, pick, send } = preview;
  const url = preview.preview.phase === "ready" ? preview.preview.url : null;
  const [reported, setReported] = useState<{
    url: string;
    state: TransportState;
  } | null>(null);
  const [seek, setSeek] = useState<{ url: string; frame: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const state =
    reported?.url === url && reported?.state.compositionId === composition
      ? reported.state
      : null;
  const metadata = pick?.metadata;
  const duration = metadata?.durationInFrames ?? 0;
  const fps = metadata?.fps ?? 30;
  const lastFrame = Math.max(0, duration - 1);
  const ready = enabled && isServing && state !== null && duration > 0;

  const receive = useCallback(
    (message: PreviewMessage) => {
      if (
        message.type === "transport.state" &&
        message.compositionId === composition &&
        url
      ) {
        setReported({ state: message, url });
      } else if (message.type === "playhead") {
        setSeek((pending) =>
          pending?.frame === message.frame ? null : pending
        );
      } else if (message.type === "rebuilt") {
        setSeek(null);
        send({ source: PREVIEW_COMMAND_SOURCE, type: "transport.request" });
      }
    },
    [composition, send, url]
  );
  useOnPreview(preview, receive);

  useEffect(() => {
    if (isServing && composition !== null) {
      send({ source: PREVIEW_COMMAND_SOURCE, type: "transport.request" });
    }
  }, [composition, isServing, send, url]);

  const toggle = useCallback(() => {
    if (ready) {
      setSeek(null);
      send({ source: PREVIEW_COMMAND_SOURCE, type: "transport.toggle" });
    }
  }, [ready, send]);

  const step = useCallback(
    (direction: -1 | 1) => {
      if (ready) {
        setSeek(null);
        send({
          direction,
          source: PREVIEW_COMMAND_SOURCE,
          type: "transport.step",
        });
      }
    },
    [ready, send]
  );
  const previous = useCallback(() => step(-1), [step]);
  const next = useCallback(() => step(1), [step]);

  const seekTo = useCallback(
    (value: number) => {
      if (!ready || url === null || !Number.isFinite(value)) {
        return;
      }
      const at = Math.max(0, Math.min(lastFrame, Math.round(value)));
      setSeek(at === frame ? null : { frame: at, url });
      send(seekCommand(at));
    },
    [frame, lastFrame, ready, send, url]
  );

  const toggleMute = useCallback(() => {
    if (!(ready && state)) {
      return;
    }
    const silent = state.muted || state.volume === 0;
    send({
      muted: !silent,
      source: PREVIEW_COMMAND_SOURCE,
      type: "transport.audio",
      volume: silent && state.volume === 0 ? 1 : state.volume,
    });
  }, [ready, send, state]);

  const setVolume = useCallback(
    (value: number) => {
      if (!ready || !Number.isFinite(value)) {
        return;
      }
      const volume = Math.max(0, Math.min(1, value / 100));
      send({
        muted: volume === 0,
        source: PREVIEW_COMMAND_SOURCE,
        type: "transport.audio",
        volume,
      });
    },
    [ready, send]
  );

  useEffect(() => {
    const changed = () => {
      setFullscreen(document.fullscreenElement === surface.current);
      setFullscreenError(null);
    };
    setCanFullscreen(document.fullscreenEnabled === true);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!(ready && canFullscreen && surface.current)) {
      return;
    }
    setFullscreenError(null);
    try {
      if (document.fullscreenElement === surface.current) {
        await document.exitFullscreen();
      } else {
        await surface.current.requestFullscreen();
      }
    } catch {
      setFullscreenError("Fullscreen is unavailable in this window.");
    }
  }, [canFullscreen, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !(event.target instanceof Element) ||
        !surface.current?.contains(event.target) ||
        event.target.closest(INTERACTIVE)
      ) {
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        if (!event.repeat) {
          toggle();
        }
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        step(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ready, step, toggle]);

  const at = Math.max(
    0,
    Math.min(lastFrame, seek?.url === url ? seek.frame : frame)
  );
  return {
    buffering: state?.buffering ?? false,
    canFullscreen,
    duration: previewTime(duration / fps),
    error: state?.error ?? fullscreenError,
    frame: at,
    fullscreen,
    lastFrame,
    muted: (state?.muted ?? false) || state?.volume === 0,
    next,
    playing: preview.playing,
    position: previewTime(at / fps),
    previous,
    ready,
    seekTo,
    setVolume,
    surface,
    toggle,
    toggleFullscreen,
    toggleMute,
    volume: Math.round((state?.muted ? 0 : state?.volume ?? 1) * 100),
  };
}

export type PreviewTransport = ReturnType<typeof usePreviewTransport>;

function previewTime(seconds: number): string {
  const total = Math.floor(Math.max(0, seconds));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
