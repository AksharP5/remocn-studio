"use client";

import { useLayoutEffect } from "react";
import { currentPlatform } from "@/lib/studio/platform";

export function usePlatformAttribute(): void {
  useLayoutEffect(() => {
    document.documentElement.dataset.platform = currentPlatform();
  }, []);
}
