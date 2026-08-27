"use client";

import { Effect, Fiber } from "effect";
import { useEffect, useState } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const fiber = Effect.runFork(
      Effect.acquireRelease(
        Effect.sync(() => {
          const sync = () => setOnline(navigator.onLine);

          sync();
          window.addEventListener("online", sync);
          window.addEventListener("offline", sync);

          return sync;
        }),
        (sync) =>
          Effect.sync(() => {
            window.removeEventListener("online", sync);
            window.removeEventListener("offline", sync);
          })
      ).pipe(Effect.andThen(Effect.never), Effect.scoped)
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);

  return online;
}
