"use client";

import { isTauri } from "@tauri-apps/api/core";
import { Effect } from "effect";
import { useEffect } from "react";
import { setWindowBackground } from "@/lib/studio/shell";

export function useWindowBackground(theme: string | undefined) {
  useEffect(() => {
    if (!isTauri() || (theme !== "light" && theme !== "dark")) {
      return;
    }
    Effect.runFork(
      setWindowBackground(theme).pipe(
        Effect.catch((error) =>
          Effect.sync(() =>
            console.warn("Could not match the window to the theme", error)
          )
        )
      )
    );
  }, [theme]);
}
