"use client";

import { useCallback, useEffect, useRef } from "react";

const EDIT_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Enter",
]);

export function useDialCommit(commit: () => void) {
  const state = useRef({
    dirty: false,
    keys: new Set<string>(),
    mounted: false,
    pointer: false,
  });
  const latest = useRef(commit);
  latest.current = commit;
  const flush = useCallback(() => {
    const held = state.current;
    if (!(held.mounted && held.dirty) || held.pointer || held.keys.size > 0) {
      return;
    }
    held.dirty = false;
    latest.current();
  }, []);
  const changed = useCallback(() => {
    state.current.dirty = true;
    queueMicrotask(flush);
  }, [flush]);
  useEffect(() => {
    const held = state.current;
    held.mounted = true;
    const down = () => {
      held.pointer = true;
    };
    const up = () => {
      held.pointer = false;
      queueMicrotask(flush);
    };
    const keyDown = (event: KeyboardEvent) => {
      if (EDIT_KEYS.has(event.key)) {
        held.keys.add(event.key);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      held.keys.delete(event.key);
      queueMicrotask(flush);
    };
    const blur = () => {
      held.pointer = false;
      held.keys.clear();
      queueMicrotask(flush);
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    document.addEventListener("keydown", keyDown, true);
    document.addEventListener("keyup", keyUp, true);
    window.addEventListener("blur", blur);
    return () => {
      held.mounted = false;
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
      document.removeEventListener("keydown", keyDown, true);
      document.removeEventListener("keyup", keyUp, true);
      window.removeEventListener("blur", blur);
    };
  }, [flush]);
  return changed;
}
