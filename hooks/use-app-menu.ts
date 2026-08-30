"use client";

import { Effect } from "effect";
import { useEffect, useRef } from "react";
import { type AppMenuModel, installAppMenu } from "@/lib/studio/app-menu";

// The menu is chrome, not a feature the app waits on: in a plain browser or
// under jsdom there is no Tauri transport, so a failed install is swallowed
// and the app simply keeps whatever menu it had.
export function useAppMenu(model: AppMenuModel): void {
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    const token = generation.current;

    Effect.runPromiseExit(
      installAppMenu(model, () => generation.current === token)
    );
  }, [model]);
}
