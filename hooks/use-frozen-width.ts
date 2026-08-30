"use client";

import { useLayoutEffect, useRef, useState } from "react";

export interface FrozenWidth {
  ref: React.RefObject<HTMLDivElement | null>;
  width: number | null;
}

export function useFrozenWidth(isFrozen: boolean): FrozenWidth {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!isFrozen) {
      setWidth(null);
      return;
    }

    const node = ref.current;
    if (node === null) {
      return;
    }

    const measured = node.getBoundingClientRect().width;
    setWidth(measured > 0 ? measured : null);
  }, [isFrozen]);

  return { ref, width };
}
