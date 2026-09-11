"use client";

import { Effect, Fiber } from "effect";
import { type RefObject, useEffect, useRef } from "react";
import { watchWindowFocus } from "@/lib/studio/shell";

// The window starts as focused: an event that lands before the first focus
// change is one the person is most likely looking at, and a notification
// held back is cheaper than one posted over an app that is in front.
export function useWindowFocus(): RefObject<boolean> {
  const isFocused = useRef(true);

  useEffect(() => {
    const fiber = Effect.runFork(
      Effect.scoped(
        watchWindowFocus(
          () => {
            isFocused.current = true;
          },
          () => {
            isFocused.current = false;
          }
        ).pipe(Effect.andThen(Effect.never), Effect.ignore)
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);

  return isFocused;
}
