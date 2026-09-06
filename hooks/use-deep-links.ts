"use client";

import { Effect, Fiber } from "effect";
import { useEffect, useRef } from "react";
import { takeDeepLinks, watchDeepLinks } from "@/lib/studio/deep-links";

// Links reach the webview by one door: the core's queue. The event only says
// the queue has something in it, so a link that arrived before this mounted
// and one that arrives while it is up take the same path.
export function useDeepLinks(onLink: (url: string) => void): void {
  const handler = useRef(onLink);

  useEffect(() => {
    handler.current = onLink;
  }, [onLink]);

  useEffect(() => {
    const drain = takeDeepLinks.pipe(
      Effect.tap((urls) =>
        Effect.sync(() => {
          for (const url of urls) {
            handler.current(url);
          }
        })
      ),
      Effect.ignore
    );

    const fiber = Effect.runFork(
      Effect.scoped(
        Effect.gen(function* () {
          yield* watchDeepLinks(() => {
            Effect.runFork(drain);
          });
          yield* drain;
          yield* Effect.never;
        })
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);
}
