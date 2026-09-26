"use client";

import { useEffect, useState } from "react";

export const PRESENCE_EXIT_MS = 150;

export interface Presence<T> {
  isLeaving: boolean;
  shown: T | null;
}

export function usePresence<T>(
  value: T | null,
  exitMs: number = PRESENCE_EXIT_MS
): Presence<T> {
  const [held, setHeld] = useState<T | null>(value);

  useEffect(() => {
    if (value !== null) {
      setHeld(value);
      return;
    }
    const timer = setTimeout(() => setHeld(null), exitMs);
    return () => clearTimeout(timer);
  }, [value, exitMs]);

  return {
    isLeaving: value === null && held !== null,
    shown: value ?? held,
  };
}
