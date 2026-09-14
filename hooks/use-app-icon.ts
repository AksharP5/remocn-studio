"use client";

import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";

export function useAppIcon(theme: string | undefined) {
  const pending = useRef(Promise.resolve());

  useEffect(() => {
    if (!isTauri() || (theme !== "light" && theme !== "dark")) {
      return;
    }

    // Complete native updates in order, even when themes change rapidly.
    // A failed update must not prevent the next theme from reaching the Dock.
    pending.current = pending.current
      .then(() => invoke<void>("set_app_icon", { theme }))
      .catch((error: unknown) => {
        console.warn("Could not update the application icon", error);
      });
  }, [theme]);
}
