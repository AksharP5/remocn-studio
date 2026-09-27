"use client";

import { Effect, Fiber } from "effect";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { holdWindowFullScreen } from "@/lib/studio/shell";

export const VIEWING_IDLE_MS = 2500;

export const FULL_SCREEN_UNAVAILABLE =
  "Full screen is unavailable, so the video fills the window.";

const TYPING =
  "input, textarea, select, button, a, [contenteditable]:not([contenteditable='false']), [role='slider'], [role='textbox'], [role='button'], [data-preview-editing]";

function typing(event: Event): boolean {
  return event
    .composedPath()
    .some((item) => item instanceof Element && item.matches(TYPING));
}

function modified(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

export function usePreviewViewing({
  enabled,
  playing,
  ready,
  surface,
  toggle,
}: {
  enabled: boolean;
  playing: boolean;
  ready: boolean;
  surface: RefObject<HTMLElement | null>;
  toggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const shield = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const onVideo = useRef(true);
  const play = useRef(toggle);
  play.current = toggle;
  const viewing = open && enabled;
  const canEnter = ready && enabled;

  const enter = useCallback(() => {
    if (!canEnter) {
      return;
    }
    returnTo.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    onVideo.current = true;
    setNotice(null);
    setIdle(false);
    setOpen(true);
  }, [canEnter]);

  const exit = useCallback(() => setOpen(false), []);

  const toggleViewing = useCallback(() => {
    if (open) {
      exit();
    } else {
      enter();
    }
  }, [enter, exit, open]);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!viewing) {
      return;
    }
    const layer = shield.current;
    layer?.focus({ preventScroll: true });
    const still = (event: WheelEvent) => event.preventDefault();
    const click = () => play.current();
    layer?.addEventListener("wheel", still, { passive: false });
    layer?.addEventListener("click", click);
    return () => {
      layer?.removeEventListener("wheel", still);
      layer?.removeEventListener("click", click);
      const target = returnTo.current;
      returnTo.current = null;
      if (target?.isConnected) {
        target.focus({ preventScroll: true });
      }
    };
  }, [viewing]);

  useEffect(() => {
    if (!viewing) {
      return;
    }
    const fiber = Effect.runFork(
      Effect.scoped(
        holdWindowFullScreen(() => setOpen(false)).pipe(
          Effect.andThen(Effect.never),
          Effect.catch(() =>
            Effect.sync(() => setNotice(FULL_SCREEN_UNAVAILABLE))
          )
        )
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [viewing]);

  useEffect(() => {
    const node = surface.current;
    if (!(viewing && node)) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const rest = () => {
      clearTimeout(timer);
      timer =
        playing && onVideo.current
          ? setTimeout(() => setIdle(true), VIEWING_IDLE_MS)
          : undefined;
    };
    const wake = (event: Event) => {
      if (event.type !== "keydown") {
        onVideo.current = event.target === shield.current;
      }
      setIdle(false);
      rest();
    };
    setIdle(false);
    rest();
    node.addEventListener("pointermove", wake);
    node.addEventListener("pointerdown", wake);
    node.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer);
      node.removeEventListener("pointermove", wake);
      node.removeEventListener("pointerdown", wake);
      node.removeEventListener("keydown", wake);
    };
  }, [playing, surface, viewing]);

  useEffect(() => {
    const inside = (event: Event) =>
      event.target instanceof Node &&
      surface.current?.contains(event.target) === true;
    const onEscape = (event: KeyboardEvent) => {
      if (
        viewing &&
        event.key === "Escape" &&
        !event.isComposing &&
        (inside(event) || event.target === document.body)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        exit();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        modified(event) ||
        !inside(event) ||
        typing(event)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "f" && (viewing || canEnter)) {
        event.preventDefault();
        toggleViewing();
      } else if (key === "k" && viewing) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canEnter, exit, surface, toggle, toggleViewing, viewing]);

  return useMemo(
    () => ({
      canEnter,
      controlsHidden: viewing && playing && idle,
      notice: viewing ? notice : null,
      shield,
      toggle: toggleViewing,
      viewing,
    }),
    [canEnter, idle, notice, playing, toggleViewing, viewing]
  );
}

export type PreviewViewing = ReturnType<typeof usePreviewViewing>;
