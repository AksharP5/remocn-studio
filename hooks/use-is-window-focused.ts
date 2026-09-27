"use client";

import { Effect, Fiber } from "effect";
import { useEffect, useState } from "react";
import { watchWindowFocus } from "@/lib/studio/shell";

export function useIsWindowFocused(): boolean {
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    const fiber = Effect.runFork(
      Effect.scoped(
        watchWindowFocus(
          () => setIsFocused(true),
          () => setIsFocused(false)
        ).pipe(Effect.andThen(Effect.never), Effect.ignore)
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);

  return isFocused;
}
