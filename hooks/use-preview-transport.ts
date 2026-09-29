"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type PreviewControl, useOnPreview } from "@/hooks/use-preview";
import {
  PLAYBACK_RATES,
  type PlaybackRate,
  PREVIEW_COMMAND_SOURCE,
  type PreviewMessage,
  type PreviewScene,
  seekCommand,
} from "@/lib/studio/preview";

type TransportState = Extract<PreviewMessage, { type: "transport.state" }>;

const INTERACTIVE =
  "input, textarea, select, button, a, [contenteditable]:not([contenteditable='false']), [role='slider'], [role='textbox'], [role='button']";

export function usePreviewTransport(preview: PreviewControl, enabled: boolean) {
  const surface = useRef<HTMLElement>(null);
  const { composition, frameOf, isServing, onFrame, pick, send } = preview;
  const url = preview.preview.phase === "ready" ? preview.preview.url : null;
  const [reported, setReported] = useState<{
    url: string;
    state: TransportState;
  } | null>(null);
  const [seek, setSeek] = useState<{ url: string; frame: number } | null>(null);
  const [sceneReport, setSceneReport] = useState<{
    composition: string;
    scenes: readonly PreviewScene[];
    url: string;
  } | null>(null);
  const [chosenRate, setChosenRate] = useState<{
    composition: string | null;
    rate: PlaybackRate;
  } | null>(null);
  const rate = chosenRate?.composition === composition ? chosenRate.rate : 1;
  const scenes =
    sceneReport?.url === url && sceneReport.composition === composition
      ? sceneReport.scenes
      : NO_SCENES;
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
      } else if (message.type === "scenes" && url) {
        setSceneReport({
          composition: message.compositionId,
          scenes: message.scenes,
          url,
        });
      } else if (message.type === "playhead") {
        setSeek((pending) =>
          pending?.frame === message.frame ? null : pending
        );
      } else if (message.type === "rebuilt") {
        setSeek(null);
        send({ source: PREVIEW_COMMAND_SOURCE, type: "transport.request" });
        send({ rate, source: PREVIEW_COMMAND_SOURCE, type: "transport.rate" });
      }
    },
    [composition, rate, send, url]
  );
  useOnPreview(preview, receive);

  useEffect(() => {
    if (url !== null && composition !== null) {
      send({ source: PREVIEW_COMMAND_SOURCE, type: "transport.request" });
    }
  }, [composition, send, url]);

  useEffect(() => {
    if (url !== null && composition !== null) {
      send({ rate, source: PREVIEW_COMMAND_SOURCE, type: "transport.rate" });
    }
  }, [composition, rate, send, url]);

  const setRate = useCallback(
    (chosen: unknown) => {
      const found = PLAYBACK_RATES.find((item) => item === chosen);
      if (found !== undefined) {
        setChosenRate({ composition, rate: found });
      }
    },
    [composition]
  );
  const setRateStep = useCallback(
    (position: unknown) => setRate(PLAYBACK_RATES[Number(position)]),
    [setRate]
  );
  const cycleRate = useCallback(
    () =>
      setRate(
        PLAYBACK_RATES[
          (PLAYBACK_RATES.indexOf(rate) + 1) % PLAYBACK_RATES.length
        ]
      ),
    [rate, setRate]
  );

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
      setSeek(at === frameOf() ? null : { frame: at, url });
      send(seekCommand(at));
    },
    [frameOf, lastFrame, ready, send, url]
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
      if (!(ready && Number.isFinite(value))) {
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

  const pendingFrame = seek?.url === url ? seek.frame : null;
  const buffering = state?.buffering ?? false;
  const error = state?.error ?? null;
  const muted = (state?.muted ?? false) || state?.volume === 0;
  const volume = Math.round((state?.muted ? 0 : (state?.volume ?? 1)) * 100);
  const { playing } = preview;

  return useMemo(
    () => ({
      buffering,
      cycleRate,
      duration: previewTime(duration / fps),
      error,
      fps,
      frameOf,
      lastFrame,
      muted,
      next,
      onFrame,
      pendingFrame,
      playing,
      previous,
      rate,
      rateMarks: RATE_MARKS,
      rateStep: PLAYBACK_RATES.indexOf(rate),
      rates: PLAYBACK_RATES,
      ready,
      scenes,
      seekTo,
      setRate,
      setRateStep,
      setVolume,
      surface,
      toggle,
      toggleMute,
      volume,
    }),
    [
      buffering,
      cycleRate,
      duration,
      error,
      fps,
      frameOf,
      lastFrame,
      muted,
      next,
      onFrame,
      pendingFrame,
      playing,
      previous,
      rate,
      ready,
      scenes,
      seekTo,
      setRate,
      setRateStep,
      setVolume,
      toggle,
      toggleMute,
      volume,
    ]
  );
}

type TransportFrames = Pick<
  PreviewTransport,
  "fps" | "frameOf" | "lastFrame" | "onFrame" | "pendingFrame"
>;

export function useTransportFrame({
  fps,
  frameOf,
  lastFrame,
  onFrame,
  pendingFrame,
}: TransportFrames): { frame: number; position: string } {
  const live = useSyncExternalStore(onFrame, frameOf, frameOf);
  const frame = Math.max(0, Math.min(lastFrame, pendingFrame ?? live));

  return { frame, position: previewTime(frame / fps) };
}

export type TransportEdge = "end" | "middle" | "start";

export function useTransportEdge({
  frameOf,
  lastFrame,
  onFrame,
  pendingFrame,
}: TransportFrames): TransportEdge {
  const edge = useCallback((): TransportEdge => {
    const frame = Math.max(0, Math.min(lastFrame, pendingFrame ?? frameOf()));
    if (frame === 0) {
      return "start";
    }
    return frame === lastFrame ? "end" : "middle";
  }, [frameOf, lastFrame, pendingFrame]);

  return useSyncExternalStore(onFrame, edge, edge);
}

export type PreviewTransport = ReturnType<typeof usePreviewTransport>;

const NO_SCENES: readonly PreviewScene[] = [];

const RATE_MARKS: readonly number[] = PLAYBACK_RATES.map(
  (_, index) => index / (PLAYBACK_RATES.length - 1)
);

function previewTime(seconds: number): string {
  const total = Math.floor(Math.max(0, seconds));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
