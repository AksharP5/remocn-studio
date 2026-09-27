"use client";

import { Effect, Fiber } from "effect";
import { useEffect, useState } from "react";
import { fileExists } from "@/lib/studio/shell";

export function useFileExists(path: string | null): boolean {
  const [found, setFound] = useState<{ exists: boolean; path: string } | null>(
    null
  );

  useEffect(() => {
    if (path === null) {
      return;
    }
    const fiber = Effect.runFork(
      fileExists(path).pipe(
        Effect.catch(() => Effect.succeed(false)),
        Effect.tap((exists) => Effect.sync(() => setFound({ exists, path })))
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [path]);

  return path !== null && found?.path === path && found.exists;
}
