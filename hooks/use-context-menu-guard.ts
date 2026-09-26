"use client";

import { useEffect } from "react";
import { keepsNativeMenu } from "@/lib/studio/context-menu";

export function useContextMenuGuard(): void {
  useEffect(() => {
    const guard = (event: MouseEvent) => {
      if (event.defaultPrevented || keepsNativeMenu(event.target)) {
        return;
      }
      event.preventDefault();
    };
    document.addEventListener("contextmenu", guard);
    return () => document.removeEventListener("contextmenu", guard);
  }, []);
}
