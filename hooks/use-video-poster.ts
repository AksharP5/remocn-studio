"use client";

import { Effect, Fiber } from "effect";
import { useEffect, useState } from "react";
import { knownPoster, posterOf } from "@/lib/studio/posters";

export type VideoPoster =
  | { phase: "failed" }
  | { phase: "pending" }
  | { phase: "ready"; src: string };

function initial(path: string): VideoPoster {
  const src = knownPoster(path);
  return src === null ? { phase: "pending" } : { phase: "ready", src };
}

export function useVideoPoster(
  path: string,
  name: string,
  isVideo: boolean
): VideoPoster {
  const [poster, setPoster] = useState(() => initial(path));
  const isPending = isVideo && poster.phase === "pending";

  useEffect(() => {
    if (!isPending) {
      return;
    }

    const fiber = Effect.runFork(
      posterOf(path, name).pipe(
        Effect.tap((src) =>
          Effect.sync(() => setPoster({ phase: "ready", src }))
        ),
        Effect.catch(() => Effect.sync(() => setPoster({ phase: "failed" })))
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [isPending, name, path]);

  return poster;
}
