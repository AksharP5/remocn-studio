"use client";

import { useEffect, useRef } from "react";
import { toastManager } from "@/components/ui/toast";

export function useSaveErrorToast(saveError: boolean, retry: () => void): void {
  const latest = useRef(retry);

  useEffect(() => {
    latest.current = retry;
  }, [retry]);

  useEffect(() => {
    if (!saveError) {
      return;
    }
    const id = toastManager.add({
      actionProps: {
        children: "Try again",
        onClick: () => latest.current(),
      },
      description: "The overview may come back next time.",
      timeout: 0,
      title: "Your place in the overview couldn’t be saved",
      type: "error",
    });
    return () => {
      toastManager.close(id);
    };
  }, [saveError]);
}
