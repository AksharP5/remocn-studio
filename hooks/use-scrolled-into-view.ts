"use client";

import type { RefObject } from "react";
import { useLayoutEffect, useRef } from "react";

export function useScrolledIntoView<E extends HTMLElement>(
  isFocused: boolean
): RefObject<E | null> {
  const ref = useRef<E>(null);

  useLayoutEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView?.({ block: "center" });
    }
  }, [isFocused]);

  return ref;
}
