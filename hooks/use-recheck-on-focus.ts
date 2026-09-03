"use client";

import { Effect, Fiber } from "effect";
import { useEffect, useRef } from "react";
import { shouldRecheck } from "@/lib/studio/setup";
import { watchWindowFocus } from "@/lib/studio/shell";

const GAP_MS = 5000;

export function useRecheckOnFocus(enabled: boolean, recheck: () => void) {
  const lastAt = useRef<number | null>(null);
  const latest = useRef(recheck);
  latest.current = recheck;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const fiber = Effect.runFork(
      Effect.scoped(
        watchWindowFocus(() => {
          const now = Date.now();
          if (shouldRecheck(lastAt.current, now, GAP_MS)) {
            lastAt.current = now;
            latest.current();
          }
        }).pipe(Effect.andThen(Effect.never), Effect.ignore)
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [enabled]);
}
