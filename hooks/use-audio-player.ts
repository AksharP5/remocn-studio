"use client";

import { Effect, Exit } from "effect";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { previewUrl } from "@/lib/studio/attachments";

export function useAudioPlayer(file: string | null) {
  const ref = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = file === null ? null : previewUrl(file);
  const busy = useRef(false);

  useEffect(() => {
    const audio = ref.current;
    return () => {
      audio?.pause();
    };
  }, []);

  const onMetadata = useCallback(() => {
    const value = ref.current?.duration ?? 0;
    setDuration(Number.isFinite(value) && value > 0 ? value : 0);
    if (Number.isFinite(value) && value > 0) {
      setUnavailable(false);
      setError(null);
    }
  }, []);
  const onTime = useCallback(
    () => setPosition(ref.current?.currentTime ?? 0),
    []
  );
  const onPlay = useCallback(() => setPlaying(true), []);
  const onPause = useCallback(() => setPlaying(false), []);
  const onError = useCallback(() => {
    setPlaying(false);
    setUnavailable(true);
    setError(
      "This audio file could not be loaded. It may have been moved or deleted."
    );
  }, []);
  const onSeek = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const audio = ref.current;
    if (
      audio !== null &&
      Number.isFinite(audio.duration) &&
      audio.duration > 0
    ) {
      const time = Math.min(
        audio.duration,
        Math.max(0, Number(event.currentTarget.value))
      );
      audio.currentTime = time;
      setPosition(time);
    }
  }, []);
  const toggle = useCallback(async () => {
    const audio = ref.current;
    if (audio === null || busy.current) {
      return;
    }
    if (!audio.paused) {
      audio.pause();
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    if (audio.ended) {
      audio.currentTime = 0;
    }
    const exit = await Effect.runPromiseExit(
      Effect.tryPromise({
        catch: () => "Playback could not start. Press Play to try again.",
        try: () => audio.play(),
      })
    );
    if (ref.current === audio) {
      setPending(false);
      if (Exit.isFailure(exit)) {
        setError(
          (current) =>
            current ?? "Playback could not start. Press Play to try again."
        );
      }
    }
    busy.current = false;
  }, []);

  return {
    duration,
    error,
    onError,
    onMetadata,
    onPause,
    onPlay,
    onSeek,
    onTime,
    pending,
    playing,
    position,
    ref,
    toggle,
    unavailable,
    url,
  };
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;

export function audioTime(value: number): string {
  const seconds = Math.floor(Number.isFinite(value) ? Math.max(0, value) : 0);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
